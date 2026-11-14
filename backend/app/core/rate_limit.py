import time
from collections import defaultdict, deque
from fastapi import Request
from fastapi.responses import JSONResponse
from app.core.config import settings

hits: dict[str, deque[float]] = defaultdict(deque)


async def rate_limit(request: Request, call_next):
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window = hits[key]
    while window and window[0] < now - 60:
        window.popleft()
    if len(window) >= settings.rate_limit_per_minute:
        return JSONResponse({"detail": "rate limit exceeded"}, 429)
    window.append(now)
    return await call_next(request)
