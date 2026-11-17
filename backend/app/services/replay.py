"""Capture what the database knew, separately from source-reported observation dates."""
from datetime import datetime, timezone
import hashlib
import json
from sqlalchemy import Text, cast, func, or_, select
from sqlalchemy.orm import Session
from app.models import EvidenceSnapshot, Indicator, IndicatorSource, Source, Relationship, IndicatorFamily, MalwareFamily, IndicatorTag, Tag


def evidence_origin(raw: dict) -> tuple[str | None, str]:
    # Only explicit upstream provenance is treated as a shared origin. Unknown is not independent.
    origin = raw.get("original_report_url") or raw.get("report_id")
    fingerprint = hashlib.sha256(json.dumps(raw, sort_keys=True, default=str).encode()).hexdigest()
    return str(origin) if origin else None, fingerprint


def current_state(db: Session, indicator_id: int) -> dict:
    i = db.get(Indicator, indicator_id, populate_existing=True)
    if not i:
        raise ValueError("indicator not found")
    evidence = []
    for observation, source, fingerprint in db.execute(select(IndicatorSource, Source, func.md5(cast(IndicatorSource.raw, Text))).join(Source, Source.id == IndicatorSource.source_id).where(IndicatorSource.indicator_id == indicator_id).order_by(Source.name)):
        raw = observation.raw or {}
        origin, _ = evidence_origin(raw)
        evidence.append({
            "name": source.name, "url": source.url, "origin": origin,
            "fingerprint": fingerprint, "synthetic": bool(raw.get("synthetic")),
            "first_seen": observation.first_seen.isoformat(), "last_seen": observation.last_seen.isoformat(),
            "excerpt": str(raw.get("description") or raw.get("comment") or raw.get("summary") or "Stored normalized source observation")[:1200],
        })
    relations = db.scalars(select(Relationship).where(or_(Relationship.src_indicator_id == indicator_id, Relationship.dst_indicator_id == indicator_id)).order_by(Relationship.id).limit(251)).all()
    ids = {r.dst_indicator_id if r.src_indicator_id == indicator_id else r.src_indicator_id for r in relations[:250]}
    neighbours = {n.id: n for n in db.scalars(select(Indicator).where(Indicator.id.in_(ids))).all()}
    edges = []
    for r in relations[:250]:
        other = r.dst_indicator_id if r.src_indicator_id == indicator_id else r.src_indicator_id
        n = neighbours[other]
        edges.append({"id": r.id, "other_id": other, "value": n.value, "type": n.type.value, "relation": r.relation_type})
    return {
        "verdict": i.verdict.value, "confidence": i.confidence,
        "first_seen": i.first_seen.isoformat(), "last_seen": i.last_seen.isoformat(),
        "sources": evidence, "relationships": edges,
        "relationship_count": db.scalar(select(func.count()).select_from(Relationship).where(or_(Relationship.src_indicator_id == indicator_id, Relationship.dst_indicator_id == indicator_id))) or 0,
        "relationships_truncated": len(relations) > 250,
        "families": list(db.scalars(select(MalwareFamily.name).join(IndicatorFamily).where(IndicatorFamily.indicator_id == indicator_id).order_by(MalwareFamily.name))),
        "tags": list(db.scalars(select(Tag.name).join(IndicatorTag).where(IndicatorTag.indicator_id == indicator_id).order_by(Tag.name))),
    }


def capture_snapshot(db: Session, indicator_id: int, reason: str = "source import") -> bool:
    db.flush()
    state = current_state(db, indicator_id)
    previous = db.scalar(select(EvidenceSnapshot).where(EvidenceSnapshot.indicator_id == indicator_id).order_by(EvidenceSnapshot.recorded_at.desc(), EvidenceSnapshot.id.desc()).limit(1))
    if previous and normalized_state(previous.state) == normalized_state(state):
        return False
    db.add(EvidenceSnapshot(indicator_id=indicator_id, recorded_at=datetime.now(timezone.utc), reason=reason, simulated=False, state=state))
    return True


def normalized_state(value, key=None):
    """PostgreSQL and Python can serialize the same timestamp with different precision."""
    if isinstance(value, dict):
        return {k: normalized_state(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [normalized_state(v) for v in value]
    if key in ("first_seen", "last_seen") and isinstance(value, str):
        return datetime.fromisoformat(value).astimezone(timezone.utc).isoformat()
    return value
