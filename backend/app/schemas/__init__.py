from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field
from app.models import IndicatorType, Verdict


class IndicatorIn(BaseModel):
    type: IndicatorType
    value: str = Field(max_length=4096)
    first_seen: datetime
    last_seen: datetime
    confidence: int = Field(ge=0, le=100)
    verdict: Verdict
    tags: list[str] = []
    families: list[str] = []
    raw: dict[str, Any] = {}
