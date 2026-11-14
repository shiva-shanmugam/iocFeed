.PHONY: up seed ingest test reset-db
up:
	docker compose up --build
seed:
	docker compose exec api python -m ingest.seed
ingest:
	docker compose exec api python -m ingest.run --once
test:
	docker compose exec api pytest -q
	docker compose exec frontend npm test -- --run
reset-db:
	docker compose down -v
	docker compose up --build

