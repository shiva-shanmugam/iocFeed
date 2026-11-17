from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import EvidenceSnapshot, Indicator
from app.services.replay import current_state

router = APIRouter(prefix="/api/replay", tags=["evidence replay"])


@router.get("/{indicator_id}")
def replay(indicator_id: int, db: Session = Depends(get_db)):
    indicator = db.get(Indicator, indicator_id)
    if not indicator:
        raise HTTPException(404, "indicator not found")
    # Return the latest bounded history, in chronological order.
    snapshots = list(reversed(db.scalars(select(EvidenceSnapshot).where(EvidenceSnapshot.indicator_id == indicator_id).order_by(EvidenceSnapshot.recorded_at.desc(), EvidenceSnapshot.id.desc()).limit(501)).all()))
    truncated = len(snapshots) > 500
    snapshots = snapshots[-500:]
    return {
        "indicator": {"id": indicator.id, "type": indicator.type.value, "value": indicator.value},
        "snapshots": [{"id": s.id, "recorded_at": s.recorded_at, "reason": s.reason, "simulated": s.simulated, "state": s.state} for s in snapshots],
        "current": current_state(db, indicator_id), "truncated": truncated,
        "has_simulated_history": any(s.simulated for s in snapshots),
        "notice": "Replay uses capture timestamps, not source first-seen dates. History before the first capture is unavailable.",
    }
