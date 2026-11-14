import asyncio, csv, io, json, ipaddress
from datetime import datetime
from typing import Literal
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import cast, func, or_, select, text
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import Session, selectinload
from app.core.database import SessionLocal, get_db
from app.models import (
    Indicator,
    IndicatorFamily,
    IndicatorSource,
    IndicatorTag,
    IngestionLog,
    IPGeo,
    MalwareFamily,
    Relationship,
    Source,
)
from app.services.classifier import classify, refang

router = APIRouter(prefix="/api")


def dto(i: Indicator, detail: bool = False):
    result = {
        "id": i.id,
        "type": i.type.value,
        "value": i.value,
        "first_seen": i.first_seen,
        "last_seen": i.last_seen,
        "confidence": i.confidence,
        "verdict": i.verdict.value,
    }
    if detail:
        result.update(
            sources=[
                {"name": x.source.name, "first_seen": x.first_seen, "last_seen": x.last_seen}
                for x in i.sources
            ],
            tags=[x.name for x in i.tags],
            families=[x.name for x in i.families],
            raw=[x.raw for x in i.sources],
        )
    return result


def detailed_stmt():
    return select(Indicator).options(
        selectinload(Indicator.sources).selectinload(IndicatorSource.source),
        selectinload(Indicator.tags),
        selectinload(Indicator.families),
    )


@router.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


@router.get("/lookup")
def lookup(q: str = Query(min_length=1, max_length=4096), db: Session = Depends(get_db)):
    try:
        typ, value = classify(q)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    row = db.scalar(detailed_stmt().where(Indicator.type == typ, Indicator.value == value))
    if not row:
        raise HTTPException(404, "indicator not found")
    return {"query": q, "refanged": refang(q), "indicator": dto(row, True)}


@router.get("/search")
def search(
    q: str = Query(min_length=1, max_length=256),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    term = f"%{refang(q)}%"
    base = select(Indicator).where(Indicator.value.ilike(term))
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.scalars(
        base.order_by(func.similarity(Indicator.value, refang(q)).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {"items": [dto(x) for x in rows], "page": page, "page_size": page_size, "total": total}


@router.get("/indicators/{indicator_id}")
def indicator_detail(indicator_id: int, db: Session = Depends(get_db)):
    row = db.scalar(detailed_stmt().where(Indicator.id == indicator_id))
    if not row:
        raise HTTPException(404, "indicator not found")
    return dto(row, True)


def _graph(db: Session, root: int, depth: int, max_nodes: int):
    seen = {root}
    frontier = {root}
    edges_by_id: dict[int, dict[str, int | str]] = {}
    for _ in range(depth):
        if not frontier:
            break
        rels = db.scalars(
            select(Relationship)
            .where(
                or_(
                    Relationship.src_indicator_id.in_(frontier),
                    Relationship.dst_indicator_id.in_(frontier),
                )
            )
            .limit(max_nodes * 4)
        ).all()
        nxt = set()
        for r in rels:
            if r.src_indicator_id in seen or r.dst_indicator_id in seen:
                edges_by_id[r.id] = {
                    "id": r.id,
                    "source": r.src_indicator_id,
                    "target": r.dst_indicator_id,
                    "type": r.relation_type,
                }
                nxt |= {r.src_indicator_id, r.dst_indicator_id}
            if len(seen | nxt) >= max_nodes:
                break
        frontier = nxt - seen
        seen |= nxt
    rows = db.scalars(select(Indicator).where(Indicator.id.in_(list(seen)[:max_nodes]))).all()
    ids = {x.id for x in rows}
    return {
        "nodes": [dto(x) for x in rows],
        "edges": [
            edge
            for edge in edges_by_id.values()
            if edge["source"] in ids and edge["target"] in ids
        ],
        "truncated": len(seen) > max_nodes,
    }


@router.get("/graph/path")
def graph_path(
    from_id: int = Query(alias="from"),
    to_id: int = Query(alias="to"),
    max_depth: int = Query(8, ge=1, le=12),
    db: Session = Depends(get_db),
):
    if from_id == to_id:
        return {"nodes": [from_id], "edges": []}
    queue = [from_id]
    parents = {from_id: None}
    parent_edges = {}
    for _ in range(max_depth):
        if not queue:
            break
        rels = db.scalars(
            select(Relationship).where(
                or_(
                    Relationship.src_indicator_id.in_(queue),
                    Relationship.dst_indicator_id.in_(queue),
                )
            )
        ).all()
        new = []
        for r in rels:
            for a, b in [
                (r.src_indicator_id, r.dst_indicator_id),
                (r.dst_indicator_id, r.src_indicator_id),
            ]:
                if a in parents and b not in parents:
                    parents[b] = a
                    parent_edges[b] = {
                        "id": r.id,
                        "source": r.src_indicator_id,
                        "target": r.dst_indicator_id,
                        "type": r.relation_type,
                    }
                    new.append(b)
        if to_id in parents:
            break
        queue = new
    if to_id not in parents:
        raise HTTPException(404, "no path within depth limit")
    nodes = []
    edges = []
    cur = to_id
    while cur is not None:
        nodes.append(cur)
        edges.append(parent_edges[cur]) if cur in parent_edges else None
        cur = parents[cur]
    return {"nodes": nodes[::-1], "edges": edges[::-1]}


@router.get("/graph/expand/{indicator_id}")
def graph_expand(indicator_id: int, db: Session = Depends(get_db)):
    return _graph(db, indicator_id, 1, 100)


@router.get("/graph/{indicator_id}")
def graph(
    indicator_id: int,
    depth: int = Query(1, ge=1, le=2),
    max_nodes: int = Query(250, ge=1, le=250),
    db: Session = Depends(get_db),
):
    return _graph(db, indicator_id, depth, max_nodes)


@router.get("/pivot/{indicator_id}")
def pivot(
    indicator_id: int,
    by: Literal["family", "asn", "subnet24", "tag"],
    db: Session = Depends(get_db),
):
    target = db.get(Indicator, indicator_id)
    if not target:
        raise HTTPException(404, "indicator not found")
    if by == "family":
        ids = select(IndicatorFamily.indicator_id).where(
            IndicatorFamily.family_id.in_(
                select(IndicatorFamily.family_id).where(
                    IndicatorFamily.indicator_id == indicator_id
                )
            )
        )
    elif by == "tag":
        ids = select(IndicatorTag.indicator_id).where(
            IndicatorTag.tag_id.in_(
                select(IndicatorTag.tag_id).where(IndicatorTag.indicator_id == indicator_id)
            )
        )
    elif by == "asn":
        geo = db.get(IPGeo, target.value)
        ids = (
            select(Indicator.id)
            .join(IPGeo, func.host(IPGeo.ip) == Indicator.value)
            .where(IPGeo.asn == geo.asn)
            if geo
            else select(Indicator.id).where(False)
        )
    else:
        try:
            prefix = str(ipaddress.ip_network(f"{target.value}/24", strict=False))
            ids = select(Indicator.id).where(
                Indicator.type == "ipv4", cast(Indicator.value, INET).op("<<=")(prefix)
            )
        except ValueError:
            ids = select(Indicator.id).where(False)
    rows = db.scalars(select(Indicator).where(Indicator.id.in_(ids)).limit(250)).all()
    return {"by": by, "items": [dto(x) for x in rows]}


@router.post("/bulk")
async def bulk(
    request: Request, file: UploadFile | None = File(None), db: Session = Depends(get_db)
):
    if file:
        values = (await file.read()).decode(errors="replace").replace(",", "\n").splitlines()
    else:
        body = await request.json()
        values = body if isinstance(body, list) else body.get("indicators", [])
    if len(values) > 5000:
        raise HTTPException(413, "maximum 5000 indicators per request")
    results = []
    for raw in values:
        raw = str(raw).strip()
        if not raw:
            continue
        try:
            typ, value = classify(raw)
            row = db.scalar(
                select(Indicator).where(Indicator.type == typ, Indicator.value == value)
            )
            results.append(
                {
                    "input": raw,
                    "status": "found" if row else "unknown",
                    "indicator": dto(row) if row else None,
                }
            )
        except ValueError:
            results.append({"input": raw, "status": "invalid", "indicator": None})
    return {
        "results": results,
        "summary": {
            "checked": len(results),
            "malicious": sum(
                (x.get("indicator") or {}).get("verdict") == "malicious" for x in results
            ),
            "suspicious": sum(
                (x.get("indicator") or {}).get("verdict") == "suspicious" for x in results
            ),
            "unknown": sum(
                not x["indicator"] or x["indicator"]["verdict"] == "unknown" for x in results
            ),
        },
    }


@router.get("/bulk/export")
def bulk_export(format: Literal["csv", "json", "blocklist"] = "csv", db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Indicator).where(Indicator.verdict.in_(["malicious", "suspicious"])).limit(10000)
    ).all()
    data = [dto(x) for x in rows]
    if format == "json":
        return data
    if format == "blocklist":
        return StreamingResponse(
            iter(["\n".join(x.value for x in rows)]),
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=blocklist.txt"},
        )
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["id", "type", "value", "first_seen", "last_seen", "confidence", "verdict"],
    )
    writer.writeheader()
    writer.writerows(data)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=iocs.csv"},
    )


@router.get("/stats/summary")
def summary(db: Session = Depends(get_db)):
    total = db.scalar(select(func.count()).select_from(Indicator)) or 0
    types = dict(db.execute(select(Indicator.type, func.count()).group_by(Indicator.type)).all())
    sources = db.execute(
        select(
            Source.name, func.count(IndicatorSource.indicator_id), Source.status, Source.last_sync
        )
        .outerjoin(IndicatorSource)
        .group_by(Source.id)
    ).all()
    return {
        "total": total,
        "by_type": {k.value: v for k, v in types.items()},
        "sources": [
            {"name": x[0], "count": x[1], "status": x[2], "last_sync": x[3]} for x in sources
        ],
        "online_feeds": sum(x[2] == "online" for x in sources),
        "last_sync": max((x[3] for x in sources if x[3]), default=None),
    }


@router.get("/stats/families")
def families(db: Session = Depends(get_db)):
    return [
        {"name": n, "count": c}
        for n, c in db.execute(
            select(MalwareFamily.name, func.count(IndicatorFamily.indicator_id))
            .outerjoin(IndicatorFamily)
            .group_by(MalwareFamily.id)
            .order_by(func.count(IndicatorFamily.indicator_id).desc())
        ).all()
    ]


@router.get("/stats/activity")
def activity(db: Session = Depends(get_db)):
    return [
        {"date": d, "count": c}
        for d, c in db.execute(
            select(func.date(Indicator.first_seen), func.count())
            .group_by(func.date(Indicator.first_seen))
            .order_by(func.date(Indicator.first_seen))
        ).all()
    ]


@router.get("/geo/points")
def geo(db: Session = Depends(get_db)):
    rows = db.execute(
        select(IPGeo, Indicator).join(Indicator, func.host(IPGeo.ip) == Indicator.value).limit(5000)
    ).all()
    return [
        {
            **dto(i),
            "country": g.country_code,
            "lat": g.lat,
            "lon": g.lon,
            "asn": g.asn,
            "as_name": g.as_name,
            "synthetic": g.synthetic,
        }
        for g, i in rows
    ]


@router.get("/timeline")
def timeline(
    family: str | None = None,
    from_: datetime | None = Query(None, alias="from"),
    to: datetime | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(Indicator)
    if family:
        stmt = stmt.join(IndicatorFamily).join(MalwareFamily).where(MalwareFamily.name == family)
    if from_:
        stmt = stmt.where(Indicator.first_seen >= from_)
    if to:
        stmt = stmt.where(Indicator.first_seen <= to)
    return [dto(x) for x in db.scalars(stmt.order_by(Indicator.first_seen).limit(5000)).all()]


@router.get("/ingestion/log")
def logs(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    return [
        {
            "id": x.id,
            "ts": x.ts,
            "source": x.source,
            "level": x.level,
            "message": x.message,
            "new_count": x.new_count,
            "updated_count": x.updated_count,
        }
        for x in db.scalars(
            select(IngestionLog).order_by(IngestionLog.id.desc()).limit(limit)
        ).all()
    ]


@router.get("/ingestion/stream")
async def log_stream():
    async def events():
        last = 0
        while True:
            with SessionLocal() as db:
                rows = db.scalars(
                    select(IngestionLog).where(IngestionLog.id > last).order_by(IngestionLog.id)
                ).all()
                for row in rows:
                    last = row.id
                    yield f"data: {json.dumps({'id':row.id,'ts':row.ts.isoformat(),'source':row.source,'level':row.level,'message':row.message})}\n\n"
            yield ": keepalive\n\n"
            await asyncio.sleep(3)

    return StreamingResponse(events(), media_type="text/event-stream")
