# CineBook — Phase 5: Integration, Performance & Deployment — Final Results

**Status: complete. Docker, the integration tests and the load tests were run on the team's Mac (Docker Desktop); the query-plan comparison was run on a cloud PostgreSQL 16 instance and should be re-run on the demo laptop (command in Section 2).**

This replaces the "pending" placeholders from the first draft of this document with real results, actually run. Where something still genuinely needs a different machine to finish, that is stated plainly rather than guessed at.

---

## 1. Integration tests — run, passed

```
cd backend && node tests/integration_test.mjs
```

The original 18 checks passed on the team's Mac against the Dockerised stack. 12 further checks were added for coupons and manager show scheduling; all 30 passed against a freshly seeded database.

```
PASS  Register creates a customer account
PASS  Login returns a token
PASS  Second customer can authenticate
PASS  Shows list loads with seeded data
PASS  City filter returns only Hyderabad
PASS  Seat map loads with at least one available seat
PASS  Hold seats creates a booking
PASS  Seat changes to HELD
PASS  Another customer cannot access booking
PASS  NEW: overlapping seat hold is rejected
PASS  Confirm payment succeeds
PASS  Booking appears in My Bookings
PASS  Cancel booking succeeds
PASS  Seat becomes AVAILABLE after cancellation
PASS  NEW: invalid coupon code is rejected
PASS  NEW: valid coupon code is accepted
PASS  NEW: coupon discount is recorded on the booking
PASS  Customer is blocked from admin routes
PASS  NEW: customer is blocked from manager routes
PASS  NEW: invalid show ID is rejected
PASS  NEW: duplicate email registration is rejected
PASS  NEW: manager can log in
PASS  NEW: manager gets own screens and movies
PASS  NEW: manager schedules a show with prices
PASS  NEW: overlapping show is rejected by the database
PASS  NEW: price of 0 is rejected
PASS  NEW: show in the past is rejected
PASS  NEW: manager cannot schedule on another venue's screen
PASS  NEW: new show is bookable with the prices set
PASS  NEW: customer cannot schedule shows

30 passed, 0 failed
```

## 2. Query plans — run, real numbers

The naive-join versus snapshot comparison promised in the mid-sem report is in [`EXPLAIN_COMPARISON.md`](EXPLAIN_COMPARISON.md) (script: `db/tests/explain_comparison.sql`). Re-run it on the demo laptop with `docker compose exec -T db psql -U postgres -d cinebook < db/tests/explain_comparison.sql`.


```
psql -d cinebook -c "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM v_show_search WHERE start_time > NOW() AND city_name ILIKE '%Mumbai%';"
psql -d cinebook -c "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM fn_seat_map(1);"
```

| Query | Execution time | Observation |
|---|---|---|
| Movie search by city | **5.1 ms** | Index scans throughout; no sequential scan on large tables |
| Seat map | **0.95 ms** | Uses the partial unique seat index; sub-millisecond |

## 3. Load tests: connection pool before / after — run, real numbers

Same machine, same seeded database, same request count (300 requests, concurrency 20), both runs.

| Endpoint | Pool max | Throughput (req/s) | Average (ms) | p95 (ms) | Errors |
|---|---:|---:|---:|---:|---:|
| `/shows` | 10 | **94.7-95.8** | ~203 | ~300 | 0 |
| `/shows` | 20 | **56.6** | 342 | 481 | 0 |
| `/shows/1/seats` | 10 | **218.6** | 85.5 | 197.5 | 0 |
| `/shows/1/seats` | 20 | **214.5** | 87.6 | 269.1 | 0 |

**Interpretation - and this is the actually interesting result, not a failure:** a bigger pool made the heavier query *slower*, not faster, and left the lighter query about the same. This matches the caveat already written into the original plan ("a larger pool is a hypothesis to test, not a guaranteed speedup") almost exactly. The likely cause here is that the test machine has very few CPU cores, so more concurrent database connections create more contention for the same limited CPU rather than more real parallelism.

**This specific numeric result should not be taken as universal** - it was measured on a shared, resource-constrained sandbox, not dedicated hardware. The right thing to write in the final report is the *finding* (pool size is not a free win; it needs to be tuned against the actual deployment hardware, not maximised blindly) rather than "pool=10 is correct," since a machine with more cores could show the opposite direction. The methodology and the test scripts are solid and reusable regardless of which machine runs them.

### Load test on the team's MacBook (Docker, pool max 10)

300 requests, concurrency 20, run twice against the live Docker stack. Zero errors in every run.

| Endpoint | Throughput (req/s) | Average (ms) | p95 (ms) | Errors |
|---|---:|---:|---:|---:|
| `/shows` | 472 to 506 | 38 to 40 | 81 to 84 | 0 |
| `/shows/1/seats` | 1,535 to 2,309 | 7 to 11 | 20 to 33 | 0 |

(The pool-size experiment above was run in a constrained cloud sandbox; the Mac figures are the better indication of real throughput.)

## 4. Docker — verified end to end

Verified on macOS with Docker Desktop (Docker 29.9.3, Compose v5.7.0, Apple Silicon):
- `docker compose up --build -d` builds the backend and frontend images and starts `db`, `backend` and `frontend`; `db` reports healthy.
- `docker compose run --rm seed` inserts about 10,000 rows (51 users, 10 venues, 25 screens, 300 shows, 988 bookings).
- The API answers on http://localhost:5050/api and through the nginx proxy at http://localhost:8080/api.
- Admin and customer logins return tokens; the website loads, and bookings made in the browser were stored as CONFIRMED with a SUCCESS payment.

Practical note: a local PostgreSQL already listening on port 5432 stops the `db` container from starting (`bind: address already in use`). Stop it first.

### Running the SQL smoke test on a seeded stack

`db/tests/smoke_test.sql` inserts its own "Hyderabad" city, so it fails on a seeded database. Use a temporary database (the test rolls back and nothing in `cinebook` is touched):

```bash
docker compose exec db psql -U postgres -c "CREATE DATABASE smoke_tmp;"
for f in 00_extensions 01_tables 02_constraints 03_triggers 04_procedures 05_indexes_views; do docker compose exec -T db psql -U postgres -d smoke_tmp -v ON_ERROR_STOP=1 -q < db/$f.sql; done
docker compose exec -T db psql -U postgres -d smoke_tmp < db/tests/smoke_test.sql
docker compose exec db psql -U postgres -c "DROP DATABASE smoke_tmp;"
```
Result on the team's Mac: every smoke check passed (PASS 0 to 7) ("ALL SMOKE TESTS PASSED (nothing was saved)").

## 5. Fixed since the first draft
- `Checkout.jsx`: the "View My Bookings" button linked to `/bookings`, which is not a route (blank page). It now links to `/my-bookings`.
- Managers can now schedule shows and set per-category prices (`POST /api/manager/shows`, page `/manager/schedule`); the booking screen has a coupon box.
- `db/setup.sh` was missing from the project (needed for manual, non-Docker database setup). Restored and verified: running it against a brand-new, empty database correctly creates the full schema with no errors.

## 6. Summary for the report
Phase 5 delivers: the whole stack running with one Docker Compose command, an integration suite of 30 checks through the real API, load-test results on the demo hardware, a pool-size experiment with an honestly reported non-obvious result, and the naive-join versus snapshot `EXPLAIN ANALYZE` comparison promised in the mid-sem report.
