-- CineBook | 02_constraints.sql
-- Adds every CHECK constraint and the one EXCLUDE constraint.
-- Run this after 01_tables.sql.
-- These are kept in a separate file (instead of inline in CREATE TABLE)
-- so the "business rules" are easy to find and review in one place.

-- ---------------------------------------------------------------------
-- APP_USER
-- ---------------------------------------------------------------------
ALTER TABLE APP_USER
    ADD CONSTRAINT chk_user_role
    CHECK (role IN ('CUSTOMER', 'MANAGER', 'ADMIN'));

-- ---------------------------------------------------------------------
-- SEAT
-- ---------------------------------------------------------------------
ALTER TABLE SEAT
    ADD CONSTRAINT chk_seat_category
    CHECK (category IN ('REGULAR', 'PREMIUM', 'RECLINER'));

-- ---------------------------------------------------------------------
-- MOVIE
-- ---------------------------------------------------------------------
ALTER TABLE MOVIE
    ADD CONSTRAINT chk_movie_duration
    CHECK (duration_min > 0);

-- ---------------------------------------------------------------------
-- MOVIE_SHOW
-- ---------------------------------------------------------------------
ALTER TABLE MOVIE_SHOW
    ADD CONSTRAINT chk_show_time_order
    CHECK (end_time > start_time);

-- R3: no two shows on the same screen may overlap in time.
-- This is a cross-row rule, so it needs an EXCLUDE constraint
-- (requires the btree_gist extension from 00_extensions.sql).
-- The time range is "half-open" ([start, end)) so back-to-back shows
-- (one ending exactly when the next starts) are still allowed.
ALTER TABLE MOVIE_SHOW
    ADD CONSTRAINT excl_show_no_overlap
    EXCLUDE USING gist (
        screen_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
    );

-- ---------------------------------------------------------------------
-- SHOW_PRICE
-- ---------------------------------------------------------------------
ALTER TABLE SHOW_PRICE
    ADD CONSTRAINT chk_show_price_category
    CHECK (category IN ('REGULAR', 'PREMIUM', 'RECLINER'));

ALTER TABLE SHOW_PRICE
    ADD CONSTRAINT chk_show_price_positive
    CHECK (price > 0);

-- ---------------------------------------------------------------------
-- COUPON
-- ---------------------------------------------------------------------
ALTER TABLE COUPON
    ADD CONSTRAINT chk_coupon_type
    CHECK (discount_type IN ('PERCENT', 'FLAT'));

ALTER TABLE COUPON
    ADD CONSTRAINT chk_coupon_value
    CHECK (
        discount_value > 0
        AND (discount_type <> 'PERCENT' OR discount_value <= 100)
    );

ALTER TABLE COUPON
    ADD CONSTRAINT chk_coupon_max_uses
    CHECK (max_uses IS NULL OR max_uses > 0);

-- ---------------------------------------------------------------------
-- BOOKING
-- ---------------------------------------------------------------------
ALTER TABLE BOOKING
    ADD CONSTRAINT chk_booking_status
    CHECK (status IN ('HELD', 'CONFIRMED', 'CANCELLED', 'EXPIRED'));

ALTER TABLE BOOKING
    ADD CONSTRAINT chk_booking_discount_nonneg
    CHECK (discount_amount >= 0);

ALTER TABLE BOOKING
    ADD CONSTRAINT chk_booking_total_positive
    CHECK (total_amount > 0);

-- ---------------------------------------------------------------------
-- BOOKING_SEAT
-- ---------------------------------------------------------------------
ALTER TABLE BOOKING_SEAT
    ADD CONSTRAINT chk_bs_list_price_positive
    CHECK (list_price > 0);

-- price_paid is NULL while the booking is still HELD, and must sit
-- between 0 and list_price once the booking is CONFIRMED (R4).
ALTER TABLE BOOKING_SEAT
    ADD CONSTRAINT chk_bs_price_paid_range
    CHECK (
        price_paid IS NULL
        OR (price_paid >= 0 AND price_paid <= list_price)
    );

-- ---------------------------------------------------------------------
-- PAYMENT
-- ---------------------------------------------------------------------
ALTER TABLE PAYMENT
    ADD CONSTRAINT chk_payment_method
    CHECK (method IN ('UPI', 'CARD', 'NETBANKING', 'WALLET'));

ALTER TABLE PAYMENT
    ADD CONSTRAINT chk_payment_status
    CHECK (status IN ('INITIATED', 'SUCCESS', 'FAILED', 'REFUNDED'));

ALTER TABLE PAYMENT
    ADD CONSTRAINT chk_payment_amount_positive
    CHECK (amount > 0);

ALTER TABLE PAYMENT
    ADD CONSTRAINT chk_payment_refund_range
    CHECK (
        refund_amount IS NULL
        OR (refund_amount >= 0 AND refund_amount <= amount)
    );
