# Phase 2: Indexes, views, seed data and constraint testing

**Owner:** Arjun Rathore · **Needs:** Phase 1 (`db/00` to `db/04`) · **Test write-up:** [`W3_TEST_REPORT_SECTION.md`](W3_TEST_REPORT_SECTION.md)

## What this phase is about
Phase 1 built the schema, triggers and booking procedures. Phase 2 makes the database ready for the backend and proves that it enforces the rules. It has three parts:

1. **Fill the gaps found in the Phase 1 SQL** (`db/05_views_indexes.sql`): indexes, the "show must be in the future" rule, the hold-expiry and failed-payment procedures, and the read queries the app needs.
2. **Seed the database** with about 10,000 rows of realistic fake data (`db/seed/`).
3. **Try to break the database on purpose** (workflow W3): 38 tests, all passing (`db/tests/w3_tests.sql`).

## What changed

### Updated files
- `db/04_procedures.sql`: `sp_expire_holds` is no longer defined here; it moved to `db/05_views_indexes.sql` (now with an INOUT count of expired bookings). `sp_create_booking` runs the same expiry update inline at the start of each booking attempt instead of calling the procedure. `sp_confirm_booking` still only raises "hold has expired" (an UPDATE before the RAISE would be rolled back with the error), and its comment now points to `05_views_indexes.sql`.
- `db/05_views_indexes.sql`: rewritten (see below). The three Phase 1 views are replaced by the new set, and `sp_expire_holds` now lives here.
- `README.md`: progress table, project structure and setup instructions updated.

### What `db/05_views_indexes.sql` now contains
| Part | What it adds |
|---|---|
| Indexes | Foreign-key and search indexes on `MOVIE_SHOW`, `VENUE`, `BOOKING`, `PAYMENT`, `BOOKING_AUDIT`; a partial index on HELD bookings for the expiry sweep; a unique index on `lower(email)` |
| Future-show rule | Trigger `trg_booking_show_in_future` rejects a booking for a show that has already started. The seed script bypasses it per transaction with `cinebook.allow_past_booking = 'on'`; the app never does |
| `sp_expire_holds` | Marks HELD bookings past their 10-minute hold as EXPIRED and returns how many; existing triggers free the seats and write the audit row |
| `sp_record_failed_payment` | Rule R7: stores a FAILED payment for a HELD booking so a retry becomes a new payment row |
| `v_show_search` | Show search: movie, venue, city, price range, total / taken / available seats |
| `fn_seat_map(show_id)` | Seat map per show: AVAILABLE, HELD or BOOKED (expired holds count as available) |
| `v_ticket` | Ticket and "my bookings" read path using only `BOOKING` and `BOOKING_SEAT` |
| `v_revenue_venue_month`, `v_show_occupancy`, `v_top_movies_city`, `v_peak_hours` | Dashboard views (months and hours in India time) |

### New files
- `db/seed/generate_seed_data.py` and `db/seed/requirements.txt`: seed generator. Reference data is inserted directly; bookings go through the stored procedures so every trigger and rule is exercised, then timestamps are back-dated for dashboard history.
- `db/tests/smoke_test.sql`: quick hold, pay, cancel check (needs an empty database).
- `db/tests/step1_test.sql`: checks everything in `05` (needs an empty database).
- `db/tests/w3_tests.sql`: the 38 W3 constraint tests (works on empty or seeded database).
- `docs/w3_test_log.txt`: saved output of the W3 run.
- `docker-compose.yml` and `env.example`: start PostgreSQL and auto-run `db/00` to `db/05` on first start.

## Results
| Table | Rows | | Table | Rows |
|---|---|---|---|---|
| APP_USER | 51 | | COUPON | 5 |
| CITY | 5 | | BOOKING | 988 |
| VENUE | 10 | | BOOKING_SEAT | 2,733 |
| SCREEN | 25 | | PAYMENT | 1,014 |
| SEAT | 1,970 | | BOOKING_AUDIT | 2,028 |
| MOVIE | 20 | | SHOW_PRICE | 900 |
| MOVIE_SHOW | 300 | | **Total** | **10,049** |

- Bookings: 900 CONFIRMED, 60 CANCELLED, 20 EXPIRED, 8 HELD. Payments: 900 SUCCESS, 60 REFUNDED, 54 FAILED.
- **W3: 38 tests run, 38 passed, 0 failed.** The full table is in [`W3_TEST_REPORT_SECTION.md`](W3_TEST_REPORT_SECTION.md).
- Demo logins: `admin@cinebook.test`, `manager1` to `manager10`, `customer1` to `customer40` (all `@cinebook.test`). Password: `Password@123`.

## How to check it works
```bash
docker compose up -d db
docker exec -it cinebook-db psql -U postgres -d cinebook -c "\dv"        # lists 6 views
pip install -r db/seed/requirements.txt
python db/seed/generate_seed_data.py                                      # database must be empty
docker exec -i cinebook-db psql -U postgres -d cinebook < db/tests/w3_tests.sql
```
The last command must end with a summary of `38 | 38 | 0` and `ROLLBACK` (the tests save nothing).

## Notes
- Docker only runs the SQL files the first time the data volume is created. If the volume already exists, run `db/05_views_indexes.sql` by hand, or start fresh with `docker compose down -v` (this deletes all data).
- The 8 HELD bookings in the seed lapse 10 minutes after seeding, because they carry a real 10-minute hold.
- `smoke_test.sql` and `step1_test.sql` insert their own "Hyderabad" city, so run them on an empty database, before seeding.
