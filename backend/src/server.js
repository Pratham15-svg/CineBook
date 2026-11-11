
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const showRoutes = require("./routes/showRoutes");
const managerRoutes = require("./routes/managerRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/shows", showRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api/admin", adminRoutes);

// Home route
app.get("/", (req, res) => {
    res.send("Welcome to CineBook Backend!");
});

// Server health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "CineBook Backend is running!"
    });
});

// Database connection test
app.get("/api/db-test", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT current_database() AS database, NOW() AS server_time"
        );

        res.json({
            success: true,
            message: "PostgreSQL connected successfully!",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Database test failed:", error.message);

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`CineBook server running on port ${PORT}`);
});

