from datetime import datetime, timedelta, timezone
from app.services.confidence import confidence_score
def test_more_sources_raise_confidence():
    now=datetime.now(timezone.utc); assert confidence_score(["URLhaus","ThreatFox"],now,now)>confidence_score(["unknown"],now,now)
def test_recency_decay():
    now=datetime.now(timezone.utc); assert confidence_score(["URLhaus"],now,now)>confidence_score(["URLhaus"],now-timedelta(days=120),now)

