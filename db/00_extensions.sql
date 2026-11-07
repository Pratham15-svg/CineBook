-- CineBook | 00_extensions.sql
-- Run this first, once per database.
-- btree_gist is needed for the EXCLUDE constraint that stops a screen
-- from having two overlapping shows (used in 02_constraints.sql).

CREATE EXTENSION IF NOT EXISTS btree_gist;
