from sqlalchemy import func, select
from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Indicator
from ingest.actors import seed_actors
from ingest.seed import seed


def main():
    with SessionLocal() as db:
        count = db.scalar(select(func.count()).select_from(Indicator)) or 0
    if count == 0 and not settings.abusech_auth_key:
        print("WARNING: ABUSECH_AUTH_KEY missing; bootstrapping synthetic data")
        seed(min(1000, settings.max_indicators))
        if settings.max_indicators > 1000:
            from ingest.bulk_demo import import_demo, demo_history
            import_demo(settings.max_indicators - 1000)
            demo_history()
    with SessionLocal.begin() as db:
        created = seed_actors(db)
    if created:
        print(f"Loaded {created} bundled threat actors")


if __name__ == "__main__":
    main()
