from datetime import datetime, timezone
import uuid
import os
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import engine
from app.models import EvidenceSnapshot, Indicator, IndicatorSource, IndicatorType, Relationship, Source, Verdict
from app.services.replay import capture_snapshot, evidence_origin
from app.api.replay import replay
from app.api.routes import _graph


def test_unknown_provenance_is_not_invented_from_matching_content():
    raw = {"description": "same copied content"}
    assert evidence_origin(raw)[0] is None
    assert evidence_origin(raw)[1] == evidence_origin(dict(raw))[1]
    assert evidence_origin({"report_id": "upstream-1"})[0] == "upstream-1"


@pytest.fixture
def db():
    if not os.getenv("RUN_DB_TESTS"):
        pytest.skip("requires migrated PostgreSQL")
    with engine.connect() as connection:
        transaction = connection.begin()
        with Session(bind=connection, expire_on_commit=False) as session:
            yield session
        transaction.rollback()


def make_indicator(db, suffix=""):
    now = datetime.now(timezone.utc)
    i = Indicator(type=IndicatorType.domain, value=f"replay-{uuid.uuid4().hex}{suffix}.example", first_seen=now, last_seen=now, confidence=32, verdict=Verdict.unknown)
    db.add(i)
    db.flush()
    return i


def test_snapshots_preserve_old_verdict_and_skip_unchanged_state(db):
    i = make_indicator(db)
    source = Source(name=f"test-{uuid.uuid4().hex}", url="local://test", status="offline")
    db.add(source)
    db.flush()
    db.add(IndicatorSource(indicator_id=i.id, source_id=source.id, first_seen=i.first_seen, last_seen=i.last_seen, raw={"report_id":"original-1"}))
    assert capture_snapshot(db,i.id)
    assert not capture_snapshot(db,i.id)
    i.confidence = 88
    i.verdict = Verdict.malicious
    assert capture_snapshot(db,i.id)
    db.flush()
    snapshots = db.scalars(select(EvidenceSnapshot).where(EvidenceSnapshot.indicator_id == i.id).order_by(EvidenceSnapshot.id)).all()
    assert len(snapshots) == 2
    assert snapshots[0].state["confidence"] == 32
    assert snapshots[1].state["confidence"] == 88
    assert snapshots[0].state["sources"][0]["origin"] == "original-1"
    assert snapshots[0].recorded_at >= i.first_seen


def test_replay_without_captures_does_not_fabricate_history(db):
    i = make_indicator(db)
    result = replay(i.id,db)
    assert result["snapshots"] == []
    assert result["current"]["confidence"] == 32
    assert not result["has_simulated_history"]


def test_bulk_baseline_and_live_capture_use_the_same_state_format(db):
    from ingest.bulk_demo import BASELINE_SQL
    i = make_indicator(db)
    source = Source(name=f"test-{uuid.uuid4().hex}", url="local://test", status="offline")
    db.add(source)
    db.flush()
    db.add(IndicatorSource(indicator_id=i.id,source_id=source.id,first_seen=i.first_seen,last_seen=i.last_seen,raw={"synthetic":True,"report_id":"one-origin","description":"baseline"}))
    db.flush()
    db.connection().exec_driver_sql(BASELINE_SQL,(i.id,i.id+1))
    assert not capture_snapshot(db,i.id)


def test_graph_budget_retains_root_and_only_valid_edges(db):
    root = make_indicator(db)
    others = [make_indicator(db) for _ in range(5)]
    db.add_all([Relationship(src_indicator_id=n.id,dst_indicator_id=root.id,relation_type="resolves_to") for n in others])
    db.flush()
    graph = _graph(db,root.id,2,3)
    ids = {n["id"] for n in graph["nodes"]}
    assert graph["nodes"][0]["id"] == root.id
    assert len(ids) == 3 and graph["truncated"]
    assert all(e["source"] in ids and e["target"] in ids for e in graph["edges"])
