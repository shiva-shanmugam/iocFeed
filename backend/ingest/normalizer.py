from datetime import datetime, timezone
from typing import Any
from app.models import Verdict
from app.schemas import IndicatorIn
from app.services.classifier import classify

def normalize_record(value: str, raw: dict[str, Any], *, confidence: int = 80) -> IndicatorIn:
    typ, clean = classify(value)
    now = datetime.now(timezone.utc)
    def parsed(key: str) -> datetime:
        candidate = raw.get(key)
        if not candidate: return now
        try: return datetime.fromisoformat(str(candidate).replace("Z", "+00:00"))
        except ValueError: return now
    family = raw.get("malware") or raw.get("malware_printable") or raw.get("family")
    raw_tags = raw.get("tags") or raw.get("tag") or []
    tags = [str(x) for x in raw_tags] if isinstance(raw_tags, list) else [str(raw_tags)]
    return IndicatorIn(type=typ, value=clean, first_seen=parsed("first_seen"), last_seen=parsed("last_seen"), confidence=confidence, verdict=Verdict.malicious, tags=tags, families=[str(family)] if family and family != "unknown" else [], raw=raw)

