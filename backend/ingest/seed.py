from datetime import datetime, timedelta, timezone
import hashlib, random
from sqlalchemy import func, select
from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Indicator, IndicatorFamily, IndicatorSource, IndicatorTag, IngestionLog, IPGeo, MalwareFamily, Relationship, Source, Tag, IndicatorType, Verdict
FAMILIES = ["Emotet", "QakBot", "AgentTesla", "TrickBot", "IcedID", "RedLine", "AsyncRAT", "Dridex"]
TAGS = ["c2", "phishing", "loader", "stealer", "ransomware", "botnet"]
COUNTRIES = [("US", 37.1, -95.7), ("DE", 51.2, 10.4), ("NL", 52.1, 5.3), ("SG", 1.35, 103.8), ("IN", 20.6, 78.9), ("BR", -14.2, -51.9)]
def _value(i: int) -> tuple[IndicatorType, str]:
    kind = i % 10
    if kind < 2: return IndicatorType.ipv4, f"198.51.{(i // 254) % 100}.{i % 254 + 1}"
    if kind < 4: return IndicatorType.domain, f"node-{i}.malware-test.example"
    if kind < 6: return IndicatorType.url, f"http://node-{i - 1}.malware-test.example/drop/{i}.bin"
    digest = hashlib.sha256(f"synthetic-ioc-{i}".encode()).hexdigest()
    return (IndicatorType.md5, digest[:32]) if kind == 6 else (IndicatorType.sha1, digest[:40]) if kind == 7 else (IndicatorType.sha256, digest)
def seed(limit: int | None = None) -> int:
    limit = min(limit or settings.max_indicators, settings.max_indicators); rng = random.Random(1337); now = datetime.now(timezone.utc)
    with SessionLocal.begin() as db:
        existing = db.scalar(select(func.count()).select_from(Indicator)) or 0
        if existing >= limit: return 0
        source = db.scalar(select(Source).where(Source.name == "synthetic-seed"))
        if not source: source = Source(name="synthetic-seed", url="local://deterministic-generator", last_sync=now, status="online"); db.add(source); db.flush()
        families=[]; tags=[]
        for name in FAMILIES:
            obj=db.scalar(select(MalwareFamily).where(MalwareFamily.name == name)) or MalwareFamily(name=name); db.add(obj); families.append(obj)
        for name in TAGS:
            obj=db.scalar(select(Tag).where(Tag.name == name)) or Tag(name=name); db.add(obj); tags.append(obj)
        db.flush(); created=[]
        for i in range(existing, limit):
            typ,value=_value(i); age=rng.randrange(0,90); first=now-timedelta(days=age,hours=rng.randrange(24)); last=min(now,first+timedelta(days=rng.randrange(0,age+1))); verdict=Verdict.malicious if i%10<6 else Verdict.suspicious if i%10<8 else Verdict.unknown
            ind=Indicator(type=typ,value=value,first_seen=first,last_seen=last,confidence=88 if verdict==Verdict.malicious else 64 if verdict==Verdict.suspicious else 32,verdict=verdict); db.add(ind); db.flush(); created.append(ind)
            db.add(IndicatorSource(indicator_id=ind.id,source_id=source.id,first_seen=first,last_seen=last,raw={"synthetic":True,"seed_index":i})); db.add(IndicatorFamily(indicator_id=ind.id,family_id=families[i%len(families)].id)); db.add(IndicatorTag(indicator_id=ind.id,tag_id=tags[i%len(tags)].id))
            if typ==IndicatorType.ipv4:
                cc,lat,lon=COUNTRIES[(i//10)%len(COUNTRIES)]; db.add(IPGeo(ip=value,country_code=cc,lat=lat+rng.uniform(-3,3),lon=lon+rng.uniform(-3,3),asn=64512+i%32,as_name=f"Synthetic Transit {i%16}",synthetic=True))
            if len(created)>2 and typ==IndicatorType.url: db.add(Relationship(src_indicator_id=ind.id,dst_indicator_id=created[-2].id,relation_type="hosted_on",source_id=source.id))
            if i and i%5==0: db.add(Relationship(src_indicator_id=ind.id,dst_indicator_id=created[max(0,len(created)-5)].id,relation_type="same_family",source_id=source.id))
        source.last_sync=now; db.add(IngestionLog(source=source.name,level="warning",message="Generated deterministic synthetic fallback data; geo coordinates are synthetic",new_count=len(created),updated_count=0))
    print(f"WARNING: using synthetic-seed fallback; inserted {limit-existing} indicators"); return limit-existing
if __name__ == "__main__": seed()

