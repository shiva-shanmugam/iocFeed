import argparse
from app.core.config import settings
from ingest.adapters import ADAPTERS
from ingest.seed import seed
from ingest.service import ingest_items, log_failure

def run_once():
    if not settings.abusech_auth_key:
        print("WARNING: ABUSECH_AUTH_KEY missing; using synthetic fallback"); seed(); return
    any_success=False
    for adapter_cls in ADAPTERS:
        adapter=adapter_cls(settings.abusech_auth_key)
        try:
            items=adapter.collect(); new,updated=ingest_items(adapter.name,adapter.url,items); print(f"{adapter.name}: {new} new, {updated} updated"); any_success=True
        except Exception as exc:
            print(f"{adapter.name}: ERROR {exc}"); log_failure(adapter.name,str(exc))
    if not any_success:
        print("WARNING: all feeds unavailable; using synthetic fallback"); seed()

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--once",action="store_true"); parser.parse_args(); run_once()
if __name__ == "__main__": main()

