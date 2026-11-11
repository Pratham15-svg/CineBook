
const express = require("express");
const router = express.Router();

const {
    createBooking,
    confirmBooking,
    cancelBooking,
    recordFailedPayment,
    getBookingById,
    getMyBookings
} = require("../controllers/bookingController");

const {
    authenticate,
    authorize
} = require("../middleware/authMiddleware");

// All booking routes require customer authentication
router.use(authenticate, authorize("CUSTOMER"));

// Customer booking history
router.get("/me", getMyBookings);

// Create booking
router.post("/", createBooking);

// Get a specific booking
router.get("/:bookingId", getBookingById);

// Confirm payment
router.post("/:bookingId/confirm", confirmBooking);

// Cancel booking
router.post("/:bookingId/cancel", cancelBooking);

// Record failed payment
router.post("/:bookingId/failed-payment", recordFailedPayment);

module.exports = router;
