.PHONY: up seed ingest test reset-db
up:
	docker compose up --build
seed:
	docker compose exec api python -m ingest.seed
ingest:
	docker compose exec api python -m ingest.run --once
test:
	docker compose run --rm api pytest -q
	docker build --target test frontend
reset-db:
	docker compose down -v
	docker compose up --build

