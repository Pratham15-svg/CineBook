# Phase 1: Database build-out

**Owner:** Pratham Singla · **Needs:** nothing (this is the base)

## What this phase is about
The SQL that creates the core database: 13 tables with keys and foreign keys, CHECK and no-overlap rules, 5 triggers, and the booking stored procedures. `setup.sh` runs the SQL files in order, and `.gitignore` is set up from the first commit.

## Files
- `.gitignore`
- `db/00_extensions.sql`: enables `btree_gist` (needed for the show-overlap constraint)
- `db/01_tables.sql`: 13 tables, primary and foreign keys
- `db/02_constraints.sql`: CHECK constraints and the `EXCLUDE` constraint that blocks overlapping shows
- `db/03_triggers.sql`: 5 triggers
- `db/04_procedures.sql`: `sp_create_booking`, `sp_confirm_booking`, `sp_cancel_booking`
- `db/setup.sh`: runs all SQL files in order

## Triggers
| Trigger | Rule |
|---|---|
| `trg_booking_audit` | Writes a `BOOKING_AUDIT` row whenever a booking's status changes |
| `trg_booking_seat_count` | A booking must have 1 to 6 seats (deferred) |
| `trg_venue_manager_role` | `VENUE.manager_id` must be a user with role `MANAGER` |
| `trg_release_seats` | Frees the seats when a booking becomes `CANCELLED` or `EXPIRED` |
| `trg_booking_confirmation_check` | A `CONFIRMED` booking needs a successful payment matching `total_amount` and a `price_paid` on every seat (deferred) |

## Stored procedures
| Procedure | Job |
|---|---|
| `sp_create_booking` | Holds the seats, copies `list_price`, applies a coupon, computes `total_amount` |
| `sp_confirm_booking` | On successful payment, records the payment and sets `price_paid` per seat |
| `sp_cancel_booking` | Applies the 2-hour cut-off, computes the refund, updates the payment |

## How to check it works
```bash
createdb cinebook
cd db && ./setup.sh cinebook
```
It must end with `Schema ready in database 'cinebook'.` and show no errors. Inserting a conflicting row (for example the same seat twice for a show) must be rejected by the database.

## Notes
`sp_confirm_booking` only raises an error when a hold has expired. It does not set the booking to `EXPIRED` first, because that update would be rolled back together with the error. Expired holds are released by `sp_expire_holds`, added in Phase 2.
