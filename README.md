# CineBook — Movie Ticket Booking System
### CS F212 Database Systems | Group-17 | BITS Pilani, Hyderabad Campus

This README explains, in plain simple English, **what the project is, what is already done, what is left, and exactly how to do each remaining part**, step by step. It is written so that any team member (even someone who joins late) can read it and start working without asking anyone.

---

## 1. What this project is (in one paragraph)

CineBook is a simplified version of BookMyShow. People can search movie shows in their city, pick seats, pay, and get a ticket. Venue managers can schedule shows. Admins can manage cities, venues, movies and see dashboards. The whole point of the project (for marks) is to show that we can **design a correct relational database** and **enforce rules using the database itself** (not just backend code) — things like "no two people can book the same seat" or "a show cannot overlap another show on the same screen."

---

## 2. Where we stand today (as of 18 October 2026)

**Done (mid-semester submission, already submitted on 11 Oct 2026):**
- Requirements and business rules
- ER/EER diagram
- Relational schema (13 tables) with keys and constraints planned
- Normalization write-up
- Application architecture plan (React + Node/Express + PostgreSQL)

**Not done yet (this is the real engineering work):**
- Actual SQL code: tables, triggers, procedures, views
- Seed data (fake data to test with)
- Backend (Node.js/Express) APIs
- Frontend (React)
- Testing everything together
- Final report + demo prep

---

## 3. Deadline and phase plan

**Final submission: 10 November 2026. Today: 18 October 2026. That gives us 23 days.**

The work is split into 6 phases. Each phase has a clear owner (based on each person's mid-sem contribution area) and a clear "done when" condition, so there's no confusion about who does what.

| Phase | Dates | Duration | Focus |
|---|---|---|---|
| Phase 1 | 18 – 22 Oct (5 days) | Database build-out | Turn the design into real SQL: tables, constraints, triggers, procedures |
| Phase 2 | 23 – 26 Oct (4 days) | Seed data + DB testing | Fill the database with fake data, test all constraints (W3 workflow) |
| Phase 3 | 27 Oct – 2 Nov (7 days) | Backend (Node/Express) | Build REST APIs for booking, search, admin dashboard |
| Phase 4 | 3 – 6 Nov (4 days) | Frontend (React) | Build the UI: search, seat map, booking flow, dashboards |
| Phase 5 | 7 – 8 Nov (2 days) | Integration + EXPLAIN ANALYZE | Connect frontend-backend-DB fully, run the performance comparison promised in the report |
| Phase 6 | 9 – 10 Nov (2 days) | Final report + buffer | Write final report, polish, rehearse demo, fix last bugs |

> Buffer note: Phase 6 is deliberately kept light on new work — it exists to absorb delays from earlier phases. If any phase overruns by 1–2 days, pull from Phase 6, not from Phase 3/4 (backend/frontend), since those take the longest to redo.

---

### Phase 1: Database build-out (18 – 22 Oct) — Owner: Pratham Singla (+ help from others)

**Goal:** Every table, constraint, trigger, and procedure mentioned in the mid-sem report actually exists and runs in PostgreSQL.

**Steps:**
1. Set up PostgreSQL 16 locally or via Docker Compose. Enable the `btree_gist` extension (needed for the exclusion constraint on overlapping shows).
2. Write the DDL (Data Definition Language — the `CREATE TABLE` statements) for all 13 relations, in this order (so foreign keys don't fail):
   `APP_USER → CITY → VENUE → SCREEN → SEAT → MOVIE → MOVIE_SHOW → SHOW_PRICE → COUPON → BOOKING → BOOKING_SEAT → PAYMENT → BOOKING_AUDIT`
3. Add all constraints as you create each table: `NOT NULL`, `CHECK`, `UNIQUE`, and the exclusion constraint on `MOVIE_SHOW` to stop overlapping shows.
4. Write triggers:
   - Audit trigger: writes a row to `BOOKING_AUDIT` whenever `BOOKING.status` changes.
   - Seat-count trigger: rejects a booking with less than 1 or more than 6 seats.
   - Manager-check trigger: rejects assigning a `VENUE.manager_id` to a user who isn't role `MANAGER`.
   - `is_active` trigger: sets `BOOKING_SEAT.is_active = false` when a booking becomes `CANCELLED` or `EXPIRED`.
   - Confirmation trigger (deferred constraint trigger): checks that a `CONFIRMED` booking has a successful payment matching `total_amount`, and all seats have `price_paid` filled in correctly.
5. Write stored procedures:
   - Booking procedure (hold seats → copy `list_price` → apply coupon → compute `total_amount`).
   - Confirmation procedure (on successful payment → sets `price_paid` per seat).
   - Cancellation/refund procedure (checks the 2-hour cutoff rule, computes refund, updates payment).
6. Save all SQL in a `db/` folder in the GitHub repo, split into numbered files, e.g. `01_tables.sql`, `02_constraints.sql`, `03_triggers.sql`, `04_procedures.sql`. Numbering keeps the run order clear.

**Done when:** You can run all SQL files on an empty database with zero errors, and manually inserting a conflicting row (e.g. same seat twice for a show) gets correctly rejected by the database.

---

### Phase 2: Seed data + DB testing (23 – 26 Oct) — Owner: Arjun Rathore (data-population plan owner) + Sushanth

**Goal:** A realistic test database (500+ records) and proof that every rule in the report actually works.

**Steps:**
1. Write a Python script using the `Faker` library to generate realistic fake data: cities, venues, screens, seats, movies, shows, users, bookings.
2. Insert data in the same dependency order as Phase 1 (cities before venues, etc.).
3. Run the W3 workflow tests manually or as a script:
   - Try to create two overlapping shows on the same screen → should fail.
   - Try to double-book the same seat for the same show → should fail.
   - Try to book 7 seats in one booking → should fail.
   - Try an invalid price (≤ 0) → should fail.
   - Try an expired coupon → should fail.
4. Document each test with a screenshot or copy-pasted error message — these go straight into the final report as proof the constraints work.

**Done when:** The database has 500+ rows across all tables, and you have a written log of every W3 test case passing (i.e., correctly rejecting bad data).

---

### Phase 3: Backend — Node.js + Express (27 Oct – 2 Nov) — Owner: Imran Hafeez S (architecture owner) + Pratham for DB-heavy endpoints

**Goal:** REST APIs that let the frontend do everything a customer, manager, and admin need.

**Steps:**
1. Set up an Express project with `node-postgres` (`pg`). No ORM — use parameterised SQL as planned, so you keep full control over transactions.
2. Set up JWT authentication with `bcrypt` for password hashing. Add role-based middleware (customer / manager / admin).
3. Build the core booking transaction (this is the most important and most graded part):
   - `POST /shows/search` — filter by city, movie, language, date, price.
   - `POST /bookings` — hold seats, copy `list_price`, apply coupon if given. This must be a single database transaction: if anything fails partway, roll back.
   - `POST /bookings/:id/pay` — simulate payment, confirm booking, set `price_paid`.
   - `POST /bookings/:id/cancel` — cancellation + refund logic.
   - `GET /bookings/:id` and `GET /me/bookings` — the fast read-paths described in the report (should only touch `BOOKING` and `BOOKING_SEAT`, no extra joins).
4. Build manager APIs: schedule shows, set prices, view own venue's occupancy/revenue.
5. Build admin APIs: manage cities/venues/screens/movies, dashboard queries (revenue per venue per month, occupancy per show, top 3 movies per city, peak hours). These should use views and CTEs as planned in the report.
6. Test every endpoint with Postman or similar before moving to frontend.

**Done when:** All endpoints work correctly against the seeded database, and the booking transaction correctly rolls back on simulated payment failure.

---

### Phase 4: Frontend — React (3 – 6 Nov) — Owner: Harinandha L (requirements/UX owner) + Imran

**Goal:** A working UI so the system can be demoed, not just tested via Postman.

**Steps:**
1. Set up React with Vite, and Axios for calling the backend.
2. Build customer pages: login/register, search shows, seat map (visually show which seats are taken), checkout with coupon, booking history, cancel button.
3. Build manager pages: schedule a show, set per-category prices, view own revenue/occupancy.
4. Build admin pages: manage cities/venues/movies, dashboard charts (even simple tables/bar charts are fine — the DBMS logic is what's graded, not frontend polish).
5. Add role-based routing so each user type only sees their own pages.

**Done when:** A person can, from the browser with no technical knowledge, search a show, book seats, pay, see the ticket, and cancel it.

---

### Phase 5: Integration + performance comparison (7 – 8 Nov) — Owner: Whole team together

**Goal:** Everything connected and the performance claim in the report proven with real numbers.

**Steps:**
1. Run frontend + backend + database together (Docker Compose makes this easier — one command starts everything).
2. Walk through all three workflows (W1 booking, W2 dashboard, W3 constraint tests) end-to-end through the UI, not just via API calls.
3. Run `EXPLAIN ANALYZE` on:
   - The "naive" ticket query (joining `APP_USER`, `BOOKING`, `BOOKING_SEAT`, `SEAT`, `MOVIE_SHOW`, `MOVIE`, `SCREEN`, `VENUE`)
   - The actual snapshot-based query used in the app (just `BOOKING` + `BOOKING_SEAT`)
   Save both query plans and compare execution time — this becomes a table/graph in the final report.
4. Fix any bugs found during this full walkthrough.

**Done when:** You can do a full demo run without errors, and you have the `EXPLAIN ANALYZE` comparison numbers written down.

---

### Phase 6: Final report + demo rehearsal (9 – 10 Nov) — Owner: Whole team together

**Goal:** Submit a polished report and be ready to present confidently.

**Steps:**
1. Update the mid-sem report with: final schema (if anything changed), actual SQL code snippets, screenshots of the UI, the W3 constraint test results, and the `EXPLAIN ANALYZE` comparison.
2. Push everything to GitHub (`https://github.com/Pratham15-svg/CineBook`), organised into clear folders (see Section 5 below).
3. Rehearse the demo once as a team — decide who shows which workflow (W1, W2, W3) live.
4. Final check: does the README (this file) in the repo actually let someone set up the project from scratch by following it?

**Done when:** Report is submitted, repo is clean and pushed, and the team has done at least one full dry-run demo.

---

## 4. Suggested folder structure for the GitHub repo

```
CineBook/
├── README.md              <- this file
├── docs/
│   ├── CineBook_MidSem_Report.pdf
│   └── ER_diagram.png
├── db/
│   ├── 01_tables.sql
│   ├── 02_constraints.sql
│   ├── 03_triggers.sql
│   ├── 04_procedures.sql
│   └── seed/
│       └── generate_seed_data.py
├── backend/
│   ├── src/
│   └── package.json
├── frontend/
│   ├── src/
│   └── package.json
└── docker-compose.yml
```

---

## 5. How to run the project locally (fill this in as each part is built)

1. **Start the database:**
   ```
   docker compose up -d db
   ```
2. **Load the schema and seed data:**
   ```
   psql -U postgres -d cinebook -f db/01_tables.sql
   psql -U postgres -d cinebook -f db/02_constraints.sql
   psql -U postgres -d cinebook -f db/03_triggers.sql
   psql -U postgres -d cinebook -f db/04_procedures.sql
   python db/seed/generate_seed_data.py
   ```
3. **Start the backend:**
   ```
   cd backend
   npm install
   npm run dev
   ```
4. **Start the frontend:**
   ```
   cd frontend
   npm install
   npm run dev
   ```
5. Open the frontend URL shown in the terminal (usually `http://localhost:5173`) in your browser.

*(Update the exact commands once the backend/frontend are actually scaffolded — this section is a placeholder to be filled in during Phase 3 and 4.)*

---

## 6. Quick reference — who owns what phase

| Member | Mid-sem role | Phase(s) to lead |
|---|---|---|
| Pratham Singla | Core DB design | Phase 1 (lead), Phase 3 (DB-heavy endpoints), GitHub repository setup (repo creation, folder structure, commits, `final` tag) |
| Harinandha L | Requirements/rules | Phase 4 (lead), Phase 5 |
| Imran Hafeez S | Application design | Phase 3 (lead), Phase 4 |
| Arjun Rathore | GitHub/data plan | Phase 2 (lead), repo upkeep throughout |
| Sushanth Reddy Kompally | Queries/views/reporting | Phase 2, Phase 3 (dashboard queries/views) |

Everyone is together for Phase 5 and Phase 6 — integration and the final push always need the whole team.

---

*If a phase is running late, flag it in the team chat as soon as you notice — don't wait till the phase deadline. Two days of slack is built into Phase 6, but only if problems are caught early.*
