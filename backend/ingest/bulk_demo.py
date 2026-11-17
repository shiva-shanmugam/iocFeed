"""One-shot, bounded-memory synthetic campaign import. No network or scheduler."""
import argparse
from contextlib import closing
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import random
from sqlalchemy import select, text
from app.core.config import settings
from app.core.database import engine, SessionLocal
from app.models import EvidenceSnapshot, Indicator
from app.services.replay import current_state
from ingest.seed import _value, FAMILIES, TAGS


# A snapshot is captured at import time. Source first_seen never becomes a capture date.
BASELINE_SQL = """
INSERT INTO evidence_snapshots (indicator_id, recorded_at, reason, simulated, state)
SELECT i.id, now(), 'initial recorded baseline', false,
 jsonb_build_object(
  'verdict', i.verdict, 'confidence', i.confidence, 'first_seen', i.first_seen, 'last_seen', i.last_seen,
  'sources', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'name', s.name, 'url', s.url, 'origin', COALESCE(o.raw->>'original_report_url',o.raw->>'report_id'),
    'fingerprint', md5(o.raw::text), 'synthetic', COALESCE((o.raw->>'synthetic')::boolean,false),
    'first_seen', o.first_seen, 'last_seen', o.last_seen,
    'excerpt', COALESCE(o.raw->>'description','Stored normalized source observation')
   ) ORDER BY s.name) FROM indicator_sources o JOIN sources s ON s.id=o.source_id WHERE o.indicator_id=i.id),'[]'::jsonb),
  'families', COALESCE((SELECT jsonb_agg(f.name ORDER BY f.name) FROM indicator_families x JOIN malware_families f ON f.id=x.family_id WHERE x.indicator_id=i.id),'[]'::jsonb),
  'tags', COALESCE((SELECT jsonb_agg(t.name ORDER BY t.name) FROM indicator_tags x JOIN tags t ON t.id=x.tag_id WHERE x.indicator_id=i.id),'[]'::jsonb),
  'relationships', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id', r.id, 'other_id', n.id, 'value', n.value, 'type', n.type, 'relation', r.relation_type
  ) ORDER BY r.id) FROM (SELECT * FROM relationships WHERE src_indicator_id=i.id OR dst_indicator_id=i.id ORDER BY id LIMIT 250) r
  JOIN indicators n ON n.id=CASE WHEN r.src_indicator_id=i.id THEN r.dst_indicator_id ELSE r.src_indicator_id END),'[]'::jsonb),
  'relationship_count', (SELECT count(*) FROM relationships WHERE src_indicator_id=i.id OR dst_indicator_id=i.id),
  'relationships_truncated', (SELECT count(*)>250 FROM relationships WHERE src_indicator_id=i.id OR dst_indicator_id=i.id)
 )
FROM indicators i WHERE i.id >= %s AND i.id < %s
AND NOT EXISTS (SELECT 1 FROM evidence_snapshots e WHERE e.indicator_id=i.id)
"""


def import_demo(count: int):
    rng = random.Random(2026)
    now = datetime.now(timezone.utc)
    inserted = 0
    with closing(engine.raw_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM indicators")
            existing = cur.fetchone()[0]
            count = max(0, min(count, settings.max_indicators - existing))
            cur.execute("SELECT COALESCE(max((raw->>'seed_index')::int),-1)+1 FROM indicator_sources WHERE raw ? 'seed_index'")
            start = cur.fetchone()[0]
            cur.execute("INSERT INTO sources(name,url,status,last_sync) VALUES ('synthetic-campaigns','local://campaign-fixtures','online',%s) ON CONFLICT(name) DO UPDATE SET last_sync=EXCLUDED.last_sync RETURNING id", (now,))
            source_id = cur.fetchone()[0]
            cur.execute("SELECT id,name FROM malware_families")
            family_map = {name: identifier for identifier, name in cur.fetchall()}
            cur.execute("SELECT id,name FROM tags")
            tag_map = {name: identifier for identifier, name in cur.fetchall()}
            cur.execute("CREATE TEMP TABLE demo_stage (idx int, type indicator_type, value text, first_seen timestamptz, last_seen timestamptz, confidence int, verdict verdict, host text, hub text, payload text)")
            conn.commit()
            for batch in range(start, start + count, 10_000):
                cur.execute("TRUNCATE demo_stage")
                with cur.copy("COPY demo_stage FROM STDIN") as copy:
                    for index in range(batch, min(batch + 10_000, start + count)):
                        kind, value = _value(index)
                        age = rng.randrange(1095)
                        first = now - timedelta(days=age, hours=rng.randrange(24))
                        last = min(now, first + timedelta(days=rng.randrange(age + 1)))
                        verdict = 'malicious' if index % 10 < 6 else 'suspicious' if index % 10 < 8 else 'unknown'
                        copy.write_row((index, kind.value, value, first, last, {'malicious':88,'suspicious':64,'unknown':32}[verdict], verdict,
                            _value(index - (1 if index % 10 == 4 else 2))[1] if kind.value == 'url' else None,
                            _value(index // 1000 * 1000)[1], _value(index // 10 * 10 + 4)[1]))
                cur.execute("INSERT INTO indicators(type,value,first_seen,last_seen,confidence,verdict) SELECT type,value,first_seen,last_seen,confidence,verdict FROM demo_stage ON CONFLICT(type,value) DO NOTHING")
                inserted += cur.rowcount
                cur.execute("CREATE TEMP TABLE demo_ids AS SELECT d.*,i.id FROM demo_stage d JOIN indicators i USING(type,value)")
                cur.execute("INSERT INTO indicator_sources(indicator_id,source_id,first_seen,last_seen,raw) SELECT id,%s,first_seen,last_seen,jsonb_build_object('synthetic',true,'seed_index',idx,'report_id','demo:campaign/'||(idx/1000)::text,'description','Generated campaign fixture; not an observed real-world threat.') FROM demo_ids ON CONFLICT DO NOTHING", (source_id,))
                cur.execute("INSERT INTO indicator_families SELECT id,(%s::int[])[idx %% 8 + 1] FROM demo_ids ON CONFLICT DO NOTHING", ([family_map[n] for n in FAMILIES],))
                cur.execute("INSERT INTO indicator_tags SELECT id,(%s::int[])[idx %% 6 + 1] FROM demo_ids ON CONFLICT DO NOTHING", ([tag_map[n] for n in TAGS],))
                # Shared campaign infrastructure creates real stored edges, with explicit demo provenance.
                for typ, target, relation, target_type in [('url','host','hosted_on','domain'),('domain','hub','resolves_to','ipv4')]:
                    cur.execute(f"INSERT INTO relationships(src_indicator_id,dst_indicator_id,relation_type,source_id) SELECT d.id,t.id,%s,%s FROM demo_ids d JOIN indicators t ON t.type=%s AND t.value=d.{target} WHERE d.type=%s AND d.id<>t.id ON CONFLICT DO NOTHING", (relation,source_id,target_type,typ))
                cur.execute("INSERT INTO relationships(src_indicator_id,dst_indicator_id,relation_type,source_id) SELECT d.id,t.id,'payload_of',%s FROM demo_ids d JOIN indicators t ON t.type='url' AND t.value=d.payload WHERE d.type IN ('md5','sha1','sha256') ON CONFLICT DO NOTHING", (source_id,))
                cur.execute("DROP TABLE demo_ids")
                conn.commit()
                print(f"demo import: {inserted:,} / {count:,} new IOCs committed", flush=True)
            cur.execute("SELECT min(id),max(id) FROM indicators")
            low, high = cur.fetchone()
            for lower in range(low or 1, (high or 0) + 1, 10_000):
                cur.execute(BASELINE_SQL, (lower, lower + 10_000))
                conn.commit()
                print(f"replay baseline: through IOC id {lower + 9_999:,}", flush=True)
            cur.execute("INSERT INTO ingestion_log(source,level,message,new_count,updated_count) VALUES ('synthetic-campaigns','warning','One-shot synthetic campaign import with explicit relationships and capture-time replay baselines',%s,0)", (inserted,))
            conn.commit()
    return inserted


def demo_history():
    """A small, visibly simulated walkthrough, never passed off as historical observations."""
    with SessionLocal.begin() as db:
        leaders = db.execute(text("SELECT node FROM (SELECT src_indicator_id node FROM relationships UNION ALL SELECT dst_indicator_id FROM relationships) e GROUP BY node ORDER BY count(*) DESC,node LIMIT 3")).scalars().all()
        now = datetime.now(timezone.utc)
        for iid in leaders:
            if db.scalar(select(EvidenceSnapshot.id).where(EvidenceSnapshot.indicator_id == iid, EvidenceSnapshot.simulated.is_(True)).limit(1)):
                continue
            state = current_state(db, iid)
            for days, confidence, verdict, amount, title in [(3,32,'unknown',1,'Demo: first report'),(2,64,'suspicious',8,'Demo: infrastructure linked'),(1,88,'malicious',40,'Demo: corroborating report')]:
                staged = deepcopy(state)
                staged.update(confidence=confidence,verdict=verdict,relationships=state['relationships'][:amount],relationship_count=min(amount,state['relationship_count']))
                if days == 1 and staged['sources']:
                    copied = deepcopy(staged['sources'][0])
                    copied['name'] = 'demo-mirror'
                    staged['sources'].append(copied)
                db.add(EvidenceSnapshot(indicator_id=iid, recorded_at=now-timedelta(days=days),reason=title,simulated=True,state=staged))
            print(f"replay walkthrough: {iid} {db.get(Indicator,iid).value}", flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--count', type=int, default=1_000_000)
    args = parser.parse_args()
    print(f"Inserted {import_demo(args.count):,} synthetic IOCs", flush=True)
    demo_history()
