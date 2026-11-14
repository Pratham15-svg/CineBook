# CineBook Frontend

React app built with Vite. Uses React Router for navigation and Axios for API calls.

## Run

```bash
npm install
npm run dev
```
The dev server runs on http://localhost:5173 and proxies `/api` to the backend on port 5050 (see `vite.config.js`). In Docker the app is served by nginx on port 8080.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |

## Structure

```
src/
├── api/          API client
├── components/   shared components
├── pages/        one file per page
└── styles/       CSS files
```

## Pages

| Role | Routes |
|---|---|
| Public | `/`, `/login`, `/register`, `/shows`, `/shows/:id` |
| Customer | `/shows/:id/seats`, `/checkout/:bookingId`, `/my-bookings` |
| Manager | `/manager/dashboard`, `/manager/schedule` |
| Admin | `/admin/dashboard`, `/admin/cities`, `/admin/venues`, `/admin/screens`, `/admin/movies` |
