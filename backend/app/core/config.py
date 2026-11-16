from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://ioc:change-me@db:5432/ioc"
    frontend_origin: str = "http://localhost:5173"
    abusech_auth_key: str = ""
    max_indicators: int = 110_000
    ingest_interval_minutes: int = 30
    maxmind_db_path: str = ""
    rate_limit_per_minute: int = 120
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
