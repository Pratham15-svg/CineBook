# CineBook Phase 3 — Viva Preparation

These questions cover the backend implementation completed in Phase 3.

## Part A — Backend architecture

**Q1. What was the objective of Phase 3?**  
A: Implement the Node.js and Express backend, connect it to PostgreSQL, expose APIs for customers/managers/admins, authenticate users with JWT, and enforce role-based access.

**Q2. Why do we need a backend?**  
A: The frontend should not connect directly to the database. The backend validates requests, authenticates users, checks permissions, performs database operations, and returns responses.

**Q3. What is Express?**  
A: Express is a web framework for Node.js used to define routes, middleware, and HTTP request handlers.

**Q4. Difference between route and controller?**  
A: A route maps an HTTP method and URL to a handler. A controller contains the code that performs the operation and prepares the response.

## Part B — Authentication and security

**Q5. What is authentication?**  
A: Verifying the identity of a user.

**Q6. What is authorization?**  
A: Checking what an authenticated user is allowed to access.

**Q7. What is JWT?**  
A: JSON Web Token is a signed token issued after successful authentication. The client sends it with protected requests, and middleware verifies it.

**Q8. What is bcrypt used for?**  
A: Hashing passwords so the application does not store plain-text passwords.

**Q9. What is middleware?**  
A: Code that runs during the request-response cycle. Authentication middleware verifies the token; role middleware checks permissions.

**Q10. Difference between 401 and 403?**  
A: 401 means missing or invalid authentication. 403 means authenticated but not authorized.

**Q11. How did you test role access?**  
A: Customer and manager requests to `GET /api/admin/cities` returned 403. An admin request to `GET /api/bookings/me` also returned 403.

## Part C — Database integration and booking

**Q12. How does Node connect to PostgreSQL?**  
A: The backend uses the `pg` client. Connection details are read from environment variables rather than hardcoded.

**Q13. Why call stored procedures instead of rewriting booking logic in JavaScript?**  
A: The database already enforces booking rules using procedures, triggers, and constraints. Calling the procedures avoids duplicating critical rules and keeps the database as the final authority.

**Q14. Which procedures are called?**  
A: `sp_create_booking`, `sp_confirm_booking`, `sp_cancel_booking`, and `sp_record_failed_payment`.

**Q15. Explain the booking flow.**  
A: The backend creates a temporary seat hold, payment is attempted, then the booking is confirmed on success. On failure, the confirmation transaction is rolled back and the failed payment is recorded separately.

**Q16. What is a transaction?**  
A: A group of database operations treated as one unit. It commits together or rolls back together.

**Q17. Why record failed payment in a separate transaction?**  
A: The confirmation attempt may be rolled back. If the failure record were in that same transaction, it would be rolled back too.

**Q18. What did the rollback test prove?**  
A: We called `sp_confirm_booking` for a temporary held booking inside a transaction and rolled it back. The booking remained HELD and no payment was committed.

**Q19. What happens if two users choose the same seat?**  
A: The database's active-seat uniqueness rule prevents two active bookings for the same show and seat. The API should return a conflict response.

## Part D — APIs

**Q20. What does `GET /api/shows` do?**  
A: Retrieves shows using the database show-search data and supported filters.

**Q21. What does `POST /api/bookings` do?**  
A: Creates a booking hold by calling the database procedure.

**Q22. What does `GET /api/bookings/me` do?**  
A: Retrieves bookings for the authenticated user identified by the token.

**Q23. What can a manager access?**  
A: Shows, occupancy, and revenue for the manager's venue scope.

**Q24. What can an admin do?**  
A: CRUD for cities, venues, screens, and movies, plus dashboard retrieval for revenue, occupancy, top movies, and peak hours.

**Q25. What does CRUD mean?**  
A: Create, Read, Update, Delete.

**Q26. Which views support dashboards?**  
A: `v_revenue_venue_month`, `v_show_occupancy`, `v_top_movies_city`, and `v_peak_hours`.

## Part E — Testing

**Q27. What was tested?**  
A: Customer authentication and booking flows, show retrieval, manager reporting, admin CRUD, admin dashboards, role restrictions, and transaction rollback.

**Q28. Why use temporary records for CRUD tests?**  
A: To verify create/read/update/delete without leaving test records in the shared database. The temporary city, venue, screen, and movie records were deleted afterward.

**Q29. What does 403 prove in the role tests?**  
A: The authorization layer rejected a request from a role that was not permitted to access that endpoint.

**Q30. Did you perform performance testing?**  
A: `EXPLAIN ANALYZE` benchmarking was not completed in this phase.

**Q31. Was frontend integration completed?**  
A: No. It belongs to the frontend workstream and was not part of this Phase 3 backend handover.

## Part F — Setup

**Q32. Why share package.json and package-lock.json?**  
A: `package.json` lists dependencies, and `package-lock.json` records the resolved dependency tree and versions.

**Q33. Why exclude node_modules?**  
A: It can be recreated by running `npm install` in the backend folder. Excluding it reduces the package size.

**Q34. Why not share the actual .env?**  
A: It contains database credentials and the JWT secret. Each teammate creates their own `.env` from `.env.example`.

**Q35. How do you start the backend on Windows?**  
A: Run `npm install`, then `npm.cmd run dev` from the backend folder.

## Quick endpoint revision

| Area | Endpoint examples |
|---|---|
| Shows | `GET /api/shows`, `GET /api/shows/:id` |
| Bookings | `POST /api/bookings`, `GET /api/bookings/me` |
| Booking actions | `/api/bookings/:bookingId/confirm`, `/cancel`, `/failed-payment` |
| Manager | `/api/manager/shows`, `/occupancy`, `/revenue` |
| Admin CRUD | `/api/admin/cities`, `/venues`, `/screens`, `/movies` |
| Admin dashboards | `/api/admin/dashboard/revenue`, `/occupancy`, `/top-movies`, `/peak-hours` |

## Limitations to state honestly

Frontend integration, `EXPLAIN ANALYZE` performance benchmarking, and production deployment were not completed in this Phase 3 work.
