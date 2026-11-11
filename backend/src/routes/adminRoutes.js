const express = require("express");
const router = express.Router();

const {
    getCities, createCity, updateCity, deleteCity,
    getVenues, createVenue, updateVenue, deleteVenue,
    getScreens, createScreen, updateScreen, deleteScreen,
    getMovies, createMovie, updateMovie, deleteMovie,
    getRevenueDashboard,
    getOccupancyDashboard,
    getTopMoviesDashboard,
    getPeakHoursDashboard
} = require("../controllers/adminController");

const {
    authenticate,
    authorize
} = require("../middleware/authMiddleware");

// All admin routes require ADMIN authentication
router.use(authenticate, authorize("ADMIN"));

// CITY ROUTES
router.get("/cities", getCities);
router.post("/cities", createCity);
router.put("/cities/:cityId", updateCity);
router.delete("/cities/:cityId", deleteCity);

// VENUE ROUTES
router.get("/venues", getVenues);
router.post("/venues", createVenue);
router.put("/venues/:venueId", updateVenue);
router.delete("/venues/:venueId", deleteVenue);

// SCREEN ROUTES
router.get("/screens", getScreens);
router.post("/screens", createScreen);
router.put("/screens/:screenId", updateScreen);
router.delete("/screens/:screenId", deleteScreen);

// MOVIE ROUTES
router.get("/movies", getMovies);
router.post("/movies", createMovie);
router.put("/movies/:movieId", updateMovie);
router.delete("/movies/:movieId", deleteMovie);

// DASHBOARD ROUTES
router.get("/dashboard/revenue", getRevenueDashboard);
router.get("/dashboard/occupancy", getOccupancyDashboard);
router.get("/dashboard/top-movies", getTopMoviesDashboard);
router.get("/dashboard/peak-hours", getPeakHoursDashboard);

module.exports = router;