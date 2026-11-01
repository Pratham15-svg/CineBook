-- CineBook | db/tests/smoke_test.sql
-- Quick end-to-end check that the schema, triggers and procedures work.
-- Everything runs inside one transaction and is ROLLED BACK at the end,
-- so it leaves NO data behind. Safe to run any number of times.
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
    v_mgr BIGINT; v_cust BIGINT; v_city BIGINT; v_venue BIGINT; v_screen BIGINT;
    v_movie BIGINT; v_show BIGINT; v_bid BIGINT; v_bid2 BIGINT; v_pid BIGINT;
    v_refund NUMERIC; v_status TEXT; v_active INT; v_audit INT;
BEGIN
    INSERT INTO APP_USER(name,email,password_hash,role) VALUES ('Mgr','mgr@t.com','x','MANAGER') RETURNING user_id INTO v_mgr;
    INSERT INTO APP_USER(name,email,password_hash,role) VALUES ('Cust','cust@t.com','x','CUSTOMER') RETURNING user_id INTO v_cust;
    INSERT INTO CITY(name,state) VALUES ('Hyderabad','Telangana') RETURNING city_id INTO v_city;
    INSERT INTO VENUE(name,address,city_id,manager_id) VALUES ('PVR','Road 1',v_city,v_mgr) RETURNING venue_id INTO v_venue;
    INSERT INTO SCREEN(venue_id,screen_name) VALUES (v_venue,'Screen 1') RETURNING screen_id INTO v_screen;
    INSERT INTO SEAT VALUES (v_screen,'A1','REGULAR'),(v_screen,'A2','PREMIUM'),
        (v_screen,'A3','REGULAR'),(v_screen,'A4','REGULAR'),(v_screen,'A5','REGULAR'),(v_screen,'A6','REGULAR'),(v_screen,'A7','REGULAR');
    INSERT INTO MOVIE(title,duration_min,language) VALUES ('Test Movie',120,'English') RETURNING movie_id INTO v_movie;
    INSERT INTO MOVIE_SHOW(movie_id,screen_id,start_time,end_time)
        VALUES (v_movie,v_screen,now()+interval '3 days',now()+interval '3 days 2 hours') RETURNING show_id INTO v_show;
    INSERT INTO SHOW_PRICE VALUES (v_show,'REGULAR',200),(v_show,'PREMIUM',300);

    -- 0. seven seats (all free) must be rejected by the seat-count trigger
    BEGIN
        CALL sp_create_booking(v_cust, v_show, ARRAY['A1','A2','A3','A4','A5','A6','A7'], NULL, v_bid2);
        RAISE EXCEPTION 'FAIL: 7-seat booking was NOT rejected';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
        RAISE NOTICE 'PASS 0: 7-seat booking rejected (%)', SQLSTATE;
    END;

    -- 1. hold, pay
    CALL sp_create_booking(v_cust, v_show, ARRAY['A1','A2'], NULL, v_bid);
    CALL sp_confirm_booking(v_bid, 'UPI', v_pid);
    SELECT status INTO v_status FROM BOOKING WHERE booking_id = v_bid;
    IF v_status <> 'CONFIRMED' THEN RAISE EXCEPTION 'FAIL: expected CONFIRMED, got %', v_status; END IF;
    RAISE NOTICE 'PASS 1: booking held and confirmed';

    -- 2. double booking must be rejected
    BEGIN
        CALL sp_create_booking(v_cust, v_show, ARRAY['A1'], NULL, v_bid2);
        RAISE EXCEPTION 'FAIL: double booking was NOT rejected';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'PASS 2: double booking rejected (23505)';
    END;

    -- 4. overlapping show must be rejected
    BEGIN
        INSERT INTO MOVIE_SHOW(movie_id,screen_id,start_time,end_time)
            VALUES (v_movie,v_screen,now()+interval '3 days 1 hour',now()+interval '3 days 3 hours');
        RAISE EXCEPTION 'FAIL: overlapping show was NOT rejected';
    EXCEPTION WHEN exclusion_violation THEN
        RAISE NOTICE 'PASS 4: overlapping show rejected (23P01)';
    END;

    -- 5. non-manager as venue manager must be rejected
    BEGIN
        INSERT INTO VENUE(name,address,city_id,manager_id) VALUES ('Bad','x',v_city,v_cust);
        RAISE EXCEPTION 'FAIL: non-manager venue was NOT rejected';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
        RAISE NOTICE 'PASS 5: non-manager as venue manager rejected';
    END;

    -- 6. cancel (show is 3 days away -> 100% refund), seats freed, seat bookable again
    CALL sp_cancel_booking(v_bid, v_refund);
    IF v_refund <> 500 THEN RAISE EXCEPTION 'FAIL: expected refund 500, got %', v_refund; END IF;
    SELECT count(*) INTO v_active FROM BOOKING_SEAT WHERE booking_id = v_bid AND is_active;
    IF v_active <> 0 THEN RAISE EXCEPTION 'FAIL: seats not released'; END IF;
    CALL sp_create_booking(v_cust, v_show, ARRAY['A1'], NULL, v_bid2);
    RAISE NOTICE 'PASS 6: cancelled, full refund %, seat bookable again', v_refund;

    -- 7. audit log
    SELECT count(*) INTO v_audit FROM BOOKING_AUDIT WHERE booking_id = v_bid;
    IF v_audit <> 3 THEN RAISE EXCEPTION 'FAIL: expected 3 audit rows, got %', v_audit; END IF;
    RAISE NOTICE 'PASS 7: audit log has % rows for the booking', v_audit;
END $$;

ROLLBACK;
\echo 'ALL SMOKE TESTS PASSED (nothing was saved)'
