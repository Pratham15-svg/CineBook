# CineBook: Phase 3 Handover — Backend

**Prepared:** 6 November 2026  
**Scope:** Node.js + Express backend, PostgreSQL integration, authentication, customer booking APIs, manager APIs, admin APIs, and local verification.

## 1. Phase 3 outcome

Phase 3 implemented the backend layer connecting CineBook to PostgreSQL. It exposes REST APIs, authenticates users with JWT, enforces role-based access, and delegates booking-critical operations to database procedures.

Frontend integration is outside this Phase 3 workstream and has not been completed in this handover.

## 2. Technology

- Node.js and Express
- PostgreSQL
- `pg` PostgreSQL client
- JWT authentication
- `bcrypt` password hashing
- Environment variables in `.env`

The tested backend ran on port **5000**.

## 3. Important backend files

| File | Responsibility |
|---|---|
| `src/controllers/managerController.js` | Manager shows, occupancy, revenue |
| `src/routes/managerRoutes.js` | Manager route definitions |
| `src/controllers/adminController.js` | Admin CRUD and dashboard logic |
| `src/routes/adminRoutes.js` | Admin route definitions |
| `server.js` | Express setup and route mounting |

Manager routes are mounted at `/api/manager`; admin routes at `/api/admin`.

## 4. Authentication and roles

Registration and login were implemented and tested. Passwords use bcrypt. Successful login returns a JWT. Authentication middleware validates the token, and role middleware restricts access to customer, manager, or admin routes.

Development test accounts used:
| Role | Login | Password |
|---|---|---|
| Customer | `customer02@cinebook.test` | `CineBook@123` |
| Manager | `manager1@cinebook.test` | `Password@123` |
| Admin | `admin@cinebook.test` | `Password@123` |

These are test credentials, not production credentials.

## 5. API inventory

### Customer shows and authentication
- Registration and login routes
- `GET /api/me`
- `GET /api/shows`
- `GET /api/shows/:id`

### Customer bookings

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/bookings` | Create booking / hold seats |
| POST | `/api/bookings/:bookingId/confirm` | Confirm booking |
| POST | `/api/bookings/:bookingId/cancel` | Cancel booking |
| POST | `/api/bookings/:bookingId/failed-payment` | Record failed payment |
| GET | `/api/bookings/:bookingId` | Get booking details |
| GET | `/api/bookings/me` | Get current user's bookings |

Booking operations call `sp_create_booking`, `sp_confirm_booking`, `sp_cancel_booking`, and `sp_record_failed_payment`. The backend does not reimplement the database's booking rules in JavaScript.

### Manager APIs
- `GET /api/manager/shows`
- `GET /api/manager/occupancy`
- `GET /api/manager/revenue`

All three were tested successfully. The tested manager received 36 shows for their venue. Revenue for Cineplex Gachibowli (venue 1) was ₹96,783 in the test data at the time of testing; this is not a permanent value.

### Admin APIs

CRUD (GET, POST, PUT, DELETE) was implemented for:
- `/api/admin/cities`
- `/api/admin/venues`
- `/api/admin/screens`
- `/api/admin/movies`

Dashboard endpoints:
- `/api/admin/dashboard/revenue`
- `/api/admin/dashboard/occupancy`
- `/api/admin/dashboard/top-movies`
- `/api/admin/dashboard/peak-hours`

Dashboard queries use Phase 2 views including `v_revenue_venue_month`, `v_show_occupancy`, `v_top_movies_city`, and `v_peak_hours`.

## 6. Booking and transaction flow

1. Customer requests seats.
2. Backend calls `sp_create_booking` to create a temporary hold.
3. Payment is attempted.
4. On success, backend calls `sp_confirm_booking`.
5. On failure, the confirmation transaction is rolled back, then `sp_record_failed_payment` is called in a separate transaction.
6. Cancellation calls `sp_cancel_booking`.

PostgreSQL remains the source of truth for seat availability, booking limits, price snapshots, payment validation, cancellation rules, and audit history.

### Rollback test

A test transaction called `sp_confirm_booking` for temporary booking 991 and then rolled back. The booking remained HELD, its total remained ₹440, and there were no payment or successful-payment rows. This verified that the attempted confirmation/payment changes were not committed.

Temporary bookings 989, 990, and 991 were subsequently cleaned up. Their booking, seat, payment, and audit rows were verified absent.

## 7. Verification performed

- Customer registration and login
- Show listing and show details
- Booking hold, confirmation, cancellation, failed-payment recording
- Booking details and current-user booking list
- Manager shows, occupancy, revenue
- Admin CRUD for cities, venues, screens, movies
- Admin revenue, occupancy, top-movies, peak-hours dashboards
- Role-based access restrictions
- Transaction rollback

Temporary CRUD records were removed after testing.

### Role tests

| Request | Expected | Result |
|---|---:|---:|
| Customer → `GET /api/admin/cities` | 403 | Passed |
| Manager → `GET /api/admin/cities` | 403 | Passed |
| Admin → `GET /api/bookings/me` | 403 | Passed |

### Not completed in Phase 3

- Frontend integration
- `EXPLAIN ANALYZE` performance benchmarking
- Production deployment and production security hardening

Do not describe these as completed.

## 8. Setup on another computer

Requirements: Node.js (LTS recommended), PostgreSQL, pgAdmin 4.

### Restore database
1. Install and start PostgreSQL.
2. Create a database named `cinebook`.
3. In pgAdmin, right-click the database and select **Restore**.
4. Select the supplied `cinebook_backup.dump`.
5. Use Custom format and start Restore.

The dump contains database objects and data, not the teammate's local PostgreSQL password.

### Configure backend
1. Open `CineBook/backend`.
2. Copy `.env.example` and name the copy `.env`.
3. Enter local PostgreSQL host, port, database, username, and password.
4. Set a private JWT secret and expiry value.
5. Save `.env`. Never share or commit the real `.env`.

Ensure `.env.example` variable names match those read by the backend configuration.

### Install and start
Run in a terminal opened inside `backend`:

```powershell
npm install
npm.cmd run dev
```

`npm.cmd run dev` was used in Windows PowerShell because the local execution policy blocked the `npm` script command. The tested backend port was 5000; confirm the actual `PORT` in `.env`.

## 9. Sharing checklist

Include backend source, `package.json`, `package-lock.json`, `.env.example`, `cinebook_backup.dump`, and the Phase 3 documentation. Exclude `node_modules` because it can be recreated with `npm install`. Do not share the actual `.env`, passwords, or JWT secrets.

## 10. Handover to the next phase

The next workstream should connect the frontend to these APIs, configure its API base URL, and test complete customer, manager, and admin workflows.
