-- CineBook | 05_views_indexes.sql
-- Views promised in the report (availability, revenue, occupancy) and
-- extra indexes for the hot paths. Run after 04_procedures.sql.

-- ---------------------------------------------------------------------
-- Extra indexes
-- ---------------------------------------------------------------------

-- sp_expire_holds only ever looks at HELD bookings; a partial index
-- keeps that scan tiny no matter how many old bookings pile up.
CREATE INDEX IF NOT EXISTS idx_booking_held_expiry
    ON BOOKING (hold_expires_at)
    WHERE status = 'HELD';

-- Ticket detail reads all seats of one booking. The primary key
-- (booking_id, screen_id, seat_no) already starts with booking_id,
-- so no extra index is needed for that.

-- Show search filters by start_time and joins on screen_id.
CREATE INDEX IF NOT EXISTS idx_show_start_time ON MOVIE_SHOW (start_time);

-- Payments are looked up per booking (confirmation rule, refunds, revenue).
CREATE INDEX IF NOT EXISTS idx_payment_booking ON PAYMENT (booking_id);

-- Admin reports join BOOKING_SEAT by show.
CREATE INDEX IF NOT EXISTS idx_booking_seat_show ON BOOKING_SEAT (show_id) WHERE is_active;


-- ---------------------------------------------------------------------
-- VIEW 1: v_show_availability
-- One row per (show, category): how many seats exist, how many are
-- taken, how many are free, and the price. Used by the search page.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_show_availability AS
SELECT
    ms.show_id,
    sp.category,
    sp.price,
    COUNT(s.seat_no)                                   AS total_seats,
    COUNT(bs.seat_no)                                  AS taken_seats,
    COUNT(s.seat_no) - COUNT(bs.seat_no)               AS free_seats
FROM MOVIE_SHOW ms
JOIN SHOW_PRICE sp ON sp.show_id = ms.show_id
JOIN SEAT s        ON s.screen_id = ms.screen_id AND s.category = sp.category
LEFT JOIN BOOKING_SEAT bs
       ON bs.show_id = ms.show_id
      AND bs.screen_id = s.screen_id
      AND bs.seat_no = s.seat_no
      AND bs.is_active
GROUP BY ms.show_id, sp.category, sp.price;


-- ---------------------------------------------------------------------
-- VIEW 2: v_venue_revenue_monthly
-- Net revenue per venue per month = successful payments minus refunds.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_venue_revenue_monthly AS
SELECT
    v.venue_id,
    v.name                                  AS venue_name,
    ci.name                                 AS city_name,
    date_trunc('month', p.paid_at)          AS month,
    SUM(p.amount)                           AS gross_revenue,
    SUM(COALESCE(p.refund_amount, 0))       AS refunds,
    SUM(p.amount - COALESCE(p.refund_amount, 0)) AS net_revenue
FROM PAYMENT p
JOIN BOOKING b     ON b.booking_id = p.booking_id
JOIN MOVIE_SHOW ms ON ms.show_id = b.show_id
JOIN SCREEN sc     ON sc.screen_id = ms.screen_id
JOIN VENUE v       ON v.venue_id = sc.venue_id
JOIN CITY ci       ON ci.city_id = v.city_id
WHERE p.status IN ('SUCCESS', 'REFUNDED')
GROUP BY v.venue_id, v.name, ci.name, date_trunc('month', p.paid_at);


-- ---------------------------------------------------------------------
-- VIEW 3: v_show_occupancy
-- Seats sold vs capacity for every show.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_show_occupancy AS
SELECT
    ms.show_id,
    m.title,
    v.venue_id,
    v.name          AS venue_name,
    ms.start_time,
    cap.capacity,
    COALESCE(sold.sold, 0) AS booked_seats,
    ROUND(100.0 * COALESCE(sold.sold, 0) / NULLIF(cap.capacity, 0), 1) AS occupancy_pct
FROM MOVIE_SHOW ms
JOIN MOVIE m   ON m.movie_id = ms.movie_id
JOIN SCREEN sc ON sc.screen_id = ms.screen_id
JOIN VENUE v   ON v.venue_id = sc.venue_id
JOIN (SELECT screen_id, COUNT(*) AS capacity FROM SEAT GROUP BY screen_id) cap
     ON cap.screen_id = ms.screen_id
LEFT JOIN (SELECT show_id, COUNT(*) AS sold
           FROM BOOKING_SEAT WHERE is_active GROUP BY show_id) sold
     ON sold.show_id = ms.show_id;
