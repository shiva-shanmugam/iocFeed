from datetime import datetime, timezone
import math

SOURCE_RELIABILITY = {
    "URLhaus": 0.95,
    "MalwareBazaar": 0.95,
    "ThreatFox": 0.9,
    "Feodo Tracker": 0.9,
    "synthetic-seed": 0.72,
}


def confidence_score(sources: list[str], last_seen: datetime, now: datetime | None = None) -> int:
    """Blend corroboration, feed reliability, and exponential 60-day recency decay."""
    now = now or datetime.now(timezone.utc)
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    recency = math.exp(-max(0, (now - last_seen).days) / 60)
    reliability = max((SOURCE_RELIABILITY.get(s, 0.65) for s in sources), default=0.5)
    corroboration = min(1.0, 0.55 + 0.15 * max(0, len(set(sources)) - 1))
    return round(100 * (0.45 * reliability + 0.35 * recency + 0.20 * corroboration))
