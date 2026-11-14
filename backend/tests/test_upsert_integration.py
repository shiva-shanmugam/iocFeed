import os
from datetime import datetime, timezone
import pytest
from sqlalchemy import func, select
from app.core.database import SessionLocal
from app.models import Indicator, IndicatorType, Verdict
from app.schemas import IndicatorIn
from ingest.service import ingest_items
pytestmark=pytest.mark.skipif(not os.getenv("RUN_DB_TESTS"),reason="requires migrated PostgreSQL")
def test_upsert_deduplicates_indicator():
    now=datetime.now(timezone.utc); item=IndicatorIn(type=IndicatorType.domain,value="dedup-test.example",first_seen=now,last_seen=now,confidence=80,verdict=Verdict.malicious)
    ingest_items("pytest","local://pytest",[item]); ingest_items("pytest","local://pytest",[item])
    with SessionLocal() as db: assert db.scalar(select(func.count()).select_from(Indicator).where(Indicator.value==item.value))==1

