from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.explore import router as explore_router
from app.core.config import settings
from app.core.rate_limit import rate_limit

app = FastAPI(
    title="IOC Feed",
    version="1.0.0",
    description="Local-first IOC lookup and threat-intelligence API",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.middleware("http")(rate_limit)
app.include_router(router)
app.include_router(explore_router)
