
const express = require("express");

const router = express.Router();

const {
    getShows,
    getShowById,
    getShowSeats
} = require("../controllers/showController");

// Get all shows
router.get("/", getShows);

// Search shows
router.post("/search", getShows);

// Get seat map for a particular show
router.get("/:id/seats", getShowSeats);

// Get show details
router.get("/:id", getShowById);

module.exports = router;
