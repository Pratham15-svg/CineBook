# Phase 4: Frontend (React)

**Owner:** Harinandha L, with Imran Hafeez S · **Needs:** Phase 3 (backend API)

## What this phase is about
A working UI for the three user types, so the system can be used from the browser instead of only through API calls. The frontend only talks to the backend; all booking rules stay in the database.

## Technology
React 19 with Vite, React Router, Axios, plain CSS. In Docker the built app is served by nginx, which also proxies `/api` to the backend.

## Files (`frontend/`)
| Path | Contents |
|---|---|
| `src/App.jsx` | Routes and the navigation bar (links change with the logged-in role) |
| `src/api/api.js` | Axios client; adds the JWT from `localStorage` to every request |
| `src/pages/` | One file per page (see below) |
| `src/components/CinemaBackdrop.jsx` | Shared background component |
| `src/styles/` | CSS files |
| `vite.config.js` | Dev server; proxies `/api` to port 5050 |
| `Dockerfile`, `nginx.conf` | Production build and serving |

## Pages
| Role | Page | Route |
|---|---|---|
| Public | Home, login, register | `/`, `/login`, `/register` |
| Public | Show list with filters, show details | `/shows`, `/shows/:id` |
| Customer | Seat map with optional coupon code | `/shows/:id/seats` |
| Customer | Checkout and payment | `/checkout/:bookingId` |
| Customer | Booking history with cancel | `/my-bookings` |
| Manager | Occupancy and revenue for the venue | `/manager/dashboard` |
| Manager | Schedule a show with per-category prices | `/manager/schedule` |
| Admin | Dashboards (revenue, occupancy, top movies, peak hours) | `/admin/dashboard` |
| Admin | Manage cities, venues, screens, movies | `/admin/cities`, `/admin/venues`, `/admin/screens`, `/admin/movies` |

## How to check it works
```bash
docker compose up --build -d
docker compose run --rm seed
```
Open http://localhost:8080 and log in with a demo account (see the main README). A customer should be able to search a show, pick seats, pay, see the booking under My Bookings and cancel it.

For frontend development only: `cd frontend && npm install && npm run dev`, with the backend running on port 5050.

## Notes
- The navigation bar shows links by role, but access is enforced by the backend. A customer calling an admin API gets 403 regardless of the UI.
- After payment, "View My Bookings" links to `/my-bookings`.
