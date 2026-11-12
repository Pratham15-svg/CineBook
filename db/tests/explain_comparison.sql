-- CineBook | db/tests/explain_comparison.sql
-- Read-path comparison promised in the mid-sem report (Section 6):
--   NAIVE    = join APP_USER, BOOKING, BOOKING_SEAT, SEAT, MOVIE_SHOW, MOVIE, SCREEN, VENUE
--   SNAPSHOT = BOOKING + BOOKING_SEAT only (show details are stored on the booking)
-- Two read paths are compared: (A) ticket detail, (B) "my bookings".
-- Read-only: EXPLAIN ANALYZE on SELECT statements changes no data.
--
-- Run (Docker):
--   docker compose exec -T db psql -U postgres -d cinebook < db/tests/explain_comparison.sql
\set ON_ERROR_STOP on
\pset pager off

-- Pick the user with the most bookings and one of their bookings.
SELECT user_id AS uid FROM booking GROUP BY user_id ORDER BY count(*) DESC, user_id LIMIT 1 \gset
SELECT max(booking_id) AS bid FROM booking WHERE user_id = :uid \gset
\echo Using user_id = :uid, booking_id = :bid

ANALYZE;

\echo
\echo '=== A1. Ticket detail, NAIVE (8-table join) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT b.booking_id, b.status, b.total_amount,
       u.name, m.title, v.name AS venue, sc.screen_name, ms.start_time,
       bs.seat_no, se.category, bs.list_price, bs.price_paid
FROM booking b
JOIN app_user u     ON u.user_id = b.user_id
JOIN booking_seat bs ON bs.booking_id = b.booking_id
JOIN seat se        ON se.screen_id = bs.screen_id AND se.seat_no = bs.seat_no
JOIN movie_show ms  ON ms.show_id = b.show_id
JOIN movie m        ON m.movie_id = ms.movie_id
JOIN screen sc      ON sc.screen_id = ms.screen_id
JOIN venue v        ON v.venue_id = sc.venue_id
WHERE b.booking_id = :bid;

\echo
\echo '=== A2. Ticket detail, SNAPSHOT (BOOKING + BOOKING_SEAT) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT b.booking_id, b.status, b.total_amount,
       b.movie_title, b.venue_name, b.screen_name, b.show_start,
       bs.seat_no, bs.seat_category, bs.list_price, bs.price_paid
FROM booking b
JOIN booking_seat bs ON bs.booking_id = b.booking_id
WHERE b.booking_id = :bid;

\echo
\echo '=== B1. My bookings, NAIVE (8-table join) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT b.booking_id, b.status, b.total_amount, b.booked_at,
       m.title, v.name AS venue, sc.screen_name, ms.start_time,
       bs.seat_no, se.category
FROM booking b
JOIN app_user u     ON u.user_id = b.user_id
JOIN booking_seat bs ON bs.booking_id = b.booking_id
JOIN seat se        ON se.screen_id = bs.screen_id AND se.seat_no = bs.seat_no
JOIN movie_show ms  ON ms.show_id = b.show_id
JOIN movie m        ON m.movie_id = ms.movie_id
JOIN screen sc      ON sc.screen_id = ms.screen_id
JOIN venue v        ON v.venue_id = sc.venue_id
WHERE b.user_id = :uid
ORDER BY b.booked_at DESC;

\echo
\echo '=== B2. My bookings, SNAPSHOT (index on user_id, booked_at DESC; seats as JSON) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT b.*,
       COALESCE((SELECT json_agg(to_jsonb(bs))
                 FROM booking_seat bs
                 WHERE bs.booking_id = b.booking_id), '[]'::json) AS seats
FROM booking b
WHERE b.user_id = :uid
ORDER BY b.booked_at DESC;
