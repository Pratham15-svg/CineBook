# W3 Constraint Testing: report-ready section

Paste or adapt this into the final report (Phase 6). Use `docs/w3_test_log.txt` and screenshots as the evidence.

---

## Workflow W3: Constraint enforcement tests

**Goal.** Show that the database itself, not the application, rejects invalid operations, and still accepts valid ones.

**Method.** The script `db/tests/w3_tests.sql` runs 38 tests against the seeded database (10,049 rows). For each test it tries the operation, catches the error, and compares the PostgreSQL error code (SQLSTATE) with the one expected. A test passes when they match. Tests that must succeed are marked `OK`. The whole script runs inside one transaction and rolls back at the end, so the seeded data is untouched and the script can be re-run any number of times.

**Result.** 38 tests run, 38 passed, 0 failed (36 of 36 on an empty database, where the two seeded-data tests are skipped).

**Error codes used.** `23505` unique violation, `23503` foreign-key violation, `23514` check violation, `23P01` exclusion violation, `P0001` error raised by our own trigger or stored procedure.

### Results

| Test | Rule | What was attempted | Expected | Got | Caught by |
|---|---|---|---|---|---|
| T01 | R5 | Book 7 seats in one booking | P0001 | P0001 | seat-count trigger (deferred) |
| T02 | R5 | Book 0 seats | 23514 | 23514 | `chk_booking_total_positive` |
| T03 | R1 | Book a seat that is not on the screen | P0001 | P0001 | `sp_create_booking` |
| T04 | R3/R5 | Book a show that already started | P0001 | P0001 | future-show trigger |
| T05 | R10 | Use an expired coupon | P0001 | P0001 | `sp_create_booking` |
| T06 | R10 | Use a coupon code that does not exist | P0001 | P0001 | `sp_create_booking` |
| T07 | R10 | Coupon with max_uses=1, first use | OK | OK | (must succeed) |
| T08 | R10 | Same coupon, second use | P0001 | P0001 | `sp_create_booking` (usage limit) |
| T09 | R4/R5 | Hold and pay a 2-seat booking; price_paid adds up to total | OK | OK | (must succeed) |
| T10 | R2 | Double-book a CONFIRMED seat | 23505 | 23505 | `uq_active_seat_per_show` |
| T11 | R5 | Pay twice for the same booking | P0001 | P0001 | `sp_confirm_booking` |
| T12 | R6 | Cancel a booking that was never paid | P0001 | P0001 | `sp_cancel_booking` |
| T13 | R5 | Pay after the 10-minute hold expired | P0001 | P0001 | `sp_confirm_booking` |
| T14 | R5 | Expired hold frees its seat for someone else | OK | OK | `sp_expire_holds` + release trigger |
| T15 | R7 | Failed payment, then retry creates a second payment row | OK | OK | (must succeed) |
| T16 | R7 | Record a failed payment on a CONFIRMED booking | P0001 | P0001 | `sp_record_failed_payment` |
| T17 | R6 | Cancel 90 minutes before the show | P0001 | P0001 | `sp_cancel_booking` |
| T18 | R6 | Cancel 10 h before: 50% refund (75 of 150) | OK | OK | (must succeed) |
| T19 | R6/R9 | Cancel 3 days before: 100% refund, seats freed, 3 audit rows | OK | OK | (must succeed) |
| T20 | R2 | Re-book a seat after its booking was cancelled | OK | OK | (must succeed) |
| T21 | R3 | Overlapping show on the same screen | 23P01 | 23P01 | `excl_show_no_overlap` |
| T22 | R3 | Same time on a different screen | OK | OK | (must succeed) |
| T23 | R3 | Back-to-back show (end = next start) | OK | OK | (must succeed) |
| T24 | R3 | Show ends before it starts | 23514 | 23514 | `chk_show_time_order` |
| T25 | R4 | Show price = 0 | 23514 | 23514 | `chk_show_price_positive` |
| T26 | R4 | Show price = -50 | 23514 | 23514 | `chk_show_price_positive` |
| T27 | R1 | Seat category VIP | 23514 | 23514 | `chk_seat_category` |
| T28 | R8 | User role SUPERUSER | 23514 | 23514 | `chk_user_role` |
| T29 | R10 | PERCENT coupon worth 150% | 23514 | 23514 | `chk_coupon_value` |
| T30 | R4 | price_paid greater than list_price | 23514 | 23514 | `chk_bs_price_paid_range` |
| T31 | R8 | Same e-mail, different letter case | 23505 | 23505 | `uq_user_email_lower` |
| T32 | R8 | Customer assigned as venue manager | P0001 | P0001 | `trg_venue_manager_role` |
| T33 | R1/R3 | Booking line with a seat from another screen | 23503 | 23503 | `fk_bs_show_screen` |
| T34 | R4 | Booking line with wrong category / no price | 23503 | 23503 | `fk_bs_seat` |
| T35 | R5 | Set CONFIRMED by hand with no payment | P0001 | P0001 | `trg_booking_confirmation_check` |
| T36 | R2/R9 | Delete a booking that has history | 23503 | 23503 | `fk_bs_booking` |
| T37 | R2 | Seeded data: double-book a seat the seed sold | 23505 | 23505 | `uq_active_seat_per_show` |
| T38 | R3 | Seeded data: overlap with a seeded show | 23P01 | 23P01 | `excl_show_no_overlap` |

(The five tests required by the project plan are T21 overlapping show, T10 double booking, T01 seven seats, T25/T26 invalid price and T05 expired coupon.)

### What the results show

- **Four different mechanisms do the enforcing**, not one: constraints (CHECK, UNIQUE, EXCLUDE, foreign keys), triggers, stored procedures, and a partial unique index. Each rule is enforced at the layer that can express it.
- **Declarative rules cover most of the schema.** The partial unique index (T10, T37), the exclusion constraint (T21, T38) and the composite foreign keys (T33, T34) need no application code at all.
- **Boundary cases are accepted correctly.** Back-to-back shows (T23) pass because the time range is half-open; the same slot on another screen (T22) passes because the overlap rule is per screen; a cancelled seat can be sold again (T20) because the unique index only looks at active rows.
- **Time-based refund rules work at both tiers** (T18 50%, T19 100%) and the cut-off blocks late cancellation (T17).
- **Audit trail** is written by the trigger: a booking that is held, confirmed and cancelled has exactly 3 audit rows (T19).

### Two observations worth stating in the report

1. **Empty bookings (T02).** The seat-count trigger fires when a seat row is inserted or deleted, so a booking with no seat rows never triggers it. It is still rejected, by the CHECK `total_amount > 0`, because the total of zero seats is zero. Two rules back each other up here.
2. **Paying after the hold expires (T13)** is rejected. `sp_confirm_booking` only raises the error; it does not try to mark the booking EXPIRED itself, because that update would be rolled back together with the failed transaction. The booking is expired later by `sp_expire_holds` (called at the start of every booking attempt and on a schedule). No data is lost or left inconsistent.

### Validity check on the test script itself

To make sure the tests can actually fail, the double-booking index was dropped in a scratch copy of the database and the script re-run: T10 then reported `OK` instead of `23505` and was marked FAIL (1 failure, the rest passed). So a passing result is evidence, not an artefact of the script.

To reproduce this in the demo or viva:
```
docker exec cinebook-db psql -U postgres -c "CREATE DATABASE w3_check"
docker exec -i cinebook-db psql -U postgres -d w3_check < db/00_extensions.sql
docker exec -i cinebook-db psql -U postgres -d w3_check < db/01_tables.sql
docker exec -i cinebook-db psql -U postgres -d w3_check < db/02_constraints.sql
docker exec -i cinebook-db psql -U postgres -d w3_check < db/03_triggers.sql
docker exec -i cinebook-db psql -U postgres -d w3_check < db/04_procedures.sql
docker exec -i cinebook-db psql -U postgres -d w3_check < db/05_views_indexes.sql
docker exec cinebook-db psql -U postgres -d w3_check -c "DROP INDEX uq_active_seat_per_show"
docker exec -i cinebook-db psql -U postgres -d w3_check < db/tests/w3_tests.sql
```
Clean up afterwards: `docker exec cinebook-db psql -U postgres -c "DROP DATABASE w3_check"`.
