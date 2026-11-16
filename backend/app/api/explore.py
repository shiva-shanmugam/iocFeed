from collections import defaultdict
from datetime import date, timedelta
from time import monotonic
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models import (
    ActorFamily,
    Indicator,
    IndicatorFamily,
    IndicatorSource,
    IndicatorTag,
    IPGeo,
    MalwareFamily,
    Source,
    Tag,
    ThreatActor,
)

router = APIRouter(prefix="/api/explore", tags=["explore"])
_cache: dict[str, tuple[float, object]] = {}


class ExploreFilters(BaseModel):
    types: list[str] = []
    sources: list[str] = []
    families: list[str] = []
    actors: list[str] = []
    tags: list[str] = []
    countries: list[str] = []
    asns: list[int] = []
    date_from: date | None = None
    date_to: date | None = None
    date_basis: Literal["first_seen", "last_seen"] = "first_seen"
    contains: str | None = None


def _split(values: list[str] | None) -> list[str]:
    return [item for value in values or [] for item in value.split(",") if item]


def parse_filters(
    types: list[str] | None = Query(None, alias="type"),
    sources: list[str] | None = Query(None, alias="source"),
    families: list[str] | None = Query(None, alias="family"),
    actors: list[str] | None = Query(None, alias="actor"),
    tags: list[str] | None = Query(None, alias="tag"),
    countries: list[str] | None = Query(None, alias="country"),
    asns: list[str] | None = Query(None, alias="asn"),
    date_from: date | None = None,
    date_to: date | None = None,
    date_basis: Literal["first_seen", "last_seen"] = "first_seen",
    contains: str | None = Query(None, max_length=200),
) -> ExploreFilters:
    parsed_asns = []
    for value in _split(asns):
        try:
            parsed_asns.append(int(value))
        except ValueError as exc:
            raise HTTPException(422, f"invalid ASN: {value}") from exc
    return ExploreFilters(
        types=_split(types),
        sources=_split(sources),
        families=_split(families),
        actors=_split(actors),
        tags=_split(tags),
        countries=_split(countries),
        asns=parsed_asns,
        date_from=date_from,
        date_to=date_to,
        date_basis=date_basis,
        contains=contains.strip() if contains else None,
    )


def _ids(filters: ExploreFilters, exclude: str | None = None):
    stmt = select(Indicator.id)
    if filters.types and exclude != "type":
        stmt = stmt.where(Indicator.type.in_(filters.types))
    if filters.contains:
        stmt = stmt.where(Indicator.value.ilike(f"%{filters.contains}%"))
    date_column = Indicator.last_seen if filters.date_basis == "last_seen" else Indicator.first_seen
    if filters.date_from:
        stmt = stmt.where(date_column >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(date_column < filters.date_to + timedelta(days=1))
    if filters.sources and exclude != "source":
        stmt = stmt.where(
            exists(
                select(1)
                .select_from(IndicatorSource)
                .join(Source)
                .where(
                    IndicatorSource.indicator_id == Indicator.id,
                    Source.name.in_(filters.sources),
                )
            )
        )
    if filters.families and exclude != "family":
        stmt = stmt.where(
            exists(
                select(1)
                .select_from(IndicatorFamily)
                .join(MalwareFamily)
                .where(
                    IndicatorFamily.indicator_id == Indicator.id,
                    MalwareFamily.name.in_(filters.families),
                )
            )
        )
    if filters.actors and exclude != "actor":
        stmt = stmt.where(
            exists(
                select(1)
                .select_from(IndicatorFamily)
                .join(ActorFamily, ActorFamily.family_id == IndicatorFamily.family_id)
                .join(ThreatActor)
                .where(
                    IndicatorFamily.indicator_id == Indicator.id,
                    ThreatActor.name.in_(filters.actors),
                )
            )
        )
    if filters.tags and exclude != "tag":
        stmt = stmt.where(
            exists(
                select(1)
                .select_from(IndicatorTag)
                .join(Tag)
                .where(IndicatorTag.indicator_id == Indicator.id, Tag.name.in_(filters.tags))
            )
        )
    geo_clauses = []
    if filters.countries and exclude != "country":
        geo_clauses.append(IPGeo.country_code.in_(filters.countries))
    if filters.asns and exclude != "asn":
        geo_clauses.append(IPGeo.asn.in_(filters.asns))
    if geo_clauses:
        stmt = stmt.where(
            exists(
                select(1)
                .select_from(IPGeo)
                .where(func.host(IPGeo.ip) == Indicator.value, *geo_clauses)
            )
        )
    return stmt


def _cache_key(request: Request, suffix: str = "") -> str:
    return f"{request.url.path}?{request.url.query}|{suffix}"


def _cached(key: str):
    hit = _cache.get(key)
    if hit and monotonic() - hit[0] < 30:
        return hit[1]
    return None


def _store(key: str, value):
    _cache[key] = (monotonic(), value)
    return value


def _count(db: Session, filters: ExploreFilters, exclude: str | None = None) -> int:
    return db.scalar(select(func.count()).select_from(_ids(filters, exclude).subquery())) or 0


@router.get("/summary")
def summary(request: Request, filters: ExploreFilters = Depends(parse_filters), db: Session = Depends(get_db)):
    key = _cache_key(request)
    if (value := _cached(key)) is not None:
        return value
    ids = _ids(filters).subquery()
    total, first_seen, last_seen = db.execute(
        select(func.count(), func.min(Indicator.first_seen), func.max(Indicator.last_seen)).where(
            Indicator.id.in_(select(ids.c.id))
        )
    ).one()
    return _store(
        key,
        {
            "total": total,
            "types": db.scalar(select(func.count(func.distinct(Indicator.type))).where(Indicator.id.in_(select(ids.c.id)))) or 0,
            "sources": db.scalar(select(func.count(func.distinct(IndicatorSource.source_id))).where(IndicatorSource.indicator_id.in_(select(ids.c.id)))) or 0,
            "families": db.scalar(select(func.count(func.distinct(IndicatorFamily.family_id))).where(IndicatorFamily.indicator_id.in_(select(ids.c.id)))) or 0,
            "actors": db.scalar(select(func.count(func.distinct(ActorFamily.actor_id))).join(IndicatorFamily, IndicatorFamily.family_id == ActorFamily.family_id).where(IndicatorFamily.indicator_id.in_(select(ids.c.id)))) or 0,
            "first_seen": first_seen,
            "last_seen": last_seen,
        },
    )


def _facet_rows(db: Session, filters: ExploreFilters, facet: str):
    ids = _ids(filters, facet).subquery()
    if facet == "type":
        stmt = select(Indicator.type, func.count()).where(Indicator.id.in_(select(ids.c.id))).group_by(Indicator.type)
    elif facet == "source":
        stmt = select(Source.name, func.count(func.distinct(IndicatorSource.indicator_id))).join(IndicatorSource).where(IndicatorSource.indicator_id.in_(select(ids.c.id))).group_by(Source.id)
    elif facet == "family":
        stmt = select(MalwareFamily.name, func.count(func.distinct(IndicatorFamily.indicator_id))).join(IndicatorFamily).where(IndicatorFamily.indicator_id.in_(select(ids.c.id))).group_by(MalwareFamily.id)
    elif facet == "actor":
        stmt = select(ThreatActor.name, func.count(func.distinct(IndicatorFamily.indicator_id))).join(ActorFamily).join(IndicatorFamily, IndicatorFamily.family_id == ActorFamily.family_id).where(IndicatorFamily.indicator_id.in_(select(ids.c.id))).group_by(ThreatActor.id)
    elif facet == "tag":
        stmt = select(Tag.name, func.count(func.distinct(IndicatorTag.indicator_id))).join(IndicatorTag).where(IndicatorTag.indicator_id.in_(select(ids.c.id))).group_by(Tag.id)
    elif facet == "country":
        stmt = select(IPGeo.country_code, func.count()).join(Indicator, func.host(IPGeo.ip) == Indicator.value).where(Indicator.id.in_(select(ids.c.id))).group_by(IPGeo.country_code)
    elif facet == "asn":
        stmt = select(IPGeo.asn, func.min(IPGeo.as_name), func.count()).join(Indicator, func.host(IPGeo.ip) == Indicator.value).where(Indicator.id.in_(select(ids.c.id))).group_by(IPGeo.asn)
        return [{"value": str(v), "label": f"AS{v} {label}", "count": count} for v, label, count in db.execute(stmt.order_by(func.count().desc()).limit(50))]
    else:
        raise HTTPException(404, "unknown facet")
    return [{"value": str(value.value if hasattr(value, "value") else value), "label": str(value.value if hasattr(value, "value") else value), "count": count} for value, count in db.execute(stmt.order_by(func.count().desc()).limit(50))]


@router.get("/facets")
def facets(request: Request, filters: ExploreFilters = Depends(parse_filters), db: Session = Depends(get_db)):
    key = _cache_key(request)
    if (value := _cached(key)) is not None:
        return value
    return _store(key, {name: _facet_rows(db, filters, name) for name in ("type", "source", "family", "actor", "tag", "country", "asn")})


@router.get("/timeseries")
def timeseries(
    request: Request,
    bucket: Literal["day", "week", "month"] = "day",
    group: Literal["none", "type", "source", "family"] = "type",
    basis: Literal["first_seen", "last_seen"] = "first_seen",
    filters: ExploreFilters = Depends(parse_filters),
    db: Session = Depends(get_db),
):
    key = _cache_key(request)
    if (value := _cached(key)) is not None:
        return value
    ids = _ids(filters).subquery()
    time_col = getattr(Indicator, basis)
    period = func.date_trunc(bucket, time_col)
    if group == "none":
        rows = db.execute(select(period, func.count()).where(Indicator.id.in_(select(ids.c.id))).group_by(period).order_by(period)).all()
        result = [{"date": d.date(), "series": {"all": count}, "total": count} for d, count in rows]
    elif group == "type":
        rows = db.execute(select(period, Indicator.type, func.count()).where(Indicator.id.in_(select(ids.c.id))).group_by(period, Indicator.type).order_by(period)).all()
        grouped = defaultdict(dict)
        for d, label, count in rows:
            grouped[d.date()][label.value] = count
        result = [{"date": d, "series": series, "total": sum(series.values())} for d, series in grouped.items()]
    else:
        if group == "source":
            label, join_table, join_model = Source.name, IndicatorSource, Source
            stmt = select(period, label, func.count(func.distinct(Indicator.id))).join(join_table, join_table.indicator_id == Indicator.id).join(join_model).where(Indicator.id.in_(select(ids.c.id))).group_by(period, label).order_by(period)
        else:
            label, join_table, join_model = MalwareFamily.name, IndicatorFamily, MalwareFamily
            stmt = select(period, label, func.count(func.distinct(Indicator.id))).join(join_table, join_table.indicator_id == Indicator.id).join(join_model).where(Indicator.id.in_(select(ids.c.id))).group_by(period, label).order_by(period)
        grouped = defaultdict(dict)
        for d, label_value, count in db.execute(stmt):
            grouped[d.date()][label_value] = count
        result = [{"date": d, "series": series, "total": sum(series.values())} for d, series in grouped.items()]
    return _store(key, {"items": result, "bucket": bucket, "group": group, "basis": basis})


SORTS = {"first_seen": Indicator.first_seen, "last_seen": Indicator.last_seen, "type": Indicator.type, "value": Indicator.value, "confidence": Indicator.confidence}


@router.get("/indicators")
def indicators(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=10, le=100),
    sort: str = "last_seen",
    order: Literal["asc", "desc"] = "desc",
    filters: ExploreFilters = Depends(parse_filters),
    db: Session = Depends(get_db),
):
    if sort not in SORTS:
        raise HTTPException(422, "unsupported sort field")
    ids = _ids(filters).subquery()
    total = db.scalar(select(func.count()).select_from(ids)) or 0
    direction = SORTS[sort].asc() if order == "asc" else SORTS[sort].desc()
    rows = db.scalars(
        select(Indicator)
        .where(Indicator.id.in_(select(ids.c.id)))
        .options(
            selectinload(Indicator.sources).selectinload(IndicatorSource.source),
            selectinload(Indicator.families).selectinload(MalwareFamily.actors),
            selectinload(Indicator.tags),
        )
        .order_by(direction, Indicator.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    geos = {str(g.ip): g for g in db.scalars(select(IPGeo).where(func.host(IPGeo.ip).in_([r.value for r in rows]))).all()} if rows else {}
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": row.id, "type": row.type.value, "value": row.value,
                "first_seen": row.first_seen, "last_seen": row.last_seen,
                "confidence": row.confidence, "verdict": row.verdict.value,
                "sources": [item.source.name for item in row.sources],
                "families": [item.name for item in row.families],
                "actors": sorted({actor.name for family in row.families for actor in family.actors}),
                "tags": [item.name for item in row.tags],
                "country": geos.get(row.value).country_code if geos.get(row.value) else None,
                "asn": geos.get(row.value).asn if geos.get(row.value) else None,
            }
            for row in rows
        ],
    }


@router.get("/entity/{kind}/{value}")
def entity(kind: str, value: str, db: Session = Depends(get_db)):
    if kind == "bucket":
        try:
            day = date.fromisoformat(value)
        except ValueError as exc:
            raise HTTPException(422, "invalid time bucket") from exc
        filters = ExploreFilters(date_from=day, date_to=day)
        return {"kind": kind, "value": value, "title": value, "description": f"{_count(db, filters):,} indicators first observed in this bucket", "meta": {}, "related": []}
    if kind == "indicator":
        row = db.get(Indicator, int(value)) if value.isdigit() else None
        if not row:
            raise HTTPException(404, "indicator not found")
        return {"kind": kind, "value": str(row.id), "title": row.value, "description": f"{row.type.value} · {row.verdict.value}", "meta": {"confidence": row.confidence, "first_seen": row.first_seen, "last_seen": row.last_seen}, "related": []}
    if kind == "actor":
        row = db.scalar(select(ThreatActor).options(selectinload(ThreatActor.families)).where(ThreatActor.name == value))
        if not row:
            raise HTTPException(404, "actor not found")
        return {"kind": kind, "value": value, "title": row.name, "description": row.description, "meta": {"aliases": row.aliases, "country": row.country}, "related": [{"kind": "family", "value": item.name, "label": item.name} for item in row.families]}
    if kind == "family":
        row = db.scalar(select(MalwareFamily).options(selectinload(MalwareFamily.actors)).where(MalwareFamily.name == value))
        if not row:
            raise HTTPException(404, "family not found")
        filters = ExploreFilters(families=[value])
        return {"kind": kind, "value": value, "title": row.name, "description": f"{_count(db, filters):,} matching indicators", "meta": {}, "related": [{"kind": "actor", "value": actor.name, "label": actor.name} for actor in row.actors]}
    facet = {"family": "family", "type": "type", "source": "source", "tag": "tag", "country": "country", "asn": "asn"}.get(kind)
    if not facet:
        raise HTTPException(404, "unknown entity")
    filters = ExploreFilters(**{f"{facet}s" if facet not in ("family", "country") else {"family": "families", "country": "countries"}[facet]: [int(value)] if facet == "asn" else [value]})
    ids = _ids(filters).subquery()
    by_type = db.execute(select(Indicator.type, func.count()).where(Indicator.id.in_(select(ids.c.id))).group_by(Indicator.type).order_by(func.count().desc())).all()
    related = db.execute(select(MalwareFamily.name, func.count()).join(IndicatorFamily).where(IndicatorFamily.indicator_id.in_(select(ids.c.id))).group_by(MalwareFamily.id).order_by(func.count().desc()).limit(8)).all()
    return {"kind": kind, "value": value, "title": value, "description": f"{_count(db, filters):,} matching indicators", "meta": {"types": {k.value: v for k, v in by_type}}, "related": [{"kind": "family", "value": name, "label": f"{name} ({count})"} for name, count in related]}


@router.get("/actors")
def actors(db: Session = Depends(get_db)):
    return [{"name": name, "aliases": aliases, "count": count} for name, aliases, count in db.execute(select(ThreatActor.name, ThreatActor.aliases, func.count(func.distinct(IndicatorFamily.indicator_id))).outerjoin(ActorFamily).outerjoin(IndicatorFamily, IndicatorFamily.family_id == ActorFamily.family_id).group_by(ThreatActor.id).order_by(func.count().desc()))]


@router.get("/actors/{name}")
def actor_detail(name: str, db: Session = Depends(get_db)):
    row = db.scalar(
        select(ThreatActor)
        .options(selectinload(ThreatActor.families))
        .where(ThreatActor.name == name)
    )
    if not row:
        raise HTTPException(404, "actor not found")
    return {
        "name": row.name,
        "aliases": row.aliases,
        "description": row.description,
        "country": row.country,
        "families": [family.name for family in row.families],
    }
