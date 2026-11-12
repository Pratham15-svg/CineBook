# Fix applied to db/04_procedures.sql (2026-11-01)

**File:** `db/04_procedures.sql`, inside `sp_confirm_booking`.

**Before (Arjun's version — a regression from the original Phase 1 file):**
```sql
IF v_hold_expires < now() THEN
    UPDATE BOOKING SET status = 'EXPIRED' WHERE booking_id = p_booking_id;
    RAISE EXCEPTION 'Booking % hold has expired', p_booking_id;
END IF;
```
The `UPDATE` is pointless: `RAISE EXCEPTION` fails the transaction, so the
`UPDATE` is rolled back with it and never actually takes effect. This is the
same bug that was already found and fixed in the original Phase 1 zip — this
copy had reverted to the older, buggy version.

**After:**
```sql
IF v_hold_expires < now() THEN
    -- Note: we only raise here. An UPDATE to EXPIRED placed before the
    -- RAISE would be rolled back together with the failed transaction,
    -- so it would never actually stick. Expired holds are released
    -- instead by sp_expire_holds (db/05_indexes_views.sql), run at the
    -- start of every booking attempt and on a schedule.
    RAISE EXCEPTION 'Booking % hold has expired', p_booking_id;
END IF;
```

**Verified after the fix** (fresh database, nothing else changed):
- All 6 SQL files (`00`–`05`) still run cleanly in order, 0 errors.
- Reseeding: 10,044 rows, same distribution as before the fix.
- Arjun's `w3_tests.sql`: still **38 / 38 passed**.
- Direct test: confirming a booking after its hold expired correctly raises
  `"Booking <id> hold has expired"` and leaves the booking's status for
  `sp_expire_holds` to update, instead of a dead UPDATE pretending to.

**To apply:** replace `db/04_procedures.sql` with `db/04_procedures_FIXED.sql`
in Arjun's repository (same filename, just drop the `_FIXED` suffix once
you've checked it in).
