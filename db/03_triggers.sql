-- CineBook | 03_triggers.sql
-- All rules that a plain CHECK/FK cannot express (Section 5 of the report).
-- Run this after 02_constraints.sql.

-- =======================================================================
-- TRIGGER 1: Manager check
-- A venue's manager_id must point to a user whose role is MANAGER.
-- (This can't be a CHECK because it needs to look into another table.)
-- =======================================================================
CREATE OR REPLACE FUNCTION fn_check_venue_manager()
RETURNS TRIGGER AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM APP_USER WHERE user_id = NEW.manager_id;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'VENUE.manager_id % does not exist in APP_USER', NEW.manager_id;
    END IF;

    IF v_role <> 'MANAGER' THEN
        RAISE EXCEPTION
            'VENUE.manager_id % must belong to a user with role MANAGER, found role %',
            NEW.manager_id, v_role;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venue_manager_role
    BEFORE INSERT OR UPDATE OF manager_id ON VENUE
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_venue_manager();


-- =======================================================================
-- TRIGGER 2: Booking audit log
-- Every time BOOKING.status changes, write a row to BOOKING_AUDIT.
-- Nothing else should ever insert into BOOKING_AUDIT by hand.
-- =======================================================================
CREATE OR REPLACE FUNCTION fn_audit_booking_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO BOOKING_AUDIT (booking_id, old_status, new_status)
        VALUES (NEW.booking_id, NULL, NEW.status);
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO BOOKING_AUDIT (booking_id, old_status, new_status)
        VALUES (NEW.booking_id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_booking_audit
    AFTER INSERT OR UPDATE OF status ON BOOKING
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_booking_status();


-- =======================================================================
-- TRIGGER 3: is_active mirror
-- When a booking becomes CANCELLED or EXPIRED, mark every one of its
-- BOOKING_SEAT rows as is_active = false, so the partial unique index
-- immediately frees those seats for other bookings.
-- =======================================================================
CREATE OR REPLACE FUNCTION fn_release_seats_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('CANCELLED', 'EXPIRED')
       AND NEW.status IS DISTINCT FROM OLD.status THEN
        UPDATE BOOKING_SEAT
           SET is_active = FALSE
         WHERE booking_id = NEW.booking_id
           AND is_active = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_release_seats
    AFTER UPDATE OF status ON BOOKING
    FOR EACH ROW
    EXECUTE FUNCTION fn_release_seats_on_status_change();


-- =======================================================================
-- TRIGGER 4: Seat-count rule (1 to 6 seats per booking)
-- A booking's seats are inserted as separate BOOKING_SEAT rows AFTER
-- the BOOKING row itself exists, so this must be checked once all the
-- seats for that booking attempt are in -- hence DEFERRABLE INITIALLY
-- DEFERRED, which runs the check only at COMMIT time (or at the end
-- of the stored procedure that does SET CONSTRAINTS ... IMMEDIATE).
-- =======================================================================
CREATE OR REPLACE FUNCTION fn_check_seat_count()
RETURNS TRIGGER AS $$
DECLARE
    v_booking_id BIGINT;
    v_count      INTEGER;
BEGIN
    v_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);

    SELECT COUNT(*) INTO v_count
    FROM BOOKING_SEAT
    WHERE booking_id = v_booking_id;

    IF v_count < 1 OR v_count > 6 THEN
        RAISE EXCEPTION
            'Booking % must have between 1 and 6 seats, has %',
            v_booking_id, v_count;
    END IF;

    RETURN NULL;  -- return value is ignored for AFTER triggers
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_booking_seat_count
    AFTER INSERT OR DELETE ON BOOKING_SEAT
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_seat_count();


-- =======================================================================
-- TRIGGER 5: Confirmation rule (deferred constraint trigger)
-- When a booking's status becomes CONFIRMED, by commit time:
--   (a) there must be a PAYMENT row for it with status SUCCESS whose
--       amount equals BOOKING.total_amount,
--   (b) every active BOOKING_SEAT row for it must have price_paid set
--       (not NULL),
--   (c) sum(price_paid) across its active seats must equal total_amount.
-- This is deferred so the backend can first set status = CONFIRMED,
-- then insert the PAYMENT row and update price_paid, all inside the
-- same transaction, and only have this checked at COMMIT.
-- =======================================================================
CREATE OR REPLACE FUNCTION fn_check_booking_confirmation()
RETURNS TRIGGER AS $$
DECLARE
    v_paid_ok     BOOLEAN;
    v_unset_seats INTEGER;
    v_seat_sum    NUMERIC(10, 2);
BEGIN
    IF NEW.status <> 'CONFIRMED' THEN
        RETURN NEW;
    END IF;

    -- (a) a matching successful payment exists
    SELECT EXISTS (
        SELECT 1 FROM PAYMENT
        WHERE booking_id = NEW.booking_id
          AND status = 'SUCCESS'
          AND amount = NEW.total_amount
    ) INTO v_paid_ok;

    IF NOT v_paid_ok THEN
        RAISE EXCEPTION
            'Booking % is CONFIRMED but has no matching SUCCESS payment of amount %',
            NEW.booking_id, NEW.total_amount;
    END IF;

    -- (b) no active seat is left with price_paid still NULL
    SELECT COUNT(*) INTO v_unset_seats
    FROM BOOKING_SEAT
    WHERE booking_id = NEW.booking_id
      AND is_active = TRUE
      AND price_paid IS NULL;

    IF v_unset_seats > 0 THEN
        RAISE EXCEPTION
            'Booking % is CONFIRMED but % active seat(s) have no price_paid set',
            NEW.booking_id, v_unset_seats;
    END IF;

    -- (c) the seats' price_paid adds up to total_amount
    SELECT COALESCE(SUM(price_paid), 0) INTO v_seat_sum
    FROM BOOKING_SEAT
    WHERE booking_id = NEW.booking_id
      AND is_active = TRUE;

    IF v_seat_sum <> NEW.total_amount THEN
        RAISE EXCEPTION
            'Booking %: sum(price_paid) = % does not match total_amount = %',
            NEW.booking_id, v_seat_sum, NEW.total_amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_booking_confirmation_check
    AFTER INSERT OR UPDATE OF status, total_amount ON BOOKING
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_booking_confirmation();
