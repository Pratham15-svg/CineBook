# CineBook Demo Guide

Stack: React (Vite), Node/Express, PostgreSQL 16, run with Docker Compose. Setup steps are in the main `README.md`.

## Start

```bash
cp .env.example .env
docker compose up --build -d
docker compose run --rm seed
docker compose ps
```
`db`, `backend` and `frontend` should all be up, with `db` healthy. If port 5432 is already in use, a local PostgreSQL is running; stop it first.

| Page | URL |
|---|---|
| App | http://localhost:8080 |
| Login | http://localhost:8080/login |
| Schedule show (manager) | http://localhost:8080/manager/schedule |
| API | http://localhost:5050/api/shows |

All passwords are `Password@123`: `customer1@cinebook.test`, `manager1@cinebook.test`, `admin@cinebook.test`. Log out between roles.

## Workflow 1: Book tickets (transaction)

1. Log in as `customer1@cinebook.test`.
2. Open Movies, choose a show and pick 2 seats. Optionally enter coupon `WELCOME10`.
3. Hold the seats, pay, then open **View My Bookings**.
4. Cancel the booking and check that the seats become available again.

The booking is created by `sp_create_booking` in one transaction. The price is copied into `booking_seat.list_price`, the hold lasts 10 minutes, and payment confirms it through `sp_confirm_booking`. A partial unique index stops two active bookings of the same seat.

```bash
docker compose exec db psql -U postgres -d cinebook -c "SELECT booking_id, user_id, status, total_amount, discount_amount FROM booking ORDER BY booking_id DESC LIMIT 5;"
docker compose exec db psql -U postgres -d cinebook -c "SELECT booking_id, old_status, new_status, changed_at FROM booking_audit ORDER BY audit_id DESC LIMIT 6;"
```
The second query shows the audit trigger logging every status change.

## Workflow 2: Admin analytics

1. Log in as `admin@cinebook.test`.
2. Open the Admin Dashboard: revenue per venue per month, occupancy per show, top movies per city, peak hours.

These come from views built on joins, `GROUP BY`, subqueries and CTEs.

```bash
docker compose exec db psql -U postgres -d cinebook -c "SELECT * FROM v_revenue_venue_month LIMIT 5;"
docker compose exec db psql -U postgres -d cinebook -c "SELECT * FROM v_top_movies_city LIMIT 8;"
docker compose exec db psql -U postgres -d cinebook -c "SELECT * FROM v_peak_hours LIMIT 6;"
docker compose exec db psql -U postgres -d cinebook -c "SELECT * FROM v_show_occupancy LIMIT 5;"
```

## Workflow 3: Constraint enforcement

1. Log in as `manager1@cinebook.test`.
2. Open **Schedule Show**, choose a screen, movie, a future start time and prices, and schedule it.
3. Submit the same screen and time again. The database rejects the overlapping show.

The overlap rule is an `EXCLUDE USING gist` constraint on `movie_show` (needs `btree_gist`). The application only passes the error on.

Run the 38 constraint tests (double booking, 7 seats, invalid price, expired coupon, overlapping show and more):
```bash
docker compose exec -T db psql -U postgres -d cinebook < db/tests/w3_tests.sql
```

## Database features

```bash
docker compose exec db psql -U postgres -d cinebook -c "\dt"
docker compose exec db psql -U postgres -d cinebook -c "\dv"
docker compose exec db psql -U postgres -d cinebook -c "SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY 1;"
docker compose exec db psql -U postgres -d cinebook -c "\df sp_*"
```
13 tables, 6 views, 6 triggers, 5 stored procedures, indexes, `CHECK`, `UNIQUE` and foreign key constraints, and the exclusion constraint.

## Performance

```bash
docker compose exec -T db psql -U postgres -d cinebook < db/tests/explain_comparison.sql
```
Compares the 8-table "naive" ticket query with the 2-table snapshot query. Details in `docs/phases/phase 5/EXPLAIN_COMPARISON.md`.

## Automated tests (Node.js 22+)

```bash
cd backend
node tests/integration_test.mjs
```
Expected: `30 passed, 0 failed`.

## Troubleshooting

- **Port 5432 in use:** stop the local PostgreSQL service.
- **Blank or stale page:** hard refresh the browser.
- **Odd data:** `docker compose down -v`, then start again and re-seed.
- **Backend errors:** `docker compose logs backend --tail 30`.

## After the demo

```bash
docker compose down
```

