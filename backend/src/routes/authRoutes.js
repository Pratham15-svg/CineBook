
const express = require("express");

const router = express.Router();

const {
    register,
    login
} = require("../controllers/authController");

const {
    authenticate,
    authorize
} = require("../middleware/authMiddleware");

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected route - any logged-in user
router.get("/me", authenticate, (req, res) => {
    res.status(200).json({
        success: true,
        message: "Authenticated successfully",
        user: req.user
    });
});

// Customer-only test route
router.get(
    "/customer-test",
    authenticate,
    authorize("CUSTOMER"),
    (req, res) => {
        res.json({
            success: true,
            message: "Customer access granted"
        });
    }
);

// Manager-only test route
router.get(
    "/manager-test",
    authenticate,
    authorize("MANAGER"),
    (req, res) => {
        res.json({
            success: true,
            message: "Manager access granted"
        });
    }
);

// Admin-only test route
router.get(
    "/admin-test",
    authenticate,
    authorize("ADMIN"),
    (req, res) => {
        res.json({
            success: true,
            message: "Admin access granted"
        });
    }
);

module.exports = router;


