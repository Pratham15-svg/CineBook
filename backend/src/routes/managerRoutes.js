const express = require("express");
const router = express.Router();

const {
    getVenueShows,
    getVenueOccupancy,
    getVenueRevenue
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

module.exports = router;