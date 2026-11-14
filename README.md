# CineBook: Movie Ticket Booking System

CS F212 Database Systems, Group-17, BITS Pilani, Hyderabad Campus.

CineBook is a simplified BookMyShow. Customers search shows in their city, pick seats, pay and get a ticket. Venue managers schedule shows and set prices. Admins manage cities, venues, screens and movies, and view dashboards.

The focus of the project is the database. Booking rules such as "no two people can hold the same seat" and "shows cannot overlap on a screen" are enforced by PostgreSQL itself through constraints, triggers and stored procedures, not by application code.

## Tech stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL 16 |
| Backend | Node.js, Express, `pg` (no ORM), JWT, bcrypt |
| Frontend | React (Vite), React Router, Axios |
| Deployment | Docker Compose |

## Features

- **Customer:** register and log in, search shows by city, movie, language, date and price, pick seats on a seat map, apply a coupon, pay, view bookings, cancel with a refund.
- **Manager:** schedule shows, set per-category prices, view occupancy and revenue for their venue.
- **Admin:** manage cities, venues, screens and movies; dashboards for revenue per venue per month, show occupancy, top movies per city and peak hours.
- **Database rules:**
  - 13 tables with primary keys, foreign keys, `CHECK` and `UNIQUE` constraints.
  - An exclusion constraint (`btree_gist`) that blocks overlapping shows on a screen.
  - A partial unique index that prevents the same seat being actively booked twice.
  - 6 triggers: booking audit, seat release, seat count (1 to 6), manager role check, confirmation check, and a future-show check.
  - 5 stored procedures: create, confirm and cancel a booking, record a failed payment, and expire holds.
  - 6 views and a seat-map function for search, tickets and dashboards.

## Repository structure

```
CineBook/
├── backend/            Express API (controllers, routes, middleware, tests)
├── frontend/           React app (pages, components, styles)
├── db/
│   ├── 00_extensions.sql ... 05_indexes_views.sql
│   ├── setup.sh        runs all SQL files in order
│   ├── seed/           seed data generator
│   └── tests/          SQL tests and EXPLAIN ANALYZE script
├── docs/               design document, ER diagram, test reports, demo guide
├── docker-compose.yml
└── .env.example
```

## Running the project

Requirements: Docker Desktop with Compose. Node.js 22+ is only needed to run the backend test scripts.

1. Copy `.env.example` to `.env` and set your own `JWT_SECRET`.
2. Make sure ports 5432, 5050 and 8080 are free. Stop any local PostgreSQL first.
3. Start everything:
   ```bash
   docker compose up --build -d
   ```
   Wait until `docker compose ps` shows `db` as healthy. The SQL files in `db/` run automatically the first time the database starts.
4. Load the demo data (once):
   ```bash
   docker compose run --rm seed
   ```
5. Open http://localhost:8080. The API is at http://localhost:5050/api.

`docker compose down` stops the stack and keeps the data. `docker compose down -v` deletes the database.

### Running without Docker

```bash
createdb cinebook
cd db && ./setup.sh cinebook && cd ..
pip install -r db/seed/requirements.txt
python db/seed/generate_seed_data.py

cd backend
cp .env.example .env      # fill in your PostgreSQL details and a JWT secret
npm install
npm run dev

cd ../frontend
npm install
npm run dev               # http://localhost:5173, proxies /api to port 5050
```
Set `PORT=5050` in `backend/.env` so the frontend proxy finds it.

## Demo accounts

All passwords are `Password@123`.

| Role | Email |
|---|---|
| Customer | `customer1@cinebook.test` to `customer40@cinebook.test` |
| Manager | `manager1@cinebook.test` to `manager10@cinebook.test` (one venue each) |
| Admin | `admin@cinebook.test` |

## Testing

```bash
# API integration tests (30 checks), from backend/
node tests/integration_test.mjs

# Load test: path is relative to /api, requests, concurrency
node tests/load_test.mjs /shows 20 300

# Constraint tests (38 tests, rolls back, saves nothing)
docker compose exec -T db psql -U postgres -d cinebook < db/tests/w3_tests.sql

# Naive join vs snapshot read path
docker compose exec -T db psql -U postgres -d cinebook < db/tests/explain_comparison.sql
```

## Documentation

| File | Contents |
|---|---|
| `docs/CineBook_Final_Design_Document.pdf` | Design document |
| `docs/er_diagram.png` | ER diagram |
| `docs/DEMO_GUIDE.md` | Step-by-step demo |
| `docs/w3_test_log.txt` | Output of the constraint tests |
| `docs/phases/` | One summary per phase (database, seed data and tests, backend, frontend, integration and performance) |

## Team

| Member | Area |
|---|---|
| Pratham Singla | Core database design |
| Harinandha L | Requirements and rules |
| Imran Hafeez S | Application design |
| Arjun Rathore | Data plan and seed data |
| Sushanth Reddy Kompally | Queries, views and reporting |

## Final submission
Tag: `final` · Commit: `2389733`
