from datetime import datetime, timezone
import math
SOURCE_RELIABILITY = {"URLhaus": .95, "MalwareBazaar": .95, "ThreatFox": .9, "Feodo Tracker": .9, "synthetic-seed": .72}
def confidence_score(sources: list[str], last_seen: datetime, now: datetime | None = None) -> int:
    """Blend corroboration, feed reliability, and exponential 60-day recency decay."""
    now = now or datetime.now(timezone.utc)
    if last_seen.tzinfo is None: last_seen = last_seen.replace(tzinfo=timezone.utc)
    recency = math.exp(-max(0, (now - last_seen).days) / 60); reliability = max((SOURCE_RELIABILITY.get(s, .65) for s in sources), default=.5); corroboration = min(1.0, .55 + .15 * max(0, len(set(sources)) - 1))
    return round(100 * (.45 * reliability + .35 * recency + .20 * corroboration))

