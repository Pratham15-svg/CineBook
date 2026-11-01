-- CineBook | 04_procedures.sql
-- The three procedures behind workflow W1: hold -> confirm -> cancel.
-- Run this after 03_triggers.sql.
-- The backend calls these with CALL ... inside its own transaction;
-- it does not build this logic itself in JavaScript.

-- =======================================================================
-- PROCEDURE 1: sp_create_booking
-- Holds a set of seats for a show for 10 minutes.
-- p_seat_numbers is an array of seat_no values on that show's screen,
-- e.g. ARRAY['A1','A2'].
-- =======================================================================
CREATE OR REPLACE PROCEDURE sp_create_booking(
    p_user_id       BIGINT,
    p_show_id       BIGINT,
    p_seat_numbers  TEXT[],
    p_coupon_code   TEXT DEFAULT NULL,
    INOUT p_booking_id BIGINT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_screen_id     BIGINT;
    v_movie_title   TEXT;
    v_venue_name    TEXT;
    v_screen_name   TEXT;
    v_show_start    TIMESTAMPTZ;
    v_seat_no       TEXT;
    v_seat_category TEXT;
    v_list_price    NUMERIC(10, 2);
    v_sum_list      NUMERIC(10, 2) := 0;
    v_coupon_id     BIGINT := NULL;
    v_discount_type TEXT;
    v_discount_val  NUMERIC(10, 2);
    v_max_uses      INTEGER;
    v_used_count    INTEGER;
    v_discount_amt  NUMERIC(10, 2) := 0;
    v_total_amount  NUMERIC(10, 2);
BEGIN
    -- R5: release any expired holds first, across the whole system,
    -- not just this show -- cheap because of the status index.
    UPDATE BOOKING
       SET status = 'EXPIRED'
     WHERE status = 'HELD'
       AND hold_expires_at < now();

    -- Snapshot details for the ticket (R11)
    SELECT ms.screen_id, m.title, v.name, sc.screen_name, ms.start_time
      INTO v_screen_id, v_movie_title, v_venue_name, v_screen_name, v_show_start
      FROM MOVIE_SHOW ms
      JOIN MOVIE  m  ON m.movie_id = ms.movie_id
      JOIN SCREEN sc ON sc.screen_id = ms.screen_id
      JOIN VENUE  v  ON v.venue_id = sc.venue_id
     WHERE ms.show_id = p_show_id;

    IF v_screen_id IS NULL THEN
        RAISE EXCEPTION 'Show % does not exist', p_show_id;
    END IF;

    -- Validate and lock the coupon row (race-safe: FOR UPDATE)
    IF p_coupon_code IS NOT NULL THEN
        SELECT coupon_id, discount_type, discount_value, max_uses
          INTO v_coupon_id, v_discount_type, v_discount_val, v_max_uses
          FROM COUPON
         WHERE code = p_coupon_code
           AND (valid_to IS NULL OR valid_to >= now())
         FOR UPDATE;

        IF v_coupon_id IS NULL THEN
            RAISE EXCEPTION 'Coupon % is invalid or expired', p_coupon_code;
        END IF;

        IF v_max_uses IS NOT NULL THEN
            SELECT COUNT(*) INTO v_used_count
              FROM BOOKING
             WHERE coupon_id = v_coupon_id
               AND status IN ('HELD', 'CONFIRMED');

            IF v_used_count >= v_max_uses THEN
                RAISE EXCEPTION 'Coupon % has reached its usage limit', p_coupon_code;
            END IF;
        END IF;
    END IF;

    -- Create the BOOKING row first (total_amount filled in below,
    -- temporarily set to 1 to satisfy the CHECK > 0 until computed)
    INSERT INTO BOOKING (
        user_id, show_id, coupon_id, status, hold_expires_at,
        discount_amount, total_amount,
        movie_title, venue_name, screen_name, show_start
    ) VALUES (
        p_user_id, p_show_id, v_coupon_id, 'HELD', now() + INTERVAL '10 minutes',
        0, 1,
        v_movie_title, v_venue_name, v_screen_name, v_show_start
    )
    RETURNING booking_id INTO p_booking_id;

    -- Add one BOOKING_SEAT row per requested seat.
    -- The composite foreign keys (see 01_tables.sql) reject a seat that
    -- does not belong to this show's screen or has no SHOW_PRICE row;
    -- the partial unique index rejects a seat already actively booked.
    FOREACH v_seat_no IN ARRAY p_seat_numbers LOOP
        SELECT category INTO v_seat_category
          FROM SEAT
         WHERE screen_id = v_screen_id AND seat_no = v_seat_no;

        IF v_seat_category IS NULL THEN
            RAISE EXCEPTION 'Seat % does not exist on screen %', v_seat_no, v_screen_id;
        END IF;

        SELECT price INTO v_list_price
          FROM SHOW_PRICE
         WHERE show_id = p_show_id AND category = v_seat_category;

        IF v_list_price IS NULL THEN
            RAISE EXCEPTION 'No price set for category % on show %', v_seat_category, p_show_id;
        END IF;

        INSERT INTO BOOKING_SEAT (
            booking_id, screen_id, seat_no, show_id, seat_category, list_price, price_paid, is_active
        ) VALUES (
            p_booking_id, v_screen_id, v_seat_no, p_show_id, v_seat_category, v_list_price, NULL, TRUE
        );

        v_sum_list := v_sum_list + v_list_price;
    END LOOP;

    -- R10: compute the discount, but never let it make the booking free
    IF v_coupon_id IS NOT NULL THEN
        IF v_discount_type = 'PERCENT' THEN
            v_discount_amt := ROUND(v_sum_list * v_discount_val / 100, 2);
        ELSE
            v_discount_amt := v_discount_val;
        END IF;

        -- cap so total_amount stays strictly positive
        IF v_discount_amt >= v_sum_list THEN
            v_discount_amt := v_sum_list - 1;  -- leave at least 1 payable
        END IF;
    END IF;

    v_total_amount := v_sum_list - v_discount_amt;

    UPDATE BOOKING
       SET discount_amount = v_discount_amt,
           total_amount    = v_total_amount
     WHERE booking_id = p_booking_id;

    -- Force the deferred seat-count check (1 to 6 seats) to run now,
    -- instead of waiting for COMMIT, so a bad request fails inside
    -- this procedure call with a clear error.
    SET CONSTRAINTS trg_booking_seat_count IMMEDIATE;
END;
$$;


-- =======================================================================
-- PROCEDURE 2: sp_confirm_booking
-- Called after a simulated payment succeeds. Spreads the booking's
-- discount across its seats (R10) and marks the booking CONFIRMED.
-- =======================================================================
CREATE OR REPLACE PROCEDURE sp_confirm_booking(
    p_booking_id    BIGINT,
    p_method        TEXT,
    INOUT p_payment_id BIGINT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status        TEXT;
    v_hold_expires  TIMESTAMPTZ;
    v_total_amount  NUMERIC(10, 2);
    v_sum_list      NUMERIC(10, 2);
BEGIN
    SELECT status, hold_expires_at, total_amount
      INTO v_status, v_hold_expires, v_total_amount
      FROM BOOKING
     WHERE booking_id = p_booking_id
       FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Booking % does not exist', p_booking_id;
    END IF;

    IF v_status <> 'HELD' THEN
        RAISE EXCEPTION 'Booking % is % and cannot be paid for', p_booking_id, v_status;
    END IF;

    IF v_hold_expires < now() THEN
        UPDATE BOOKING SET status = 'EXPIRED' WHERE booking_id = p_booking_id;
        RAISE EXCEPTION 'Booking % hold has expired', p_booking_id;
    END IF;

    -- Spread total_amount over the active seats in proportion to each
    -- seat's list_price, so sum(price_paid) = total_amount exactly (R10).
    SELECT SUM(list_price) INTO v_sum_list
      FROM BOOKING_SEAT
     WHERE booking_id = p_booking_id AND is_active;

    UPDATE BOOKING_SEAT
       SET price_paid = ROUND(list_price / v_sum_list * v_total_amount, 2)
     WHERE booking_id = p_booking_id AND is_active;

    -- Rounding can leave the sum a few paise off target; fix it on the
    -- single most expensive seat so sum(price_paid) matches exactly.
    UPDATE BOOKING_SEAT bs
       SET price_paid = price_paid
           + (v_total_amount - (
                 SELECT SUM(price_paid) FROM BOOKING_SEAT
                  WHERE booking_id = p_booking_id AND is_active
             ))
     WHERE booking_id = p_booking_id AND is_active
       AND list_price = (
            SELECT MAX(list_price) FROM BOOKING_SEAT
             WHERE booking_id = p_booking_id AND is_active
       )
       AND ctid = (
            SELECT ctid FROM BOOKING_SEAT
             WHERE booking_id = p_booking_id AND is_active
             ORDER BY list_price DESC LIMIT 1
       );

    INSERT INTO PAYMENT (booking_id, method, amount, status, paid_at)
    VALUES (p_booking_id, p_method, v_total_amount, 'SUCCESS', now())
    RETURNING payment_id INTO p_payment_id;

    UPDATE BOOKING SET status = 'CONFIRMED' WHERE booking_id = p_booking_id;

    -- Force the deferred confirmation-rule trigger to run now so any
    -- mismatch is reported inside this procedure call.
    SET CONSTRAINTS trg_booking_confirmation_check IMMEDIATE;
END;
$$;


-- =======================================================================
-- PROCEDURE 3: sp_cancel_booking
-- R6: cancellation allowed until 2 hours before the show.
-- Refund: 100% if more than 24h before the show, 50% if between 2h
-- and 24h before. Refund is computed from price_paid, recorded on the
-- original SUCCESS payment row.
-- =======================================================================
CREATE OR REPLACE PROCEDURE sp_cancel_booking(
    p_booking_id        BIGINT,
    INOUT p_refund_amount NUMERIC(10, 2) DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status        TEXT;
    v_show_start    TIMESTAMPTZ;
    v_hours_to_show NUMERIC;
    v_refund_pct    NUMERIC;
    v_payment_id    BIGINT;
    v_amount_paid   NUMERIC(10, 2);
BEGIN
    SELECT status, show_start
      INTO v_status, v_show_start
      FROM BOOKING
     WHERE booking_id = p_booking_id
       FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Booking % does not exist', p_booking_id;
    END IF;

    IF v_status <> 'CONFIRMED' THEN
        RAISE EXCEPTION 'Booking % is % and cannot be cancelled', p_booking_id, v_status;
    END IF;

    v_hours_to_show := EXTRACT(EPOCH FROM (v_show_start - now())) / 3600.0;

    IF v_hours_to_show < 2 THEN
        RAISE EXCEPTION
            'Booking % cannot be cancelled: show starts in less than 2 hours',
            p_booking_id;
    ELSIF v_hours_to_show >= 24 THEN
        v_refund_pct := 1.0;      -- 100%
    ELSE
        v_refund_pct := 0.5;      -- 50%
    END IF;

    SELECT payment_id, amount INTO v_payment_id, v_amount_paid
      FROM PAYMENT
     WHERE booking_id = p_booking_id AND status = 'SUCCESS'
     ORDER BY paid_at DESC
     LIMIT 1;

    IF v_payment_id IS NULL THEN
        RAISE EXCEPTION 'Booking % has no successful payment to refund', p_booking_id;
    END IF;

    p_refund_amount := ROUND(v_amount_paid * v_refund_pct, 2);

    UPDATE PAYMENT
       SET status = 'REFUNDED',
           refund_amount = p_refund_amount
     WHERE payment_id = v_payment_id;

    -- trg_release_seats (03_triggers.sql) will automatically set
    -- is_active = FALSE on this booking's seats once status changes.
    UPDATE BOOKING SET status = 'CANCELLED' WHERE booking_id = p_booking_id;
END;
$$;
