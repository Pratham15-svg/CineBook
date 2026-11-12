const express = require("express");
const router = express.Router();

const {
    getVenueShows,
    getVenueOccupancy,
    getVenueRevenue,
    getScheduleOptions,
    createShow
} = require("../controllers/managerController");

const {
    authenticate,
    authorize
} = require("../middleware/authMiddleware");

// All manager routes require manager authentication
router.use(authenticate, authorize("MANAGER"));

// View shows at manager's venue
router.get("/shows", getVenueShows);

// View venue occupancy
router.get("/occupancy", getVenueOccupancy);

// View venue revenue
router.get("/revenue", getVenueRevenue);

// Options (own screens + movies) for the schedule-a-show form
router.get("/schedule-options", getScheduleOptions);

// Schedule a new show with per-category prices (one transaction)
router.post("/shows", createShow);

module.exports = router;