-- CineBook | 05_views_indexes.sql   (Step 1 of the build plan)
-- Run this after 04_procedures.sql.
-- Adds: (1) indexes, (2) the "show must be in the future" rule,
--       (3) sp_expire_holds, (4) sp_record_failed_payment,
--       (5) the read queries the backend needs: search, seat map, ticket,
--           and the dashboard views (revenue, occupancy, top movies, peak hours).
-- Safe to re-run: everything uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.

-- =======================================================================
-- 1. INDEXES
-- PostgreSQL does NOT index foreign keys automatically. These make search,
-- dashboards and the hold-expiry sweep fast.
-- =======================================================================
CREATE INDEX IF NOT EXISTS idx_movie_show_movie    ON MOVIE_SHOW (movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_show_start    ON MOVIE_SHOW (start_time);
CREATE INDEX IF NOT EXISTS idx_venue_city          ON VENUE (city_id);
CREATE INDEX IF NOT EXISTS idx_venue_manager       ON VENUE (manager_id);
CREATE INDEX IF NOT EXISTS idx_booking_show        ON BOOKING (show_id);
CREATE INDEX IF NOT EXISTS idx_booking_coupon      ON BOOKING (coupon_id) WHERE coupon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_booking     ON PAYMENT (booking_id);
CREATE INDEX IF NOT EXISTS idx_audit_booking       ON BOOKING_AUDIT (booking_id);

-- the "status index" that the expiry sweep in sp_create_booking relies on:
-- only HELD rows are indexed, so it stays tiny.
CREATE INDEX IF NOT EXISTS idx_booking_held_expiry ON BOOKING (hold_expires_at) WHERE status = 'HELD';

-- emails are unique regardless of upper/lower case (Ravi@x.com = ravi@x.com)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_email_lower ON APP_USER (lower(email));


-- =======================================================================
-- 2. RULE: a booking can only be made for a show that has not started
-- Done as a trigger so it covers every way of inserting a BOOKING.
-- The seed script may bypass it (to create back-dated history) with:
--     SET cinebook.allow_past_booking = 'on';
-- =======================================================================
CREATE OR REPLACE FUNCTION fn_check_show_in_future()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.show_start <= now()
       AND COALESCE(current_setting('cinebook.allow_past_booking', true), 'off') <> 'on' THEN
        RAISE EXCEPTION 'Show % has already started (%); booking is not allowed',
            NEW.show_id, NEW.show_start;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_show_in_future ON BOOKING;
CREATE TRIGGER trg_booking_show_in_future
    BEFORE INSERT ON BOOKING
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_show_in_future();


-- =======================================================================
-- 3. PROCEDURE: sp_expire_holds
-- Marks every HELD booking whose 10-minute hold has run out as EXPIRED
-- (the existing triggers then free its seats and write the audit row).
-- sp_create_booking already does this inline; the backend should ALSO call
-- this now and then (e.g. every minute, or before "my bookings") so that
-- stale HELD rows do not linger. Returns how many were expired.
--     CALL sp_expire_holds(NULL);
-- =======================================================================
CREATE OR REPLACE PROCEDURE sp_expire_holds(INOUT p_expired_count INTEGER DEFAULT NULL)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE BOOKING
       SET status = 'EXPIRED'
     WHERE status = 'HELD'
       AND hold_expires_at < now();

    GET DIAGNOSTICS p_expired_count = ROW_COUNT;
END;
$$;


-- =======================================================================
-- 4. PROCEDURE: sp_record_failed_payment
-- Rule R7: a failed attempt is kept as history; a retry is a NEW payment row.
-- Backend flow on a simulated payment failure:
--   1. ROLLBACK the transaction that tried sp_confirm_booking
--   2. in a NEW transaction: CALL sp_record_failed_payment(booking, method, NULL)
-- The booking stays HELD, so the customer can retry until the hold expires.
-- =======================================================================
CREATE OR REPLACE PROCEDURE sp_record_failed_payment(
    p_booking_id    BIGINT,
    p_method        TEXT,
    INOUT p_payment_id BIGINT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
    v_total  NUMERIC(10, 2);
BEGIN
    SELECT status, total_amount INTO v_status, v_total
      FROM BOOKING WHERE booking_id = p_booking_id FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Booking % does not exist', p_booking_id;
    END IF;
    IF v_status <> 'HELD' THEN
        RAISE EXCEPTION 'Booking % is % ; a failed payment can only be recorded for a HELD booking',
            p_booking_id, v_status;
    END IF;

    INSERT INTO PAYMENT (booking_id, method, amount, status, paid_at)
    VALUES (p_booking_id, p_method, v_total, 'FAILED', NULL)
    RETURNING payment_id INTO p_payment_id;
END;
$$;


-- =======================================================================
-- 5. READ QUERIES FOR THE BACKEND
-- =======================================================================

-- ---- 5a. Show search (POST /shows/search) ----------------------------
-- The backend filters this view, e.g.:
--   SELECT * FROM v_show_search
--    WHERE city_id = $1 AND start_time > now() AND language = $2
--      AND min_price <= $3 AND start_time::date = $4
--    ORDER BY start_time;
-- "taken_seats" counts CONFIRMED seats and HELD seats whose hold is still
-- alive; an expired hold counts as free.
CREATE OR REPLACE VIEW v_show_search AS
SELECT ms.show_id,
       ms.start_time,
       ms.end_time,
       m.movie_id,
       m.title,
       m.language,
       m.genre,
       m.duration_min,
       sc.screen_id,
       sc.screen_name,
       v.venue_id,
       v.name  AS venue_name,
       c.city_id,
       c.name  AS city_name,
       pr.min_price,
       pr.max_price,
       ts.total_seats,
       COALESCE(tk.taken_seats, 0)               AS taken_seats,
       ts.total_seats - COALESCE(tk.taken_seats, 0) AS available_seats
FROM MOVIE_SHOW ms
JOIN MOVIE  m  ON m.movie_id   = ms.movie_id
JOIN SCREEN sc ON sc.screen_id = ms.screen_id
JOIN VENUE  v  ON v.venue_id   = sc.venue_id
JOIN CITY   c  ON c.city_id    = v.city_id
LEFT JOIN LATERAL (
    SELECT MIN(price) AS min_price, MAX(price) AS max_price
      FROM SHOW_PRICE WHERE show_id = ms.show_id
) pr ON TRUE
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total_seats FROM SEAT WHERE screen_id = ms.screen_id
) ts ON TRUE
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS taken_seats
      FROM BOOKING_SEAT bs
      JOIN BOOKING b ON b.booking_id = bs.booking_id
     WHERE bs.show_id = ms.show_id
       AND bs.is_active
       AND (b.status = 'CONFIRMED'
            OR (b.status = 'HELD' AND b.hold_expires_at >= now()))
) tk ON TRUE;


-- ---- 5b. Seat map for one show (GET /shows/:id/seats) -----------------
-- One row per seat of the show's screen:
--   AVAILABLE | HELD (someone is paying) | BOOKED (confirmed)
-- Expired holds are treated as AVAILABLE, even before the sweep has run.
--     SELECT * FROM fn_seat_map(42);
CREATE OR REPLACE FUNCTION fn_seat_map(p_show_id BIGINT)
RETURNS TABLE (seat_no TEXT, category TEXT, price NUMERIC(10, 2), seat_status TEXT)
LANGUAGE sql STABLE
AS $$
    SELECT s.seat_no,
           s.category,
           sp.price,
           CASE
               WHEN b.status = 'CONFIRMED'                                 THEN 'BOOKED'
               WHEN b.status = 'HELD' AND b.hold_expires_at >= now()       THEN 'HELD'
               ELSE 'AVAILABLE'
           END AS seat_status
      FROM MOVIE_SHOW ms
      JOIN SEAT s            ON s.screen_id = ms.screen_id
      LEFT JOIN SHOW_PRICE sp ON sp.show_id = ms.show_id AND sp.category = s.category
      LEFT JOIN BOOKING_SEAT bs ON bs.show_id   = ms.show_id
                               AND bs.screen_id = s.screen_id
                               AND bs.seat_no   = s.seat_no
                               AND bs.is_active
      LEFT JOIN BOOKING b    ON b.booking_id = bs.booking_id
     WHERE ms.show_id = p_show_id
     ORDER BY substring(s.seat_no from '^[A-Za-z]+'),
              NULLIF(substring(s.seat_no from '[0-9]+'), '')::int,
              s.seat_no;
$$;


-- ---- 5c. Ticket / my bookings (GET /bookings/:id, GET /me/bookings) ----
-- Fast read path from the report: touches ONLY BOOKING and BOOKING_SEAT
-- (the sale-time snapshot columns replace the 6 extra joins).
--     SELECT * FROM v_ticket WHERE booking_id = $1;
--     SELECT * FROM v_ticket WHERE user_id = $1 ORDER BY booked_at DESC;
-- effective_status shows EXPIRED for a hold that ran out but is not swept yet.
CREATE OR REPLACE VIEW v_ticket AS
SELECT b.booking_id,
       b.user_id,
       b.show_id,
       b.status,
       CASE WHEN b.status = 'HELD' AND b.hold_expires_at < now()
            THEN 'EXPIRED' ELSE b.status END AS effective_status,
       b.booked_at,
       b.hold_expires_at,
       b.coupon_id,
       b.discount_amount,
       b.total_amount,
       b.movie_title,
       b.venue_name,
       b.screen_name,
       b.show_start,
       sd.seat_count,
       sd.seats,
       sd.seat_details
FROM BOOKING b
LEFT JOIN LATERAL (
    SELECT COUNT(*)                                   AS seat_count,
           string_agg(bs.seat_no, ', ' ORDER BY bs.seat_no) AS seats,
           jsonb_agg(jsonb_build_object(
               'seat_no',    bs.seat_no,
               'category',   bs.seat_category,
               'list_price', bs.list_price,
               'price_paid', bs.price_paid
           ) ORDER BY bs.seat_no)                     AS seat_details
      FROM BOOKING_SEAT bs
     WHERE bs.booking_id = b.booking_id
) sd ON TRUE;


-- ---- 5d. Dashboard: revenue per venue per month -----------------------
-- Built from PAYMENT: SUCCESS and REFUNDED rows (FAILED/INITIATED ignored).
-- net = money received minus refunds. Months use India time.
-- Managers filter with WHERE manager_id = $1.
CREATE OR REPLACE VIEW v_revenue_venue_month AS
SELECT v.venue_id,
       v.name       AS venue_name,
       v.manager_id,
       c.name       AS city_name,
       date_trunc('month', p.paid_at AT TIME ZONE 'Asia/Kolkata')::date AS month,
       COUNT(DISTINCT p.booking_id)                       AS paid_bookings,
       SUM(p.amount)                                      AS gross_revenue,
       SUM(COALESCE(p.refund_amount, 0))                  AS refunds,
       SUM(p.amount - COALESCE(p.refund_amount, 0))       AS net_revenue
FROM PAYMENT p
JOIN BOOKING    b  ON b.booking_id = p.booking_id
JOIN MOVIE_SHOW ms ON ms.show_id   = b.show_id
JOIN SCREEN     sc ON sc.screen_id = ms.screen_id
JOIN VENUE      v  ON v.venue_id   = sc.venue_id
JOIN CITY       c  ON c.city_id    = v.city_id
WHERE p.status IN ('SUCCESS', 'REFUNDED')
GROUP BY v.venue_id, v.name, v.manager_id, c.name,
         date_trunc('month', p.paid_at AT TIME ZONE 'Asia/Kolkata');


-- ---- 5e. Dashboard: occupancy per show --------------------------------
-- sold = CONFIRMED seats, held = live holds. Managers filter by manager_id.
CREATE OR REPLACE VIEW v_show_occupancy AS
SELECT ms.show_id,
       m.title,
       v.venue_id,
       v.name AS venue_name,
       v.manager_id,
       sc.screen_name,
       ms.start_time,
       ts.total_seats,
       COALESCE(oc.sold_seats, 0) AS sold_seats,
       COALESCE(oc.held_seats, 0) AS held_seats,
       CASE WHEN ts.total_seats = 0 THEN 0
            ELSE ROUND(100.0 * COALESCE(oc.sold_seats, 0) / ts.total_seats, 1)
       END AS occupancy_pct
FROM MOVIE_SHOW ms
JOIN MOVIE  m  ON m.movie_id   = ms.movie_id
JOIN SCREEN sc ON sc.screen_id = ms.screen_id
JOIN VENUE  v  ON v.venue_id   = sc.venue_id
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total_seats FROM SEAT WHERE screen_id = ms.screen_id
) ts ON TRUE
LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE b.status = 'CONFIRMED') AS sold_seats,
           COUNT(*) FILTER (WHERE b.status = 'HELD' AND b.hold_expires_at >= now()) AS held_seats
      FROM BOOKING_SEAT bs
      JOIN BOOKING b ON b.booking_id = bs.booking_id
     WHERE bs.show_id = ms.show_id AND bs.is_active
) oc ON TRUE;


-- ---- 5f. Dashboard: top 3 movies per city (CTE + window function) -----
-- Ranked by tickets sold, then revenue, then title (so ties are stable).
CREATE OR REPLACE VIEW v_top_movies_city AS
WITH sales AS (
    SELECT c.city_id,
           c.name        AS city_name,
           m.movie_id,
           m.title,
           COUNT(*)      AS tickets_sold,
           SUM(bs.price_paid) AS revenue
      FROM BOOKING_SEAT bs
      JOIN BOOKING    b  ON b.booking_id = bs.booking_id AND b.status = 'CONFIRMED'
      JOIN MOVIE_SHOW ms ON ms.show_id   = bs.show_id
      JOIN MOVIE      m  ON m.movie_id   = ms.movie_id
      JOIN SCREEN     sc ON sc.screen_id = ms.screen_id
      JOIN VENUE      v  ON v.venue_id   = sc.venue_id
      JOIN CITY       c  ON c.city_id    = v.city_id
     WHERE bs.is_active
     GROUP BY c.city_id, c.name, m.movie_id, m.title
),
ranked AS (
    SELECT s.*,
           ROW_NUMBER() OVER (PARTITION BY city_id
                              ORDER BY tickets_sold DESC, revenue DESC, title) AS rank_in_city
      FROM sales s
)
SELECT city_id, city_name, rank_in_city, movie_id, title, tickets_sold, revenue
  FROM ranked
 WHERE rank_in_city <= 3;


-- ---- 5g. Dashboard: peak booking hours (India time) -------------------
-- Counts CONFIRMED bookings by the hour of day they were made.
CREATE OR REPLACE VIEW v_peak_hours AS
SELECT EXTRACT(HOUR FROM b.booked_at AT TIME ZONE 'Asia/Kolkata')::int AS hour_of_day,
       COUNT(*)            AS confirmed_bookings,
       SUM(b.total_amount) AS revenue
  FROM BOOKING b
 WHERE b.status = 'CONFIRMED'
 GROUP BY 1
 ORDER BY 1;
