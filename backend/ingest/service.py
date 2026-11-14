from datetime import datetime, timezone
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Indicator, IndicatorSource, IngestionLog, Source
from app.schemas import IndicatorIn

def ingest_items(source_name: str, source_url: str, items: list[IndicatorIn]) -> tuple[int,int]:
    new=updated=0; now=datetime.now(timezone.utc)
    with SessionLocal.begin() as db:
        source=db.scalar(select(Source).where(Source.name==source_name))
        if not source: source=Source(name=source_name,url=source_url,status="online",last_sync=now); db.add(source); db.flush()
        total=db.scalar(select(func.count()).select_from(Indicator)) or 0
        for item in items:
            existing=db.scalar(select(Indicator).where(Indicator.type==item.type,Indicator.value==item.value))
            if not existing and total>=settings.max_indicators: break
            stmt=insert(Indicator).values(type=item.type,value=item.value,first_seen=item.first_seen,last_seen=item.last_seen,confidence=item.confidence,verdict=item.verdict).on_conflict_do_update(index_elements=[Indicator.type,Indicator.value],set_={"last_seen":func.greatest(Indicator.last_seen,item.last_seen),"confidence":func.greatest(Indicator.confidence,item.confidence),"verdict":item.verdict}).returning(Indicator.id)
            iid=db.scalar(stmt); new += existing is None; updated += existing is not None; total += existing is None
            link=insert(IndicatorSource).values(indicator_id=iid,source_id=source.id,first_seen=item.first_seen,last_seen=item.last_seen,raw=item.raw).on_conflict_do_update(index_elements=[IndicatorSource.indicator_id,IndicatorSource.source_id],set_={"last_seen":item.last_seen,"raw":item.raw}); db.execute(link)
        source.last_sync=now; source.status="online"; db.add(IngestionLog(source=source_name,level="info",message=f"sync complete: {new} new, {updated} updated",new_count=new,updated_count=updated))
    return new,updated

def log_failure(name: str, message: str):
    with SessionLocal.begin() as db: db.add(IngestionLog(source=name,level="error",message=message[:1000],new_count=0,updated_count=0))

