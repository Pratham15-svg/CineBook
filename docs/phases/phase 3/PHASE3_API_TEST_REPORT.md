# CineBook Phase 3 — Backend API and Verification Report

**Prepared:** 6 November 2026  
**Scope:** Local backend verification performed during Phase 3.

## 1. Objective

Verify that backend APIs work with PostgreSQL, role restrictions are enforced, and booking confirmation changes can be rolled back safely. This report records tests performed; it does not claim frontend integration or performance benchmarking was completed.

## 2. Customer API verification

| Feature | Verification |
|---|---|
| Customer registration and login | Tested |
| Authenticated user profile (`/me`) | Implemented and tested |
| Show listing and show details | Tested |
| Create booking / hold seats | Tested |
| Confirm booking | Tested |
| Cancel booking | Tested |
| Record failed payment | Tested |
| Booking details and current-user bookings | Tested |

Booking operations call database procedures rather than duplicating booking rules in Node.js.

## 3. Manager API verification

| Endpoint | Result |
|---|---|
| `GET /api/manager/shows` | Successful; 36 shows returned for the tested manager's venue |
| `GET /api/manager/occupancy` | Successful |
| `GET /api/manager/revenue` | Successful |

The test data returned ₹96,783 for Cineplex Gachibowli (venue 1) at the time of testing. This value may change if the database is reseeded or modified.

## 4. Admin CRUD verification

Temporary records were created, retrieved, updated, and deleted.

| Resource | Operations | Cleanup |
|---|---|---|
| City | GET, POST, PUT, DELETE | TestCity (ID 6) deleted |
| Venue | GET, POST, PUT, DELETE | Test Venue (ID 11) deleted |
| Screen | GET, POST, PUT, DELETE | Test Screen (ID 26) deleted |
| Movie | GET, POST, PUT, DELETE | Test Movie (ID 21) deleted |

## 5. Admin dashboard verification

All four endpoints were tested successfully:

- `/api/admin/dashboard/revenue`
- `/api/admin/dashboard/occupancy`
- `/api/admin/dashboard/top-movies`
- `/api/admin/dashboard/peak-hours`

The implementation uses reporting views including `v_revenue_venue_month`, `v_show_occupancy`, `v_top_movies_city`, and `v_peak_hours`.

## 6. Role-based access tests

| Test | Token role | Request | Expected | Actual |
|---|---|---|---:|---:|
| RBAC-01 | Customer | `GET /api/admin/cities` | 403 | 403 |
| RBAC-02 | Manager | `GET /api/admin/cities` | 403 | 403 |
| RBAC-03 | Admin | `GET /api/bookings/me` | 403 | 403 |

All three negative role-access tests returned the expected HTTP 403 response.

## 7. Transaction rollback test

### Purpose
Verify that booking confirmation/payment changes are not partially committed when a transaction is rolled back.

### Test
Temporary booking 991 was HELD for show 35 with seats A5 and A6. The confirmation procedure was called inside a transaction, followed by rollback:

```sql
BEGIN;
CALL sp_confirm_booking(991, 'UPI', NULL);
ROLLBACK;
```

### Verification
After rollback:
- Booking 991 remained HELD.
- Total remained ₹440.
- Payment count was 0.
- Successful payment count was 0.

**Result: Passed.** The attempted confirmation/payment changes were not committed.

## 8. Temporary booking cleanup

Temporary bookings 989, 990, and 991 were used during booking and rollback tests. Their dependent booking-seat, payment, and audit rows were deleted during controlled cleanup. The deferred seat-count trigger was temporarily disabled for the deletion and re-enabled afterward.

Final verification showed zero matching rows in `booking`, `booking_seat`, `payment`, and `booking_audit`.

## 9. Test accounts used

| Role | Account | Password |
|---|---|---|
| Customer | `customer02@cinebook.test` | `CineBook@123` |
| Manager | `manager1@cinebook.test` | `Password@123` |
| Admin | `admin@cinebook.test` | `Password@123` |

These are local test credentials. Do not use them in production or include actual `.env` secrets in the shared package.

## 10. Overall results

| Verification area | Status |
|---|---|
| Customer authentication and APIs | Implemented and tested |
| Manager APIs | Implemented and tested |
| Admin CRUD APIs | Implemented and tested |
| Admin dashboard APIs | Implemented and tested |
| Negative role-access tests | 3 of 3 passed |
| Transaction rollback | Passed |
| Temporary test-record cleanup | Verified |
| Frontend integration | Not part of this Phase 3 work |
| `EXPLAIN ANALYZE` benchmarking | Not completed |

## 11. Conclusion

The Phase 3 backend APIs were implemented and locally tested for customer, manager, and admin workflows. The negative role tests returned the expected 403 responses. The rollback test confirmed that attempted booking confirmation/payment changes were not committed after rollback.

Frontend integration, performance benchmarking, and production deployment remain outside the completed Phase 3 verification recorded here.
