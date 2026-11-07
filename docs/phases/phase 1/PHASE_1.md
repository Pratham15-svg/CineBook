# Phase 1: Database build-out

**Planned dates:** 18–22 Oct · **Owner:** Pratham Singla · **Needs:** nothing (this is the base)

## What is in this phase
The six SQL files that create the whole database: 13 tables, keys and foreign keys (`01`), CHECK and no-overlap rules (`02`), 5 triggers (`03`), 4 stored procedures (`04`), and 3 report views plus extra indexes (`05`). `setup.sh` runs them in order. `.gitignore` is included so the repo is set up correctly from the very first commit.

## Files
- `.gitignore`
- `db/00_extensions.sql`
- `db/01_tables.sql`
- `db/02_constraints.sql`
- `db/03_triggers.sql`
- `db/04_procedures.sql`
- `db/05_views_indexes.sql`
- `db/setup.sh`

## How to check it works
```bash
createdb cinebook
cd db && ./setup.sh cinebook
```
It must end with `Schema ready in database 'cinebook'.` and show no errors.

## Notes
Since the first Phase 1 hand-over, `04_procedures.sql` was fixed: the old `sp_confirm_booking` set a booking to EXPIRED just before raising an error, and the error undid that change. Expiry now happens in a new procedure, `sp_expire_holds`. `05_views_indexes.sql` is new. Replace any older copies with these.

All phase zips unpack into the same `CineBook/` folder. Unzip them on top of each other, in order, to build the full repository.
