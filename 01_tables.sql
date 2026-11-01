-- CineBook | 01_tables.sql
-- Creates all 13 relations from Table 3 of the mid-sem report.
-- Run 00_extensions.sql before this file.
-- Order matters: a table can only reference a table that already exists,
-- so this follows the dependency chain:
-- APP_USER -> CITY -> VENUE -> SCREEN -> SEAT -> MOVIE -> MOVIE_SHOW
-- -> SHOW_PRICE -> COUPON -> BOOKING -> BOOKING_SEAT -> PAYMENT -> BOOKING_AUDIT

-- ---------------------------------------------------------------------
-- 1. APP_USER
-- ---------------------------------------------------------------------
CREATE TABLE APP_USER (
    user_id         BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    phone           TEXT,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- 2. CITY
-- ---------------------------------------------------------------------
CREATE TABLE CITY (
    city_id     BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    state       TEXT NOT NULL,
    CONSTRAINT uq_city_name_state UNIQUE (name, state)
);

-- ---------------------------------------------------------------------
-- 3. VENUE
-- note: manager_id references APP_USER; the "must be role MANAGER" rule
-- cannot be written as a plain FK/CHECK, so it is enforced by a trigger
-- in 03_triggers.sql (trg_venue_manager_role).
-- ---------------------------------------------------------------------
CREATE TABLE VENUE (
    venue_id    BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    address     TEXT NOT NULL,
    city_id     BIGINT NOT NULL REFERENCES CITY (city_id),
    manager_id  BIGINT NOT NULL REFERENCES APP_USER (user_id)
);

-- ---------------------------------------------------------------------
-- 4. SCREEN
-- ---------------------------------------------------------------------
CREATE TABLE SCREEN (
    screen_id   BIGSERIAL PRIMARY KEY,
    venue_id    BIGINT NOT NULL REFERENCES VENUE (venue_id) ON DELETE CASCADE,
    screen_name TEXT NOT NULL,
    CONSTRAINT uq_screen_venue_name UNIQUE (venue_id, screen_name)
);

-- ---------------------------------------------------------------------
-- 5. SEAT (weak entity: identified only within its screen)
-- ---------------------------------------------------------------------
CREATE TABLE SEAT (
    screen_id   BIGINT NOT NULL REFERENCES SCREEN (screen_id) ON DELETE CASCADE,
    seat_no     TEXT NOT NULL,
    category    TEXT NOT NULL,
    PRIMARY KEY (screen_id, seat_no),
    CONSTRAINT uq_seat_screen_no_category UNIQUE (screen_id, seat_no, category)
);

-- ---------------------------------------------------------------------
-- 6. MOVIE
-- ---------------------------------------------------------------------
CREATE TABLE MOVIE (
    movie_id        BIGSERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    duration_min    INTEGER NOT NULL,
    language        TEXT NOT NULL,
    genre           TEXT,
    release_date    DATE
);

-- ---------------------------------------------------------------------
-- 7. MOVIE_SHOW
-- note: the "two shows on the same screen may not overlap" rule (R3)
-- is enforced by an EXCLUDE constraint added in 02_constraints.sql,
-- because a plain CHECK cannot compare rows against each other.
-- ---------------------------------------------------------------------
CREATE TABLE MOVIE_SHOW (
    show_id     BIGSERIAL PRIMARY KEY,
    movie_id    BIGINT NOT NULL REFERENCES MOVIE (movie_id),
    screen_id   BIGINT NOT NULL REFERENCES SCREEN (screen_id),
    start_time  TIMESTAMPTZ NOT NULL,
    end_time    TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_show_id_screen UNIQUE (show_id, screen_id)
);

-- ---------------------------------------------------------------------
-- 8. SHOW_PRICE (weak entity: identified by show_id + category)
-- ---------------------------------------------------------------------
CREATE TABLE SHOW_PRICE (
    show_id     BIGINT NOT NULL REFERENCES MOVIE_SHOW (show_id) ON DELETE CASCADE,
    category    TEXT NOT NULL,
    price       NUMERIC(10, 2) NOT NULL,
    PRIMARY KEY (show_id, category)
);

-- ---------------------------------------------------------------------
-- 9. COUPON
-- ---------------------------------------------------------------------
CREATE TABLE COUPON (
    coupon_id       BIGSERIAL PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,
    discount_type   TEXT NOT NULL,
    discount_value  NUMERIC(10, 2) NOT NULL,
    valid_to        TIMESTAMPTZ,
    max_uses        INTEGER          -- NULL means unlimited uses
);

-- ---------------------------------------------------------------------
-- 10. BOOKING
-- movie_title / venue_name / screen_name / show_start are write-once
-- "sale-time snapshot" columns (R11) -- copied in when the booking is
-- made so a ticket never changes even if the movie/venue/screen is
-- later renamed. They are filled by the booking procedure, never by
-- a plain UPDATE (see 04_procedures.sql).
-- ---------------------------------------------------------------------
CREATE TABLE BOOKING (
    booking_id          BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES APP_USER (user_id),
    show_id             BIGINT NOT NULL REFERENCES MOVIE_SHOW (show_id),
    coupon_id           BIGINT REFERENCES COUPON (coupon_id),   -- NULL = no coupon used
    status              TEXT NOT NULL,
    booked_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    hold_expires_at     TIMESTAMPTZ,
    discount_amount     NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(10, 2) NOT NULL,
    movie_title         TEXT NOT NULL,
    venue_name          TEXT NOT NULL,
    screen_name         TEXT NOT NULL,
    show_start          TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_booking_id_show UNIQUE (booking_id, show_id)
);

-- fast lookup for "my bookings", newest first, no joins needed
CREATE INDEX idx_booking_user_booked_at ON BOOKING (user_id, booked_at DESC);

-- ---------------------------------------------------------------------
-- 11. BOOKING_SEAT  (maps the ternary "reserves" relationship:
-- BOOKING -- SEAT -- SHOW_PRICE)
-- The four composite foreign keys below are what make an inconsistent
-- row impossible without needing a trigger -- see the report's
-- "why four composite foreign keys" box.
-- ---------------------------------------------------------------------
CREATE TABLE BOOKING_SEAT (
    booking_id      BIGINT NOT NULL,
    screen_id       BIGINT NOT NULL,
    seat_no         TEXT NOT NULL,
    show_id         BIGINT NOT NULL,
    seat_category   TEXT NOT NULL,   -- snapshot of SEAT.category at booking time
    list_price      NUMERIC(10, 2) NOT NULL,  -- snapshot of SHOW_PRICE.price
    price_paid      NUMERIC(10, 2),           -- NULL until the booking is CONFIRMED
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (booking_id, screen_id, seat_no),

    -- (a) seat belongs to the same booking's show
    CONSTRAINT fk_bs_booking
        FOREIGN KEY (booking_id, show_id)
        REFERENCES BOOKING (booking_id, show_id),

    -- (b) the show really runs on this screen
    CONSTRAINT fk_bs_show_screen
        FOREIGN KEY (show_id, screen_id)
        REFERENCES MOVIE_SHOW (show_id, screen_id),

    -- (c) the seat exists on that screen with the stored category
    CONSTRAINT fk_bs_seat
        FOREIGN KEY (screen_id, seat_no, seat_category)
        REFERENCES SEAT (screen_id, seat_no, category),

    -- (d) that category actually has a price for this show
    CONSTRAINT fk_bs_show_price
        FOREIGN KEY (show_id, seat_category)
        REFERENCES SHOW_PRICE (show_id, category)
);

-- R2: at most one ACTIVE booking per seat per show.
-- A plain UNIQUE constraint can't do this (it would block cancelled
-- rows from ever being reused) -- a partial unique index can, because
-- it only looks at rows where is_active is true.
CREATE UNIQUE INDEX uq_active_seat_per_show
    ON BOOKING_SEAT (show_id, screen_id, seat_no)
    WHERE is_active;

-- ---------------------------------------------------------------------
-- 12. PAYMENT
-- ---------------------------------------------------------------------
CREATE TABLE PAYMENT (
    payment_id      BIGSERIAL PRIMARY KEY,
    booking_id      BIGINT NOT NULL REFERENCES BOOKING (booking_id),
    method          TEXT NOT NULL,
    amount          NUMERIC(10, 2) NOT NULL,
    status          TEXT NOT NULL,
    paid_at         TIMESTAMPTZ,
    refund_amount   NUMERIC(10, 2)
);

-- ---------------------------------------------------------------------
-- 13. BOOKING_AUDIT
-- Rows here are written ONLY by the trigger in 03_triggers.sql --
-- never insert into this table directly from the application.
-- ---------------------------------------------------------------------
CREATE TABLE BOOKING_AUDIT (
    audit_id    BIGSERIAL PRIMARY KEY,
    booking_id  BIGINT NOT NULL REFERENCES BOOKING (booking_id),
    old_status  TEXT,
    new_status  TEXT NOT NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
