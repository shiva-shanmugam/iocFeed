from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
import geoip2.database
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from app.core.config import settings
from app.core.database import SessionLocal
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
    Tag,
)
from app.schemas import IndicatorIn


def ingest_items(source_name: str, source_url: str, items: list[IndicatorIn]) -> tuple[int, int]:
    new = updated = 0
    now = datetime.now(timezone.utc)
    with SessionLocal.begin() as db:
        source = db.scalar(select(Source).where(Source.name == source_name))
        if not source:
            source = Source(name=source_name, url=source_url, status="online", last_sync=now)
            db.add(source)
            db.flush()
        total = db.scalar(select(func.count()).select_from(Indicator)) or 0
        for item in items:
            existing = db.scalar(
                select(Indicator).where(Indicator.type == item.type, Indicator.value == item.value)
            )
            if not existing and total >= settings.max_indicators:
                break
            stmt = (
                insert(Indicator)
                .values(
                    type=item.type,
                    value=item.value,
                    first_seen=item.first_seen,
                    last_seen=item.last_seen,
                    confidence=item.confidence,
                    verdict=item.verdict,
                )
                .on_conflict_do_update(
                    index_elements=[Indicator.type, Indicator.value],
                    set_={
                        "last_seen": func.greatest(Indicator.last_seen, item.last_seen),
                        "confidence": func.greatest(Indicator.confidence, item.confidence),
                        "verdict": item.verdict,
                    },
                )
                .returning(Indicator.id)
            )
            iid = db.scalar(stmt)
            new += existing is None
            updated += existing is not None
            total += existing is None
            link = (
                insert(IndicatorSource)
                .values(
                    indicator_id=iid,
                    source_id=source.id,
                    first_seen=item.first_seen,
                    last_seen=item.last_seen,
                    raw=item.raw,
                )
                .on_conflict_do_update(
                    index_elements=[IndicatorSource.indicator_id, IndicatorSource.source_id],
                    set_={"last_seen": item.last_seen, "raw": item.raw},
                )
            )
            db.execute(link)
            for name in item.tags:
                tag = db.scalar(select(Tag).where(Tag.name == name))
                if not tag:
                    tag = Tag(name=name)
                    db.add(tag)
                    db.flush()
                db.execute(
                    insert(IndicatorTag)
                    .values(indicator_id=iid, tag_id=tag.id)
                    .on_conflict_do_nothing()
                )
            for name in item.families:
                family = db.scalar(select(MalwareFamily).where(MalwareFamily.name == name))
                if not family:
                    family = MalwareFamily(name=name)
                    db.add(family)
                    db.flush()
                db.execute(
                    insert(IndicatorFamily)
                    .values(indicator_id=iid, family_id=family.id)
                    .on_conflict_do_nothing()
                )
            if item.type.value == "url" and total < settings.max_indicators:
                host = urlparse(item.value).hostname
                if host:
                    host_type = "ipv4" if host.replace(".", "").isdigit() else "domain"
                    host_existing = db.scalar(
                        select(Indicator.id).where(
                            Indicator.type == host_type, Indicator.value == host
                        )
                    )
                    host_id = db.scalar(
                        insert(Indicator)
                        .values(
                            type=host_type,
                            value=host,
                            first_seen=item.first_seen,
                            last_seen=item.last_seen,
                            confidence=item.confidence,
                            verdict=item.verdict,
                        )
                        .on_conflict_do_update(
                            index_elements=[Indicator.type, Indicator.value],
                            set_={"last_seen": item.last_seen},
                        )
                        .returning(Indicator.id)
                    )
                    if not db.scalar(
                        select(Relationship.id).where(
                            Relationship.src_indicator_id == iid,
                            Relationship.dst_indicator_id == host_id,
                            Relationship.relation_type == "hosted_on",
                            Relationship.source_id == source.id,
                        )
                    ):
                        db.add(
                            Relationship(
                                src_indicator_id=iid,
                                dst_indicator_id=host_id,
                                relation_type="hosted_on",
                                source_id=source.id,
                            )
                        )
                    total += host_existing is None
            if (
                item.type.value == "ipv4"
                and settings.maxmind_db_path
                and Path(settings.maxmind_db_path).is_file()
            ):
                try:
                    with geoip2.database.Reader(settings.maxmind_db_path) as reader:
                        result = reader.city(item.value)
                    db.execute(
                        insert(IPGeo)
                        .values(
                            ip=item.value,
                            country_code=result.country.iso_code or "ZZ",
                            lat=result.location.latitude or 0,
                            lon=result.location.longitude or 0,
                            asn=0,
                            as_name="GeoLite2",
                            synthetic=False,
                        )
                        .on_conflict_do_update(
                            index_elements=[IPGeo.ip],
                            set_={
                                "country_code": result.country.iso_code or "ZZ",
                                "lat": result.location.latitude or 0,
                                "lon": result.location.longitude or 0,
                                "synthetic": False,
                            },
                        )
                    )
                except Exception as exc:
                    db.add(
                        IngestionLog(
                            source=source_name,
                            level="warning",
                            message=f"GeoLite2 lookup failed for {item.value}: {exc}",
                            new_count=0,
                            updated_count=0,
                        )
                    )
        source.last_sync = now
        source.status = "online"
        db.add(
            IngestionLog(
                source=source_name,
                level="info",
                message=f"sync complete: {new} new, {updated} updated",
                new_count=new,
                updated_count=updated,
            )
        )
    return new, updated


def log_failure(name: str, message: str):
    with SessionLocal.begin() as db:
        db.add(
            IngestionLog(
                source=name, level="error", message=message[:1000], new_count=0, updated_count=0
            )
        )
