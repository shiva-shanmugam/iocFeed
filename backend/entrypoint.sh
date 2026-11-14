#!/bin/sh
set -eu
alembic upgrade head
python -m ingest.bootstrap
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

