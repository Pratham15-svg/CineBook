# CineBook Phase 5: run guide

Requirements: Docker Desktop with Compose; optionally Node.js 22+ for the test scripts.

1. Copy `.env.example` to `.env` and set a unique `JWT_SECRET`.
2. Make sure ports 5432, 5050 and 8080 are free (stop any local PostgreSQL).
3. Run `docker compose up --build -d` from this directory, then wait until `docker compose ps` shows `db` as healthy.
4. Run `docker compose run --rm seed` once to insert demo data.
5. Visit http://localhost:8080. All demo passwords are `Password@123`:
   - customer: `customer1@cinebook.test`
   - manager: `manager1@cinebook.test` (Manager Dashboard and Schedule Show)
   - admin: `admin@cinebook.test`
6. Run the tests on the host from `backend/` (Node.js 22+):
   - `node tests/integration_test.mjs` (30 checks)
   - `node tests/load_test.mjs /shows 20 300`
   - `node tests/load_test.mjs /shows/1/seats 20 300`
7. Query-plan comparison: `docker compose exec -T db psql -U postgres -d cinebook < db/tests/explain_comparison.sql` (write-up in `docs/phase5/EXPLAIN_COMPARISON.md`; other results in `docs/phase5/PHASE_5_RESULTS.md`).

Note: the load-test path is relative to `/api`, so use `/shows`, not `/api/shows`.

`docker compose down` stops the stack and keeps the data. `docker compose down -v` **deletes the database**; only do this if you want to discard all local data.
