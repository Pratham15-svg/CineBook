# Query plan comparison: naive join vs snapshot read path

This compares two ways of reading a ticket (design document, Section 6, "Read-path design"):

- **NAIVE:** join `APP_USER`, `BOOKING`, `BOOKING_SEAT`, `SEAT`, `MOVIE_SHOW`, `MOVIE`, `SCREEN` and `VENUE` (8 tables).
- **SNAPSHOT (used by the app):** read only `BOOKING` and `BOOKING_SEAT`. The movie, venue, screen and start time are stored on the booking when it is made (write-once, like an invoice), and each seat line stores its own category and prices.

Script: [`db/tests/explain_comparison.sql`](../../../db/tests/explain_comparison.sql). It is read-only (`EXPLAIN ANALYZE` on `SELECT` statements changes no data). It compares two read paths:

- **A. Ticket detail:** one booking (`GET /bookings/:id`).
- **B. My bookings:** all bookings of the user with the most bookings (`GET /bookings/me`).

## How to re-run

```bash
docker compose exec -T db psql -U postgres -d cinebook < db/tests/explain_comparison.sql
```

## Results

Measured on PostgreSQL 16.15 with the seeded database: 990 bookings, 2,738 booking seats, 301 shows. Median of 7 runs; times in milliseconds.

| Query | Tables joined | Planning | Execution | Planning + execution |
|---|---:|---:|---:|---:|
| A1. Ticket detail, naive | 8 | 1.224 | 0.217 | 1.441 |
| A2. Ticket detail, snapshot | 2 | 0.102 | 0.020 | 0.122 |
| B1. My bookings, naive | 8 | 1.198 | 0.900 | 2.098 |
| B2. My bookings, snapshot | 1 plus a per-booking lookup of seats | 0.107 | 0.541 | 0.648 |

| Path | Execution speed-up | Planning speed-up | Total speed-up |
|---|---:|---:|---:|
| A. Ticket detail | about 11x | about 12x | about 12x |
| B. My bookings | about 1.7x | about 11x | about 3.2x |

## What the plans show

- **A1 (naive):** eight relations, a mix of hash joins and nested loops, with sequential scans on `movie_show` and `app_user`, and a hash join to put it all together.
- **A2 (snapshot):** two index scans, `uq_booking_id_show` on `booking` and `booking_seat_pkey` on `booking_seat`, joined by a nested loop. Nothing else is touched.
- **B2 (snapshot, my bookings):** one bitmap index scan on `idx_booking_user_booked_at` (the index on `user_id, booked_at DESC`), then a primary-key lookup of at most 6 seat rows per booking.
- Planning time falls by about 11 to 12 times because the optimiser has far fewer join orders to consider.

## Reading the numbers

- At this data size every query finishes in about a millisecond or less, so the absolute gain is small. The comparison shows that the snapshot design reads fewer tables, with simpler plans and less work for the planner, and that cost grows with data volume for the naive join much faster than for two primary-key lookups.
- "My bookings" gains less than "ticket detail" because the snapshot version still reads each booking's seat rows; the saving there comes from skipping the six extra joins.
- The price of the design is controlled duplication: the snapshot columns on `booking` and `booking_seat` are written once and never updated (see Section 6 of the design PDF).
- Timings depend on the machine. Re-run the script for your own numbers.
