from apscheduler.schedulers.blocking import BlockingScheduler
from app.core.config import settings
from ingest.run import run_once
def main():
    scheduler=BlockingScheduler(timezone="UTC"); scheduler.add_job(run_once,"interval",minutes=settings.ingest_interval_minutes,max_instances=1,coalesce=True); run_once(); scheduler.start()
if __name__ == "__main__": main()
