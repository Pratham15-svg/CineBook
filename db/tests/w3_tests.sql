-- CineBook | db/tests/w3_tests.sql   (Step 3 of the build plan, README Phase 2)
-- Workflow W3: try to break the database on purpose and record how it reacts.
--
-- Every test says which error it EXPECTS (a SQLSTATE code, or OK for the
-- "this must succeed" tests). The script tries the bad action, catches the
-- error, and logs expected vs actual. A test PASSES when they match.
--
-- Safe to run any number of times:
--   * it builds its own test data (names starting "W3 ") inside ONE
--     transaction and ROLLS BACK at the end, so nothing is saved;
--   * it works on an empty database AND on the seeded one.
-- The two tests at the end (T36, T37) use the seeded data if it is present.
--
-- Run it and keep the output for the report:
--   docker exec -i cinebook-db psql -U postgres -d cinebook < db/tests/w3_tests.sql > docs/w3_test_log.txt
--
-- SQLSTATE cheat-sheet used below:
--   23505 unique_violation     23503 foreign_key_violation
--   23514 check_violation      23P01 exclusion_violation
--   P0001 RAISE EXCEPTION (our own triggers and procedures)
\set ON_ERROR_STOP on
\pset pager off
\pset border 2
BEGIN;

CREATE TEMP TABLE w3_log (
    seq             SERIAL,
    test_id         TEXT,
    rule            TEXT,
    descr           TEXT,
    expected        TEXT,
    actual          TEXT,
    constraint_name TEXT,
    message         TEXT,
    result          TEXT
);

CREATE FUNCTION pg_temp.w3_record(p_id TEXT, p_rule TEXT, p_desc TEXT, p_expected TEXT,
                                  p_state TEXT, p_con TEXT, p_msg TEXT)
RETURNS VOID LANGUAGE sql AS $f$
    INSERT INTO w3_log (test_id, rule, descr, expected, actual, constraint_name, message, result)
    VALUES (p_id, p_rule, p_desc, p_expected, COALESCE(p_state, 'OK'), p_con,
            left(regexp_replace(COALESCE(p_msg, ''), '\s+', ' ', 'g'), 100),
            CASE WHEN COALESCE(p_state, 'OK') = p_expected THEN 'PASS' ELSE 'FAIL' END);
$f$;

DO $$
DECLARE
    v_mgr BIGINT; v_cust BIGINT; v_city BIGINT; v_venue BIGINT;
    v_s1 BIGINT; v_s2 BIGINT;                                  -- screens
    v_movie BIGINT;
    v_main BIGINT; v_soon BIGINT; v_ten BIGINT; v_past BIGINT; -- shows
    v_c_exp BIGINT; v_c_lim BIGINT;
    v_b BIGINT; v_b1 BIGINT; v_bh BIGINT; v_tmp BIGINT; v_pid BIGINT;
    v_refund NUMERIC; v_n INT; v_amt NUMERIC;
    v_s TEXT; v_c TEXT; v_m TEXT;                              -- caught error
    v_seat TEXT; v_show BIGINT; v_scr BIGINT; v_start TIMESTAMPTZ;
BEGIN
    -- ------------------------------------------------------------------
    -- Test data (all rolled back at the end)
    -- ------------------------------------------------------------------
    INSERT INTO APP_USER(name,email,password_hash,role) VALUES ('W3 Manager','w3mgr@w3.test','x','MANAGER') RETURNING user_id INTO v_mgr;
    INSERT INTO APP_USER(name,email,password_hash,role) VALUES ('W3 Customer','w3cust@w3.test','x','CUSTOMER') RETURNING user_id INTO v_cust;
    INSERT INTO CITY(name,state) VALUES ('W3 City','W3 State') RETURNING city_id INTO v_city;
    INSERT INTO VENUE(name,address,city_id,manager_id) VALUES ('W3 Venue','1 Test Road',v_city,v_mgr) RETURNING venue_id INTO v_venue;
    INSERT INTO SCREEN(venue_id,screen_name) VALUES (v_venue,'W3 Screen 1') RETURNING screen_id INTO v_s1;
    INSERT INTO SCREEN(venue_id,screen_name) VALUES (v_venue,'W3 Screen 2') RETURNING screen_id INTO v_s2;
    INSERT INTO SEAT(screen_id,seat_no,category)
        SELECT v_s1, 'A'||g, CASE WHEN g = 2 THEN 'PREMIUM' ELSE 'REGULAR' END FROM generate_series(1,10) g;
    INSERT INTO SEAT(screen_id,seat_no,category) VALUES (v_s2,'B1','REGULAR'),(v_s2,'B2','REGULAR'),(v_s2,'B3','REGULAR');
    INSERT INTO MOVIE(title,duration_min,language) VALUES ('W3 Movie',120,'English') RETURNING movie_id INTO v_movie;

    -- screen 1: one show 3 days from now (the main test show)
    INSERT INTO MOVIE_SHOW(movie_id,screen_id,start_time,end_time)
        VALUES (v_movie,v_s1,now()+interval '3 days',now()+interval '3 days 2 hours') RETURNING show_id INTO v_main;
    -- screen 2: a show starting in 90 min, one in 10 h, one that started 2 days ago
    INSERT INTO MOVIE_SHOW(movie_id,screen_id,start_time,end_time)
        VALUES (v_movie,v_s2,now()+interval '90 minutes',now()+interval '210 minutes') RETURNING show_id INTO v_soon;
    INSERT INTO MOVIE_SHOW(movie_id,screen_id,start_time,end_time)
        VALUES (v_movie,v_s2,now()+interval '10 hours',now()+interval '12 hours') RETURNING show_id INTO v_ten;
    INSERT INTO MOVIE_SHOW(movie_id,screen_id,start_time,end_time)
        VALUES (v_movie,v_s2,now()-interval '2 days',now()-interval '2 days'+interval '2 hours') RETURNING show_id INTO v_past;
    INSERT INTO SHOW_PRICE VALUES (v_main,'REGULAR',200),(v_main,'PREMIUM',300);
    INSERT INTO SHOW_PRICE VALUES (v_soon,'REGULAR',150),(v_ten,'REGULAR',150),(v_past,'REGULAR',150);

    INSERT INTO COUPON(code,discount_type,discount_value,valid_to,max_uses)
        VALUES ('W3EXPIRED','PERCENT',20,now()-interval '1 day',NULL) RETURNING coupon_id INTO v_c_exp;
    INSERT INTO COUPON(code,discount_type,discount_value,valid_to,max_uses)
        VALUES ('W3LIMIT1','FLAT',50,NULL,1) RETURNING coupon_id INTO v_c_lim;

    -- ==================================================================
    -- GROUP 1: booking rules (seat count, coupons, show must be in future)
    -- ==================================================================
    -- T01  7 seats in one booking (rule: 1 to 6 seats)
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_create_booking(v_cust, v_main, ARRAY['A1','A2','A3','A4','A5','A6','A7'], NULL, v_tmp);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T01','R5','Book 7 seats in one booking','P0001',v_s,v_c,v_m);

    -- T02  a booking with no seats at all
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_create_booking(v_cust, v_main, ARRAY[]::TEXT[], NULL, v_tmp);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T02','R5','Book 0 seats (empty seat list)','23514',v_s,v_c,v_m);

    -- T03  a seat that does not exist on the show's screen
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_create_booking(v_cust, v_main, ARRAY['Z99'], NULL, v_tmp);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T03','R1','Book a seat that is not on the screen','P0001',v_s,v_c,v_m);

    -- T04  booking a show that has already started
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_create_booking(v_cust, v_past, ARRAY['B1'], NULL, v_tmp);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T04','R3/R5','Book a show that already started','P0001',v_s,v_c,v_m);

    -- T05  expired coupon
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_create_booking(v_cust, v_main, ARRAY['A8'], 'W3EXPIRED', v_tmp);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T05','R10','Use an expired coupon','P0001',v_s,v_c,v_m);

    -- T06  coupon that does not exist
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_create_booking(v_cust, v_main, ARRAY['A8'], 'NO-SUCH-CODE', v_tmp);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T06','R10','Use a coupon code that does not exist','P0001',v_s,v_c,v_m);

    -- T07  coupon usage limit (max_uses = 1): first use OK, second use rejected
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_create_booking(v_cust, v_main, ARRAY['A9'], 'W3LIMIT1', v_tmp);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T07','R10','Coupon with max_uses=1: first use','OK',v_s,v_c,v_m);

    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_create_booking(v_cust, v_main, ARRAY['A10'], 'W3LIMIT1', v_tmp);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T08','R10','Coupon with max_uses=1: second use','P0001',v_s,v_c,v_m);

    -- ==================================================================
    -- GROUP 2: the happy path, then double booking
    -- ==================================================================
    -- T09  normal booking: hold A1+A2, pay by UPI -> CONFIRMED, price_paid adds up
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_create_booking(v_cust, v_main, ARRAY['A1','A2'], NULL, v_b1);
        CALL sp_confirm_booking(v_b1, 'UPI', v_pid);
        SELECT total_amount INTO v_amt FROM BOOKING WHERE booking_id = v_b1 AND status = 'CONFIRMED';
        IF v_amt IS NULL OR v_amt <> 500
           OR (SELECT SUM(price_paid) FROM BOOKING_SEAT WHERE booking_id = v_b1) <> v_amt THEN
            RAISE EXCEPTION 'booking not confirmed or price_paid does not add up' USING ERRCODE = 'W3001';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T09','R4/R5','Hold + pay a 2-seat booking (total 500)','OK',v_s,v_c,v_m);

    -- T10  double booking: same seat, same show, while the first booking is active
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_create_booking(v_cust, v_main, ARRAY['A1'], NULL, v_tmp);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T10','R2','Double-book a seat already CONFIRMED','23505',v_s,v_c,v_m);

    -- T11  pay for a booking that is already CONFIRMED
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_confirm_booking(v_b1, 'UPI', v_pid);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T11','R5','Pay twice for the same booking','P0001',v_s,v_c,v_m);

    -- T12  a held (unpaid) booking cannot be cancelled
    CALL sp_create_booking(v_cust, v_main, ARRAY['A3'], NULL, v_bh);
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_cancel_booking(v_bh, v_refund);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T12','R6','Cancel a booking that was never paid (HELD)','P0001',v_s,v_c,v_m);

    -- T13  paying after the 10-minute hold has run out
    UPDATE BOOKING SET hold_expires_at = now() - interval '1 minute' WHERE booking_id = v_bh;
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_confirm_booking(v_bh, 'CARD', v_pid);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T13','R5','Pay after the 10-minute hold expired','P0001',v_s,v_c,v_m);

    -- T14  an expired hold frees its seat (sweep + audit + seat bookable again)
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_expire_holds(v_n);
        IF v_n < 1 OR (SELECT count(*) FROM BOOKING_SEAT WHERE booking_id = v_bh AND is_active) <> 0 THEN
            RAISE EXCEPTION 'expired hold was not released' USING ERRCODE = 'W3001';
        END IF;
        CALL sp_create_booking(v_cust, v_main, ARRAY['A3'], NULL, v_tmp);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T14','R5','Expired hold frees the seat for someone else','OK',v_s,v_c,v_m);

    -- T15  failed payment is kept as history; retry makes a NEW payment row (R7)
    CALL sp_create_booking(v_cust, v_main, ARRAY['A4'], NULL, v_b);
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_record_failed_payment(v_b, 'CARD', v_pid);
        CALL sp_confirm_booking(v_b, 'UPI', v_pid);
        IF (SELECT count(*) FROM PAYMENT WHERE booking_id = v_b) <> 2
           OR (SELECT count(*) FROM PAYMENT WHERE booking_id = v_b AND status = 'FAILED') <> 1 THEN
            RAISE EXCEPTION 'expected 1 FAILED + 1 SUCCESS payment row' USING ERRCODE = 'W3001';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T15','R7','Failed payment, then retry (2 payment rows)','OK',v_s,v_c,v_m);

    -- T16  a failed payment cannot be recorded against a CONFIRMED booking
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_record_failed_payment(v_b1, 'CARD', v_pid);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T16','R7','Record a failed payment on a CONFIRMED booking','P0001',v_s,v_c,v_m);

    -- ==================================================================
    -- GROUP 3: cancellation and refunds
    -- ==================================================================
    -- T17  cancel less than 2 hours before the show
    CALL sp_create_booking(v_cust, v_soon, ARRAY['B1'], NULL, v_b);
    CALL sp_confirm_booking(v_b, 'UPI', v_pid);
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_cancel_booking(v_b, v_refund);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T17','R6','Cancel 90 minutes before the show','P0001',v_s,v_c,v_m);

    -- T18  cancel 10 hours before the show -> 50% refund
    CALL sp_create_booking(v_cust, v_ten, ARRAY['B2'], NULL, v_b);
    CALL sp_confirm_booking(v_b, 'UPI', v_pid);
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_cancel_booking(v_b, v_refund);
        IF v_refund <> 75 THEN
            RAISE EXCEPTION 'expected refund 75 (50%% of 150), got %', v_refund USING ERRCODE = 'W3001';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T18','R6','Cancel 10h before show: 50% refund (75 of 150)','OK',v_s,v_c,v_m);

    -- T19  cancel 3 days before the show -> 100% refund, seats freed, audit has 3 rows
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_cancel_booking(v_b1, v_refund);
        IF v_refund <> 500 THEN
            RAISE EXCEPTION 'expected refund 500, got %', v_refund USING ERRCODE = 'W3001';
        END IF;
        IF (SELECT count(*) FROM BOOKING_SEAT WHERE booking_id = v_b1 AND is_active) <> 0 THEN
            RAISE EXCEPTION 'seats were not released' USING ERRCODE = 'W3001';
        END IF;
        IF (SELECT count(*) FROM BOOKING_AUDIT WHERE booking_id = v_b1) <> 3 THEN
            RAISE EXCEPTION 'expected 3 audit rows (HELD, CONFIRMED, CANCELLED)' USING ERRCODE = 'W3001';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T19','R6/R9','Cancel 3 days before: 100% refund, seats freed, 3 audit rows','OK',v_s,v_c,v_m);

    -- T20  the seat from the cancelled booking can be booked again
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        CALL sp_create_booking(v_cust, v_main, ARRAY['A1'], NULL, v_tmp);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T20','R2','Re-book a seat after its booking was cancelled','OK',v_s,v_c,v_m);

    -- ==================================================================
    -- GROUP 4: schedule shows (overlap rule)
    -- ==================================================================
    -- T21  overlapping show on the same screen
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        INSERT INTO MOVIE_SHOW(movie_id,screen_id,start_time,end_time)
            VALUES (v_movie,v_s1,now()+interval '3 days 1 hour',now()+interval '3 days 3 hours');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T21','R3','Overlapping show on the same screen','23P01',v_s,v_c,v_m);

    -- T22  the same time slot on a DIFFERENT screen is fine
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        INSERT INTO MOVIE_SHOW(movie_id,screen_id,start_time,end_time)
            VALUES (v_movie,v_s2,now()+interval '3 days',now()+interval '3 days 2 hours');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T22','R3','Same time on a different screen is allowed','OK',v_s,v_c,v_m);

    -- T23  back-to-back show (starts exactly when the other ends) is allowed
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        INSERT INTO MOVIE_SHOW(movie_id,screen_id,start_time,end_time)
            SELECT v_movie, v_s1, end_time, end_time + interval '2 hours' FROM MOVIE_SHOW WHERE show_id = v_main;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T23','R3','Back-to-back show (end = next start) is allowed','OK',v_s,v_c,v_m);

    -- T24  a show that ends before it starts
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        INSERT INTO MOVIE_SHOW(movie_id,screen_id,start_time,end_time)
            VALUES (v_movie,v_s1,now()+interval '9 days',now()+interval '9 days' - interval '1 hour');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T24','R3','Show whose end time is before its start','23514',v_s,v_c,v_m);

    -- ==================================================================
    -- GROUP 5: price, role, category and value checks (CHECK constraints)
    -- ==================================================================
    -- T25  price of 0
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        INSERT INTO SHOW_PRICE VALUES (v_ten, 'PREMIUM', 0);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T25','R4','Show price = 0','23514',v_s,v_c,v_m);

    -- T26  negative price
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        INSERT INTO SHOW_PRICE VALUES (v_ten, 'PREMIUM', -50);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T26','R4','Show price = -50','23514',v_s,v_c,v_m);

    -- T27  seat category that is not REGULAR / PREMIUM / RECLINER
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        INSERT INTO SEAT VALUES (v_s2, 'B9', 'VIP');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T27','R1','Seat with category VIP','23514',v_s,v_c,v_m);

    -- T28  user role that is not CUSTOMER / MANAGER / ADMIN
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        INSERT INTO APP_USER(name,email,password_hash,role) VALUES ('Bad','badrole@w3.test','x','SUPERUSER');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T28','R8','User with role SUPERUSER','23514',v_s,v_c,v_m);

    -- T29  percentage coupon above 100
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        INSERT INTO COUPON(code,discount_type,discount_value) VALUES ('W3BAD','PERCENT',150);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T29','R10','PERCENT coupon worth 150%','23514',v_s,v_c,v_m);

    -- T30  price_paid above list_price
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        UPDATE BOOKING_SEAT SET price_paid = list_price + 1 WHERE booking_id = v_b1;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T30','R4','price_paid greater than list_price','23514',v_s,v_c,v_m);

    -- T31  e-mail that differs only by upper/lower case
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        INSERT INTO APP_USER(name,email,password_hash,role) VALUES ('Dup','W3CUST@W3.TEST','x','CUSTOMER');
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T31','R8','Duplicate e-mail, different letter case','23505',v_s,v_c,v_m);

    -- ==================================================================
    -- GROUP 6: foreign keys, triggers and history protection
    -- ==================================================================
    -- T32  venue manager who is not a MANAGER
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        INSERT INTO VENUE(name,address,city_id,manager_id) VALUES ('W3 Bad Venue','x',v_city,v_cust);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T32','R8','Assign a CUSTOMER as venue manager','P0001',v_s,v_c,v_m);

    -- T33  booking line whose seat is on a screen that does not run the show
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        INSERT INTO BOOKING_SEAT(booking_id,screen_id,seat_no,show_id,seat_category,list_price,price_paid,is_active)
            VALUES (v_b1, v_s2, 'B3', v_main, 'REGULAR', 200, NULL, FALSE);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T33','R1/R3','Booking line with a seat from another screen','23503',v_s,v_c,v_m);

    -- T34  booking line for a seat category that has no price on that show
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        INSERT INTO BOOKING_SEAT(booking_id,screen_id,seat_no,show_id,seat_category,list_price,price_paid,is_active)
            VALUES (v_b1, v_s1, 'A5', v_main, 'RECLINER', 200, NULL, FALSE);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T34','R4','Booking line with wrong seat category / no price','23503',v_s,v_c,v_m);

    -- T35  marking a booking CONFIRMED by hand, with no payment
    CALL sp_create_booking(v_cust, v_main, ARRAY['A5'], NULL, v_bh);
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        UPDATE BOOKING SET status = 'CONFIRMED' WHERE booking_id = v_bh;
        SET CONSTRAINTS trg_booking_confirmation_check IMMEDIATE;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T35','R5','Set status CONFIRMED with no SUCCESS payment','P0001',v_s,v_c,v_m);

    -- T36  deleting a booking that has payments / history
    v_s := NULL; v_c := NULL; v_m := NULL;
    BEGIN
        DELETE FROM BOOKING WHERE booking_id = v_b1;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
    END;
    PERFORM pg_temp.w3_record('T36','R2/R9','Delete a booking that has history','23503',v_s,v_c,v_m);

    -- ==================================================================
    -- GROUP 7: the same rules against the SEEDED data (skipped if empty)
    -- ==================================================================
    -- T37  double-book a seat that the seed script already booked
    SELECT bs.show_id, bs.screen_id, bs.seat_no INTO v_show, v_scr, v_seat
      FROM BOOKING_SEAT bs
      JOIN BOOKING b ON b.booking_id = bs.booking_id AND b.status = 'CONFIRMED'
      JOIN MOVIE_SHOW ms ON ms.show_id = bs.show_id
     WHERE bs.is_active AND ms.start_time > now() + interval '1 day'
       AND ms.screen_id NOT IN (v_s1, v_s2)
     LIMIT 1;
    IF FOUND THEN
        v_s := NULL; v_c := NULL; v_m := NULL;
        BEGIN
            CALL sp_create_booking(v_cust, v_show, ARRAY[v_seat], NULL, v_tmp);
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
        END;
        PERFORM pg_temp.w3_record('T37','R2','SEEDED: double-book a seat the seed already sold','23505',v_s,v_c,v_m);
    END IF;

    -- T38  overlapping show on a seeded screen
    SELECT ms.screen_id, ms.start_time INTO v_scr, v_start
      FROM MOVIE_SHOW ms WHERE ms.screen_id NOT IN (v_s1, v_s2) ORDER BY ms.show_id LIMIT 1;
    IF FOUND THEN
        v_s := NULL; v_c := NULL; v_m := NULL;
        BEGIN
            INSERT INTO MOVIE_SHOW(movie_id,screen_id,start_time,end_time)
                VALUES (v_movie, v_scr, v_start + interval '30 minutes', v_start + interval '150 minutes');
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_c = CONSTRAINT_NAME, v_m = MESSAGE_TEXT; v_s := SQLSTATE;
        END;
        PERFORM pg_temp.w3_record('T38','R3','SEEDED: overlap with a show the seed created','23P01',v_s,v_c,v_m);
    END IF;
END
$$;

-- ----------------------------------------------------------------------
-- The log (copy this into the report)
-- ----------------------------------------------------------------------
\echo
\echo '=== W3 CONSTRAINT TEST LOG ==='
SELECT test_id AS "Test", rule AS "Rule", descr AS "What was attempted",
       expected AS "Expected", actual AS "Got", result AS "Result"
  FROM w3_log ORDER BY seq;

\echo
\echo '=== Which constraint / trigger caught it, and the database message ==='
SELECT test_id AS "Test", COALESCE(constraint_name, '-') AS "Constraint / index", message AS "Database message"
  FROM w3_log WHERE actual <> 'OK' ORDER BY seq;

\echo
\echo '=== SUMMARY ==='
SELECT count(*) AS "Total tests",
       count(*) FILTER (WHERE result = 'PASS') AS "Passed",
       count(*) FILTER (WHERE result = 'FAIL') AS "Failed"
  FROM w3_log;

ROLLBACK;
\echo 'Nothing was saved: the test data was rolled back.'
