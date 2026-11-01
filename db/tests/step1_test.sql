-- CineBook | db/tests/step1_test.sql
-- Checks everything added in 05_indexes_views.sql.
-- Runs in one transaction and ROLLS BACK: leaves no data behind.
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
    v_mgr BIGINT; v_cust BIGINT; v_city BIGINT; v_venue BIGINT; v_screen BIGINT;
    v_movie BIGINT; v_show BIGINT; v_past_show BIGINT;
    v_b1 BIGINT; v_b2 BIGINT; v_b3 BIGINT; v_pid BIGINT; v_n INT;
    v_txt TEXT; v_num NUMERIC; v_rec RECORD;
BEGIN
    INSERT INTO APP_USER(name,email,password_hash,role) VALUES ('Mgr','mgr@t.com','x','MANAGER') RETURNING user_id INTO v_mgr;
    INSERT INTO APP_USER(name,email,password_hash,role) VALUES ('Cust','cust@t.com','x','CUSTOMER') RETURNING user_id INTO v_cust;
    INSERT INTO CITY(name,state) VALUES ('Hyderabad','Telangana') RETURNING city_id INTO v_city;
    INSERT INTO VENUE(name,address,city_id,manager_id) VALUES ('PVR','Road 1',v_city,v_mgr) RETURNING venue_id INTO v_venue;
    INSERT INTO SCREEN(venue_id,screen_name) VALUES (v_venue,'Screen 1') RETURNING screen_id INTO v_screen;
    INSERT INTO SEAT VALUES (v_screen,'A1','REGULAR'),(v_screen,'A2','PREMIUM'),(v_screen,'A3','REGULAR');
    INSERT INTO MOVIE(title,duration_min,language) VALUES ('Test Movie',120,'English') RETURNING movie_id INTO v_movie;
    INSERT INTO MOVIE_SHOW(movie_id,screen_id,start_time,end_time)
        VALUES (v_movie,v_screen,now()+interval '3 days',now()+interval '3 days 2 hours') RETURNING show_id INTO v_show;
    INSERT INTO SHOW_PRICE VALUES (v_show,'REGULAR',200),(v_show,'PREMIUM',300);
    -- a show in the past (for the future-show rule)
    INSERT INTO MOVIE_SHOW(movie_id,screen_id,start_time,end_time)
        VALUES (v_movie,v_screen,now()-interval '2 days',now()-interval '2 days' + interval '2 hours') RETURNING show_id INTO v_past_show;
    INSERT INTO SHOW_PRICE VALUES (v_past_show,'REGULAR',200),(v_past_show,'PREMIUM',300);

    -- T1: booking a show that already started is rejected
    BEGIN
        CALL sp_create_booking(v_cust, v_past_show, ARRAY['A1'], NULL, v_b2);
        RAISE EXCEPTION 'FAIL T1: past-show booking was NOT rejected';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
        RAISE NOTICE 'PASS T1: booking for a started show rejected';
    END;

    -- T2: ...unless the seed bypass setting is on
    PERFORM set_config('cinebook.allow_past_booking', 'on', true);
    CALL sp_create_booking(v_cust, v_past_show, ARRAY['A1'], NULL, v_b2);
    PERFORM set_config('cinebook.allow_past_booking', 'off', true);
    RAISE NOTICE 'PASS T2: seed bypass allows a back-dated booking';
    -- T3: email is unique ignoring case
    BEGIN
        INSERT INTO APP_USER(name,email,password_hash,role) VALUES ('Dup','MGR@T.COM','x','CUSTOMER');
        RAISE EXCEPTION 'FAIL T3: duplicate email (different case) was NOT rejected';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'PASS T3: email unique regardless of case';
    END;

    -- booking 1: A1 + A2 confirmed (total 500)
    CALL sp_create_booking(v_cust, v_show, ARRAY['A1','A2'], NULL, v_b1);
    CALL sp_confirm_booking(v_b1, 'UPI', v_pid);

    -- T4: seat map shows BOOKED for confirmed seats, AVAILABLE for the free one
    SELECT string_agg(seat_no||'='||seat_status, ',' ORDER BY seat_no) INTO v_txt FROM fn_seat_map(v_show);
    IF v_txt <> 'A1=BOOKED,A2=BOOKED,A3=AVAILABLE' THEN RAISE EXCEPTION 'FAIL T4: seat map was %', v_txt; END IF;
    RAISE NOTICE 'PASS T4: seat map -> %', v_txt;

    -- T5: a live hold shows HELD; once the hold runs out the seat shows AVAILABLE again
    CALL sp_create_booking(v_cust, v_show, ARRAY['A3'], NULL, v_b2);
    SELECT seat_status INTO v_txt FROM fn_seat_map(v_show) WHERE seat_no = 'A3';
    IF v_txt <> 'HELD' THEN RAISE EXCEPTION 'FAIL T5a: expected HELD, got %', v_txt; END IF;
    UPDATE BOOKING SET hold_expires_at = now() - interval '1 minute' WHERE booking_id = v_b2;
    SELECT seat_status INTO v_txt FROM fn_seat_map(v_show) WHERE seat_no = 'A3';
    IF v_txt <> 'AVAILABLE' THEN RAISE EXCEPTION 'FAIL T5b: expected AVAILABLE for expired hold, got %', v_txt; END IF;
    SELECT effective_status INTO v_txt FROM v_ticket WHERE booking_id = v_b2;
    IF v_txt <> 'EXPIRED' THEN RAISE EXCEPTION 'FAIL T5c: v_ticket effective_status was %', v_txt; END IF;
    RAISE NOTICE 'PASS T5: live hold = HELD, expired hold = AVAILABLE / EXPIRED';

    -- T6: sp_expire_holds really expires it, frees the seat, and logs the audit row
    CALL sp_expire_holds(v_n);
    IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL T6a: expected 1 expired, got %', v_n; END IF;
    SELECT status INTO v_txt FROM BOOKING WHERE booking_id = v_b2;
    IF v_txt <> 'EXPIRED' THEN RAISE EXCEPTION 'FAIL T6b: status was %', v_txt; END IF;
    SELECT count(*) INTO v_n FROM BOOKING_SEAT WHERE booking_id = v_b2 AND is_active;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL T6c: seat still active'; END IF;
    SELECT count(*) INTO v_n FROM BOOKING_AUDIT WHERE booking_id = v_b2 AND new_status = 'EXPIRED';
    IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL T6d: no EXPIRED audit row'; END IF;
    RAISE NOTICE 'PASS T6: sp_expire_holds expired 1 booking, seat released, audit logged';

    -- T7: failed payment is recorded and the booking stays HELD
    CALL sp_create_booking(v_cust, v_show, ARRAY['A3'], NULL, v_b3);
    CALL sp_record_failed_payment(v_b3, 'CARD', v_pid);
    SELECT status INTO v_txt FROM PAYMENT WHERE payment_id = v_pid;
    IF v_txt <> 'FAILED' THEN RAISE EXCEPTION 'FAIL T7a: payment status %', v_txt; END IF;
    SELECT status INTO v_txt FROM BOOKING WHERE booking_id = v_b3;
    IF v_txt <> 'HELD' THEN RAISE EXCEPTION 'FAIL T7b: booking status %', v_txt; END IF;
    BEGIN
        CALL sp_record_failed_payment(v_b1, 'CARD', v_pid);   -- v_b1 is CONFIRMED
        RAISE EXCEPTION 'FAIL T7c: failed payment on a CONFIRMED booking was NOT rejected';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
    END;
    RAISE NOTICE 'PASS T7: FAILED payment recorded, booking still HELD, CONFIRMED booking refused';

    -- T8: v_show_search  (3 seats: 2 confirmed + 1 live hold -> 0 available)
    SELECT * INTO v_rec FROM v_show_search WHERE show_id = v_show;
    IF v_rec.total_seats <> 3 OR v_rec.taken_seats <> 3 OR v_rec.available_seats <> 0
       OR v_rec.min_price <> 200 OR v_rec.max_price <> 300 OR v_rec.city_name <> 'Hyderabad' THEN
        RAISE EXCEPTION 'FAIL T8: v_show_search row = %', v_rec;
    END IF;
    RAISE NOTICE 'PASS T8: v_show_search (total 3, taken 3, price 200-300)';

    -- T9: v_ticket read path
    SELECT * INTO v_rec FROM v_ticket WHERE booking_id = v_b1;
    IF v_rec.seat_count <> 2 OR v_rec.seats <> 'A1, A2' OR v_rec.effective_status <> 'CONFIRMED'
       OR v_rec.movie_title <> 'Test Movie' OR jsonb_array_length(v_rec.seat_details) <> 2 THEN
        RAISE EXCEPTION 'FAIL T9: v_ticket row = %', v_rec;
    END IF;
    RAISE NOTICE 'PASS T9: v_ticket (seats "%", status %)', v_rec.seats, v_rec.effective_status;

    -- T10: v_show_occupancy  (2 sold, 1 held of 3 -> 66.7%)
    SELECT * INTO v_rec FROM v_show_occupancy WHERE show_id = v_show;
    IF v_rec.sold_seats <> 2 OR v_rec.held_seats <> 1 OR v_rec.occupancy_pct <> 66.7 OR v_rec.manager_id <> v_mgr THEN
        RAISE EXCEPTION 'FAIL T10: v_show_occupancy row = %', v_rec;
    END IF;
    RAISE NOTICE 'PASS T10: v_show_occupancy (sold 2, held 1, 66.7%%)';

    -- T11: v_revenue_venue_month  (one SUCCESS payment of 500; the FAILED one is ignored)
    SELECT SUM(net_revenue), SUM(paid_bookings) INTO v_num, v_n FROM v_revenue_venue_month WHERE venue_id = v_venue;
    IF v_num <> 500 OR v_n <> 1 THEN RAISE EXCEPTION 'FAIL T11: revenue % bookings %', v_num, v_n; END IF;
    RAISE NOTICE 'PASS T11: v_revenue_venue_month (net 500, FAILED payment ignored)';

    -- T12: v_top_movies_city
    SELECT * INTO v_rec FROM v_top_movies_city WHERE city_id = v_city;
    IF v_rec.rank_in_city <> 1 OR v_rec.tickets_sold <> 2 OR v_rec.revenue <> 500 THEN
        RAISE EXCEPTION 'FAIL T12: v_top_movies_city row = %', v_rec;
    END IF;
    RAISE NOTICE 'PASS T12: v_top_movies_city (rank 1, 2 tickets, 500)';

    -- T13: v_peak_hours
    SELECT COALESCE(SUM(confirmed_bookings),0) INTO v_n FROM v_peak_hours;
    IF v_n < 1 THEN RAISE EXCEPTION 'FAIL T13: v_peak_hours empty'; END IF;
    RAISE NOTICE 'PASS T13: v_peak_hours has data';
END $$;

ROLLBACK;
\echo 'ALL STEP 1 TESTS PASSED (nothing was saved)'
