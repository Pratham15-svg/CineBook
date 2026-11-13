# CineBook: Demo Runbook (terminal + browser)

Group-17, CS F212 Database Systems, BITS Pilani Hyderabad. Stack: React (Vite) + Node/Express + PostgreSQL 16, run with Docker Compose.

## A. Before the demo (do this once, 10 minutes early)

Open Docker Desktop and wait until it says it is running. Then in Terminal:

```bash
cd ~/Downloads
docker compose -p cinebook down -v
rm -rf CineBook
unzip -q CineBook_FINAL_complete.zip
cd CineBook
cp .env.example .env
lsof -nP -iTCP:5432 -sTCP:LISTEN
```
The last command should print nothing. If it prints a `postgres` line, run `kill <PID>` with the number shown.

```bash
docker compose up --build -d
until [ "$(docker inspect -f '{{.State.Health.Status}}' cinebook-db-1)" = "healthy" ]; do sleep 2; done
docker compose run --rm seed
docker compose ps
```
All three services (`db`, `backend`, `frontend`) should be up, `db` healthy.

```bash
printf "\nApp:      http://localhost:8080\nLogin:    http://localhost:8080/login\nSchedule: http://localhost:8080/manager/schedule\nAPI:      http://localhost:5050/api/shows\n\nAll passwords: Password@123\n  customer: customer1@cinebook.test\n  manager:  manager1@cinebook.test\n  admin:    admin@cinebook.test\n\n"
open http://localhost:8080/login
```

## B. Demo script

### Workflow 1: Book tickets (transaction)
1. Log in as `customer1@cinebook.test` / `Password@123`.
2. Open Movies, choose a show, pick 2 seats. Optional: enter coupon `WELCOME10`.
3. Hold seats, pay, then click **View My Bookings** and show the new booking.
4. Cancel it and show the seat becomes available again.

Say: the booking is created by the stored procedure `sp_create_booking` in one transaction. The price is copied into `booking_seat.list_price`, the hold lasts 10 minutes, and payment confirms it through `sp_confirm_booking`. A partial unique index stops two active bookings of the same seat.

Show in the terminal:
```bash
docker compose exec db psql -U postgres -d cinebook -c "SELECT booking_id, user_id, status, total_amount, discount_amount FROM booking ORDER BY booking_id DESC LIMIT 5;"
docker compose exec db psql -U postgres -d cinebook -c "SELECT booking_id, old_status, new_status, changed_at FROM booking_audit ORDER BY audit_id DESC LIMIT 6;"
```
The second query shows the audit trigger logging every status change.

### Workflow 2: Admin analytics (complex retrieval)
1. Log out, log in as `admin@cinebook.test`.
2. Open the Admin Dashboard: revenue per venue per month, occupancy per show, top movies per city, peak hours.

Say: these come from views built on joins, GROUP BY, subqueries and CTEs.

Show in the terminal:
```bash
docker compose exec db psql -U postgres -d cinebook -c "SELECT * FROM v_revenue_venue_month LIMIT 5;"
docker compose exec db psql -U postgres -d cinebook -c "SELECT * FROM v_top_movies_city LIMIT 8;"
docker compose exec db psql -U postgres -d cinebook -c "SELECT * FROM v_peak_hours LIMIT 6;"
docker compose exec db psql -U postgres -d cinebook -c "SELECT * FROM v_show_occupancy LIMIT 5;"
```

### Workflow 3: Constraint enforcement
1. Log out, log in as `manager1@cinebook.test`.
2. Open **Schedule Show**, choose a screen, movie, a future start time and prices, then schedule it.
3. Submit the same screen and time again: the database rejects the overlapping show.

Say: the overlap rule is an `EXCLUDE USING gist` constraint on `movie_show` (needs `btree_gist`); the application only passes the error on.

Show the 38-test constraint log (double booking, 7 seats, bad price, expired coupon, overlapping show):
```bash
docker compose exec -T db psql -U postgres -d cinebook < db/tests/w3_tests.sql
```

## C. DBMS features to point out
```bash
docker compose exec db psql -U postgres -d cinebook -c "\dt"
docker compose exec db psql -U postgres -d cinebook -c "\dv"
docker compose exec db psql -U postgres -d cinebook -c "SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY 1;"
docker compose exec db psql -U postgres -d cinebook -c "\df sp_*"
```
13 tables, 6 views, 5 triggers, 3 booking procedures plus hold-expiry and failed-payment procedures, indexes, CHECK, UNIQUE and foreign keys, and the exclusion constraint.

## D. Performance (EXPLAIN ANALYZE)
```bash
docker compose exec -T db psql -U postgres -d cinebook < db/tests/explain_comparison.sql
```
Compare the 8-table "naive" ticket query with the snapshot query (2 tables). Details: `docs/phase5/EXPLAIN_COMPARISON.md`.

## E. Automated tests (optional, needs Node 22+)
```bash
cd backend
node tests/integration_test.mjs
cd ..
```
Expected: `30 passed, 0 failed`.

## F. Logins
| Role | Email | Notes |
|---|---|---|
| Customer | `customer1@cinebook.test` to `customer40@cinebook.test` | book, pay, cancel |
| Manager | `manager1@cinebook.test` to `manager10@cinebook.test` | one venue each; `manager1` runs Cineplex Gachibowli |
| Admin | `admin@cinebook.test` | cities, venues, screens, movies, dashboards |

Password for all: `Password@123`. Log out between roles.

## G. If something goes wrong
- **Port 5432 already in use:** a local PostgreSQL is running. Find it with `lsof -nP -iTCP:5432 -sTCP:LISTEN` and `kill <PID>`.
- **Blank or stale page:** hard-refresh with `Cmd+Shift+R`.
- **Anything odd with the data:** `docker compose down -v`, then repeat Section A.
- **Backend errors:** `docker compose logs backend --tail 30`.

## H. After the demo
```bash
docker compose down
```
