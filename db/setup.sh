#!/usr/bin/env bash
# CineBook: create the schema in an existing, empty database.
# Usage:  ./setup.sh cinebook            (database name, default cinebook)
# Uses the usual PG* environment variables (PGUSER, PGHOST, PGPASSWORD...).
set -euo pipefail
DB="${1:-cinebook}"
cd "$(dirname "$0")"
for f in 00_extensions.sql 01_tables.sql 02_constraints.sql 03_triggers.sql \
         04_procedures.sql 05_indexes_views.sql; do
  echo ">> $f"
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"
done
echo "Schema ready in database '$DB'."
