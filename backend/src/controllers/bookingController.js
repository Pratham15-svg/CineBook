
const pool = require("../config/db");

// Helper: Check whether booking belongs to logged-in customer
const verifyBookingOwnership = async (bookingId, userId) => {
    const result = await pool.query(
        `SELECT booking_id
         FROM booking
         WHERE booking_id = $1 AND user_id = $2`,
        [bookingId, userId]
    );

    return result.rows.length > 0;
};


// 1. Create a new booking
const createBooking = async (req, res) => {
    try {
        const { showId, seatNumbers, couponCode } = req.body;
        const userId = req.user.userId;

        if (!showId || !Array.isArray(seatNumbers) ||
            seatNumbers.length === 0 || seatNumbers.length > 6) {
            return res.status(400).json({
                success: false,
                message: "Provide a valid show ID and 1 to 6 seat numbers"
            });
        }

        if (seatNumbers.some(seat =>
            typeof seat !== "string" || !seat.trim()
        )) {
            return res.status(400).json({
                success: false,
                message: "Invalid seat numbers"
            });
        }

        if (new Set(seatNumbers).size !== seatNumbers.length) {
            return res.status(400).json({
                success: false,
                message: "Duplicate seat numbers are not allowed"
            });
        }

        const result = await pool.query(
            `CALL sp_create_booking($1, $2, $3, $4, NULL)`,
            [userId, showId, seatNumbers, couponCode || null]
        );

        res.status(201).json({
            success: true,
            message: "Booking created successfully. Seats are held for 10 minutes.",
            bookingId: result.rows[0].p_booking_id
        });

    } catch (error) {
        console.error("Create booking error:", error.message);

        res.status(error.code === "P0001" ? 400 : 500).json({
            success: false,
            message: error.code === "P0001"
                ? error.message
                : "Unable to create booking"
        });
    }
};


// 2. Confirm booking and record payment
const confirmBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { method } = req.body;
        const userId = req.user.userId;

        if (!method || typeof method !== "string" ||
            !["UPI", "CARD", "NETBANKING", "WALLET"].includes(
                method.toUpperCase()
            )) {
            return res.status(400).json({
                success: false,
                message: "Provide a valid payment method"
            });
        }

        const ownsBooking = await verifyBookingOwnership(
            bookingId, userId
        );

        if (!ownsBooking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        const result = await pool.query(
            `CALL sp_confirm_booking($1, $2, NULL)`,
            [bookingId, method.toUpperCase()]
        );

        res.status(200).json({
            success: true,
            message: "Booking confirmed successfully",
            paymentId: result.rows[0].p_payment_id
        });

    } catch (error) {
        console.error("Confirm booking error:", error.message);

        res.status(error.code === "P0001" ? 400 : 500).json({
            success: false,
            message: error.code === "P0001"
                ? error.message
                : "Unable to confirm booking"
        });
    }
};


// 3. Cancel booking and calculate refund
const cancelBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.user.userId;

        const ownsBooking = await verifyBookingOwnership(
            bookingId, userId
        );

        if (!ownsBooking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        const result = await pool.query(
            `CALL sp_cancel_booking($1, NULL)`,
            [bookingId]
        );

        res.status(200).json({
            success: true,
            message: "Booking cancelled successfully",
            refundAmount: result.rows[0].p_refund_amount
        });

    } catch (error) {
        console.error("Cancel booking error:", error.message);

        res.status(error.code === "P0001" ? 400 : 500).json({
            success: false,
            message: error.code === "P0001"
                ? error.message
                : "Unable to cancel booking"
        });
    }
};


// 4. Record failed payment
const recordFailedPayment = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { method } = req.body;
        const userId = req.user.userId;

        if (!method || typeof method !== "string" ||
            !["UPI", "CARD", "NETBANKING", "WALLET"].includes(
                method.toUpperCase()
            )) {
            return res.status(400).json({
                success: false,
                message: "Provide a valid payment method"
            });
        }

        const ownsBooking = await verifyBookingOwnership(
            bookingId, userId
        );

        if (!ownsBooking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        const result = await pool.query(
            `CALL sp_record_failed_payment($1, $2, NULL)`,
            [bookingId, method.toUpperCase()]
        );

        res.status(201).json({
            success: true,
            message: "Failed payment recorded",
            paymentId: result.rows[0].p_payment_id
        });

    } catch (error) {
        console.error("Failed payment error:", error.message);

        res.status(error.code === "P0001" ? 400 : 500).json({
            success: false,
            message: error.code === "P0001"
                ? error.message
                : "Unable to record failed payment"
        });
    }
};


// 5. Get a specific booking by ID
const getBookingById = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT
                b.*,
                COALESCE(
                    (
                        SELECT json_agg(to_jsonb(bs))
                        FROM booking_seat bs
                        WHERE bs.booking_id = b.booking_id
                    ),
                    '[]'::json
                ) AS seats
             FROM booking b
             WHERE b.booking_id = $1
               AND b.user_id = $2`,
            [bookingId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        res.status(200).json({
            success: true,
            booking: result.rows[0]
        });

    } catch (error) {
        console.error("Get booking error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve booking"
        });
    }
};


// 6. Get all bookings of logged-in customer
const getMyBookings = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT
                b.*,
                COALESCE(
                    (
                        SELECT json_agg(to_jsonb(bs))
                        FROM booking_seat bs
                        WHERE bs.booking_id = b.booking_id
                    ),
                    '[]'::json
                ) AS seats
             FROM booking b
             WHERE b.user_id = $1
             ORDER BY b.booked_at DESC`,
            [userId]
        );

        res.status(200).json({
            success: true,
            count: result.rows.length,
            bookings: result.rows
        });

    } catch (error) {
        console.error("Get my bookings error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve bookings"
        });
    }
};


// Export all controller functions
module.exports = {
    createBooking,
    confirmBooking,
    cancelBooking,
    recordFailedPayment,
    getBookingById,
    getMyBookings
};
