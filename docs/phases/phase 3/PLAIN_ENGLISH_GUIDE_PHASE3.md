# CineBook Phase 3 — Backend in Plain English

This guide explains the backend work in beginner-friendly language.

## 1. The big picture

The database stores CineBook information. The frontend is what users interact with. The backend sits between them.

```text
Frontend  →  Express API  →  PostgreSQL
                 ↓
       Authentication and roles
                 ↓
              Response
```

The frontend sends an HTTP request. The backend checks it, verifies the user, performs the database operation, and sends a response.

## 2. What Express does

Express is a Node.js framework used to create HTTP endpoints. Examples:
- `GET /api/shows` asks for shows.
- `POST /api/bookings` asks to hold selected seats.
- `GET /api/manager/revenue` asks for manager revenue data.

The frontend communicates with the backend, not directly with PostgreSQL.

## 3. Routes and controllers

A route is the URL and HTTP method. A controller is the code that handles the request. Separating them keeps the project organized.

## 4. Authentication: who are you?

1. A user registers or logs in.
2. The backend checks the credentials.
3. Passwords are handled using bcrypt rather than stored as plain text.
4. On successful login, the backend issues a JWT.
5. The client sends the token with later protected requests.
6. Authentication middleware validates the token and identifies the user.

A JWT is a signed token used to recognize an authenticated user on later requests.

## 5. Authorization: what can you do?

Authorization checks the user's role. CineBook has customer, manager, and admin roles. Role middleware blocks users from endpoints their role is not allowed to access.

Authentication asks, "Who are you?" Authorization asks, "Are you allowed to do this?"

## 6. Why call database procedures for booking?

Booking is sensitive: two users may try to select the same seat, a hold may expire, payment may fail, or cancellation may require a refund.

The database already contains procedures and constraints for these rules. The backend calls them instead of duplicating the rules in JavaScript.

| Procedure | Job |
|---|---|
| `sp_create_booking` | Temporarily holds selected seats |
| `sp_confirm_booking` | Confirms a booking after payment |
| `sp_cancel_booking` | Cancels a booking under database rules |
| `sp_record_failed_payment` | Records a failed payment attempt |

## 7. What is a transaction?

A transaction groups database changes into one unit. Related changes should succeed together. If an error occurs, the backend can roll back the transaction so partial changes are not saved.

### Payment failure flow

1. Try to confirm the booking.
2. If confirmation fails, roll back that transaction.
3. In a new transaction, record the failed payment.

The separate transaction is important: otherwise the failed-payment record would also disappear when the confirmation transaction is rolled back.

## 8. Customer booking endpoints

| Endpoint | Meaning |
|---|---|
| `POST /api/bookings` | Start a booking and hold seats |
| `POST /api/bookings/:bookingId/confirm` | Confirm a booking |
| `POST /api/bookings/:bookingId/cancel` | Cancel a booking |
| `POST /api/bookings/:bookingId/failed-payment` | Record payment failure |
| `GET /api/bookings/:bookingId` | View one booking |
| `GET /api/bookings/me` | View the logged-in customer's bookings |

The `:bookingId` part is replaced by the actual booking ID.

## 8A. How the seat-picker gets its seat map

The frontend needs more than a count of available seats. It needs the exact seat numbers and whether each seat can be selected. CineBook now provides:

`GET /api/shows/:id/seats`

For example: `GET http://localhost:5000/api/shows/212/seats`

The response contains a list of seats. Each seat includes:
- `seat_no`: the seat label, such as `A1`
- `category`: the seat category
- `price`: the price for that category for this show
- `status`: `AVAILABLE`, `HELD`, or `BOOKED`

The response also includes total, available, held, and booked seat counts.

The backend uses the existing PostgreSQL function `fn_seat_map(show_id)`. This function checks active seat reservations and booking status. A live hold is `HELD`; a confirmed booking is `BOOKED`; an expired hold is treated as available. The seat-map endpoint only reads availability. To actually hold seats, the frontend must still call `POST /api/bookings`.

## 9. Manager and admin features

Managers can retrieve shows, occupancy, and revenue for their venue scope.

Admins can perform CRUD operations for cities, venues, screens, and movies. CRUD means Create, Read, Update, and Delete. Admin dashboard endpoints retrieve revenue, occupancy, top movies, and peak hours.

## 10. What is a database view?

A view is a saved SQL query that can be read like a table. Phase 3 dashboard endpoints use Phase 2 views such as `v_revenue_venue_month`, `v_show_occupancy`, `v_top_movies_city`, and `v_peak_hours`.

## 11. HTTP 401 versus 403

- 401: authentication is missing or invalid.
- 403: the user is authenticated but does not have permission.

The Phase 3 negative role tests returned 403 as expected.

## 12. Why not share node_modules?

`node_modules` contains downloaded JavaScript packages. It can be recreated from:
- `package.json` — dependency information
- `package-lock.json` — resolved dependency tree and versions

A teammate runs `npm install` in the backend folder to download packages and recreate `node_modules`.

## 13. Running the backend on a teammate's computer

1. Install Node.js and PostgreSQL.
2. Restore `cinebook_backup.dump` into a database named `cinebook`.
3. Copy `.env.example` to `.env`.
4. Enter local PostgreSQL credentials and a private JWT secret.
5. Run `npm install` inside `backend`.
6. Run `npm.cmd run dev` in Windows PowerShell.

Do not share the actual `.env`, because it contains credentials and secrets.

## 14. Completed and remaining work

Completed and tested: authentication, customer show and booking APIs, manager APIs, admin CRUD and dashboards, role restrictions, and rollback test.

Not completed as part of this Phase 3 work: frontend integration, `EXPLAIN ANALYZE` performance benchmarking, and production deployment. Preserve this distinction in reports and presentations.
