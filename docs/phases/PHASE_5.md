# Phase 5: Integration and performance

**Owner:** Whole team · **Needs:** Phases 1 to 4 · **Query plan write-up:** [`EXPLAIN_COMPARISON.md`](EXPLAIN_COMPARISON.md)

## What this phase is about
Running the database, backend and frontend together with one command, testing the full flow through the real API, measuring performance, and fixing what the full walkthrough found.

## What was added
- `docker-compose.yml`: starts `db`, `backend`, `frontend`, plus a `seed` service for demo data. The SQL files in `db/` run automatically the first time the database starts.
- `backend/tests/integration_test.mjs`: 30 API checks.
- `backend/tests/load_test.mjs`: simple load test.
- `db/tests/explain_comparison.sql`: naive join versus snapshot read path.
- `.env.example` and the Dockerfiles for the backend, frontend and seed.

## Integration tests
```bash
cd backend && node tests/integration_test.mjs
```
Run against a freshly seeded database: **30 passed, 0 failed**. They cover registration and login, show search, seat map, hold, confirm and cancel, coupons, role restrictions, duplicate email, and manager show scheduling (overlap, price 0, past show, another venue's screen).

## Query plans
See [`EXPLAIN_COMPARISON.md`](EXPLAIN_COMPARISON.md) for the 8-table naive ticket query against the 2-table snapshot query. Other plans checked:

| Query | Execution time | Observation |
|---|---|---|
| Movie search by city (`v_show_search`) | 5.1 ms | Index scans throughout, no sequential scan on large tables |
| Seat map (`fn_seat_map(1)`) | 0.95 ms | Uses the partial unique seat index |

## Load tests
300 requests at concurrency 20, zero errors in every run. Usage: `node tests/load_test.mjs <path> <concurrency> <requests>`, where the path is relative to `/api` (use `/shows`, not `/api/shows`).

**Connection pool size** (small cloud sandbox with few CPU cores):

| Endpoint | Pool max | Throughput (req/s) | Average (ms) | p95 (ms) |
|---|---:|---:|---:|---:|
| `/shows` | 10 | 94.7 to 95.8 | ~203 | ~300 |
| `/shows` | 20 | 56.6 | 342 | 481 |
| `/shows/1/seats` | 10 | 218.6 | 85.5 | 197.5 |
| `/shows/1/seats` | 20 | 214.5 | 87.6 | 269.1 |

A larger pool made the heavier query slower and left the lighter one unchanged. With few CPU cores, more connections compete for the same CPU. Pool size should be tuned for the hardware, not maximised.

**Docker stack on a MacBook** (pool max 10):

| Endpoint | Throughput (req/s) | Average (ms) | p95 (ms) |
|---|---:|---:|---:|
| `/shows` | 472 to 506 | 38 to 40 | 81 to 84 |
| `/shows/1/seats` | 1,535 to 2,309 | 7 to 11 | 20 to 33 |

## Docker verification
- `docker compose up --build -d` builds the images and starts all services, with `db` healthy.
- `docker compose run --rm seed` inserts about 10,000 rows (51 users, 10 venues, 25 screens, 300 shows, 988 bookings).
- The API answers at http://localhost:5050/api and through nginx at http://localhost:8080/api.
- Bookings made in the browser are stored as `CONFIRMED` with a `SUCCESS` payment.

A local PostgreSQL already listening on port 5432 stops the `db` container from starting. Stop it first.

### SQL smoke test on a seeded database
`db/tests/smoke_test.sql` inserts its own "Hyderabad" city, so run it on a temporary database. It rolls back, and `cinebook` is untouched.
```bash
docker compose exec db psql -U postgres -c "CREATE DATABASE smoke_tmp;"
for f in 00_extensions 01_tables 02_constraints 03_triggers 04_procedures 05_indexes_views; do docker compose exec -T db psql -U postgres -d smoke_tmp -v ON_ERROR_STOP=1 -q < db/$f.sql; done
docker compose exec -T db psql -U postgres -d smoke_tmp < db/tests/smoke_test.sql
docker compose exec db psql -U postgres -c "DROP DATABASE smoke_tmp;"
```
Expected: `ALL SMOKE TESTS PASSED (nothing was saved)`.

## Fixes made during integration
- `Checkout.jsx`: "View My Bookings" linked to `/bookings`, which is not a route. It now links to `/my-bookings`.
- Managers can schedule shows and set per-category prices (`POST /api/manager/shows`, page `/manager/schedule`).
- The seat selection page has a coupon box.
- `db/setup.sh` was missing and has been restored. Running it on an empty database creates the full schema with no errors.
