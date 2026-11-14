# Phase 3: Backend (Node.js + Express)

**Owner:** Imran Hafeez S, with Pratham Singla for database-heavy endpoints · **Needs:** Phases 1 and 2

## What this phase is about
The REST API between the frontend and PostgreSQL. It handles registration and login, role-based access, and the customer, manager and admin operations. Booking rules are not rewritten in JavaScript: the backend calls the stored procedures from Phase 1 and 2, so PostgreSQL stays the single source of truth for seat availability, limits, price snapshots, payments and refunds.

## Technology
Node.js, Express, `pg` (no ORM, parameterised SQL), JWT, `bcrypt`, `dotenv`.

## Files (`backend/src/`)
| File | Responsibility |
|---|---|
| `server.js` | Express setup, route mounting, health check |
| `config/db.js` | PostgreSQL connection pool |
| `middleware/authMiddleware.js` | JWT check (`authenticate`) and role check (`authorize`) |
| `controllers/authController.js`, `routes/authRoutes.js` | Register, login, current user |
| `controllers/showController.js`, `routes/showRoutes.js` | Show search, show details, seat map |
| `controllers/bookingController.js`, `routes/bookingRoutes.js` | Hold, confirm, cancel, failed payment, booking reads |
| `controllers/managerController.js`, `routes/managerRoutes.js` | Manager shows, occupancy, revenue, scheduling |
| `controllers/adminController.js`, `routes/adminRoutes.js` | Admin CRUD and dashboards |

## Authentication and roles
Passwords are hashed with bcrypt. Login returns a JWT, which the client sends as `Authorization: Bearer <token>`. `authenticate` validates the token and `authorize` restricts a route to a role. A missing or invalid token gives 401, and a valid token with the wrong role gives 403.

## API
Base path `/api`.

**Auth and shows**
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Register, log in |
| GET | `/auth/me` | Current user |
| GET / POST | `/shows`, `/shows/search` | Search shows (city, movie, language, date, price) |
| GET | `/shows/:id` | Show details |
| GET | `/shows/:id/seats` | Seat map: every seat with category, price and status (`AVAILABLE`, `HELD`, `BOOKED`) plus counts. Uses `fn_seat_map(show_id)` |

**Customer bookings** (role `CUSTOMER`)
| Method | Endpoint | Procedure / view |
|---|---|---|
| POST | `/bookings` | `sp_create_booking` (hold seats, optional coupon) |
| POST | `/bookings/:bookingId/confirm` | `sp_confirm_booking` |
| POST | `/bookings/:bookingId/cancel` | `sp_cancel_booking` |
| POST | `/bookings/:bookingId/failed-payment` | `sp_record_failed_payment` |
| GET | `/bookings/:bookingId`, `/bookings/me` | `v_ticket` (reads only `BOOKING` and `BOOKING_SEAT`) |

**Manager** (role `MANAGER`)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/manager/shows`, `/manager/occupancy`, `/manager/revenue` | Shows, occupancy and revenue for the manager's venue |
| GET | `/manager/schedule-options` | Screens and movies the manager can schedule |
| POST | `/manager/shows` | Schedule a show with per-category prices |

**Admin** (role `ADMIN`)
| Endpoints | Purpose |
|---|---|
| `/admin/cities`, `/venues`, `/screens`, `/movies` | GET, POST, PUT, DELETE |
| `/admin/dashboard/revenue`, `/occupancy`, `/top-movies`, `/peak-hours` | Read the views `v_revenue_venue_month`, `v_show_occupancy`, `v_top_movies_city`, `v_peak_hours` |

## Booking and payment flow
1. The customer picks seats and the backend calls `sp_create_booking`, which holds them for 10 minutes.
2. Payment is simulated.
3. On success the backend calls `sp_confirm_booking`.
4. On failure the confirmation transaction is rolled back, then `sp_record_failed_payment` runs in a separate transaction. A separate transaction is needed, otherwise the failed-payment row would be rolled back too.
5. Cancelling calls `sp_cancel_booking`, which applies the cut-off and refund rules.

## What was tested
- Customer registration, login, show search, hold, confirm, cancel, failed payment and booking reads.
- Manager shows, occupancy and revenue.
- Admin create, read, update and delete for cities, venues, screens and movies, and all four dashboards.
- Role checks: a customer or manager calling `GET /api/admin/cities`, and an admin calling `GET /api/bookings/me`, all return 403.
- Rollback: calling `sp_confirm_booking` inside a transaction and rolling back leaves the booking `HELD` with no payment row.
- Seat map: returns every seat of the screen, a held seat shows as `HELD`, and a seat shows as `AVAILABLE` again once its hold is released.

The full API checks are automated in `backend/tests/integration_test.mjs` (see Phase 5).

## How to check it works
```bash
docker compose up --build -d
docker compose run --rm seed
curl http://localhost:5050/api/health
curl http://localhost:5050/api/shows
```

## Notes
- Copy `backend/.env.example` to `.env` for a non-Docker run. Never commit the real `.env`.
- On Windows PowerShell, if `npm run dev` is blocked by the execution policy, use `npm.cmd run dev`.
