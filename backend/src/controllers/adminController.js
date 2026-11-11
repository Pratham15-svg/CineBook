const pool = require("../config/db");

// ===============================
// CITY MANAGEMENT
// ===============================

// Get all cities
const getCities = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM city ORDER BY city_id`
        );

        res.json({ success: true, cities: result.rows });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "Unable to retrieve cities" });
    }
};

// Add a city
const createCity = async (req, res) => {
    try {
        const { name, state } = req.body;

        if (!name || !state) {
            return res.status(400).json({
                success: false,
                message: "City name and state are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO city (name, state)
             VALUES ($1, $2)
             RETURNING *`,
            [name, state]
        );

        res.status(201).json({
            success: true,
            city: result.rows[0]
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "Unable to create city" });
    }
};

// Update a city
const updateCity = async (req, res) => {
    try {
        const { cityId } = req.params;
        const { name, state } = req.body;

        const result = await pool.query(
            `UPDATE city
             SET name = COALESCE($1, name),
                 state = COALESCE($2, state)
             WHERE city_id = $3
             RETURNING *`,
            [name || null, state || null, cityId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "City not found" });
        }

        res.json({ success: true, city: result.rows[0] });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "Unable to update city" });
    }
};

// Delete a city
const deleteCity = async (req, res) => {
    try {
        const { cityId } = req.params;

        const result = await pool.query(
            `DELETE FROM city WHERE city_id = $1 RETURNING *`,
            [cityId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "City not found" });
        }

        res.json({ success: true, message: "City deleted successfully" });
    } catch (error) {
        console.error(error.message);
        res.status(400).json({
            success: false,
            message: "Unable to delete city. It may be linked to existing venues."
        });
    }
};

// ===============================
// VENUE MANAGEMENT
// ===============================

const getVenues = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT v.*, c.name AS city_name
             FROM venue v
             JOIN city c ON c.city_id = v.city_id
             ORDER BY v.venue_id`
        );

        res.json({ success: true, venues: result.rows });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "Unable to retrieve venues" });
    }
};

const createVenue = async (req, res) => {
    try {
        const { name, address, cityId, managerId } = req.body;

        if (!name || !address || !cityId || !managerId) {
            return res.status(400).json({
                success: false,
                message: "Name, address, city ID and manager ID are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO venue (name, address, city_id, manager_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, address, cityId, managerId]
        );

        res.status(201).json({ success: true, venue: result.rows[0] });
    } catch (error) {
        console.error(error.message);
        res.status(400).json({ success: false, message: "Unable to create venue" });
    }
};

const updateVenue = async (req, res) => {
    try {
        const { venueId } = req.params;
        const { name, address, cityId, managerId } = req.body;

        const result = await pool.query(
            `UPDATE venue
             SET name = COALESCE($1, name),
                 address = COALESCE($2, address),
                 city_id = COALESCE($3, city_id),
                 manager_id = COALESCE($4, manager_id)
             WHERE venue_id = $5
             RETURNING *`,
            [name || null, address || null, cityId || null, managerId || null, venueId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Venue not found" });
        }

        res.json({ success: true, venue: result.rows[0] });
    } catch (error) {
        console.error(error.message);
        res.status(400).json({ success: false, message: "Unable to update venue" });
    }
};

const deleteVenue = async (req, res) => {
    try {
        const { venueId } = req.params;

        const result = await pool.query(
            `DELETE FROM venue WHERE venue_id = $1 RETURNING *`,
            [venueId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Venue not found" });
        }

        res.json({ success: true, message: "Venue deleted successfully" });
    } catch (error) {
        console.error(error.message);
        res.status(400).json({
            success: false,
            message: "Unable to delete venue. It may contain screens or shows."
        });
    }
};

// ===============================
// SCREEN MANAGEMENT
// ===============================

const getScreens = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT sc.*, v.name AS venue_name
             FROM screen sc
             JOIN venue v ON v.venue_id = sc.venue_id
             ORDER BY sc.screen_id`
        );

        res.json({ success: true, screens: result.rows });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "Unable to retrieve screens" });
    }
};

const createScreen = async (req, res) => {
    try {
        const { venueId, screenName } = req.body;

        if (!venueId || !screenName) {
            return res.status(400).json({
                success: false,
                message: "Venue ID and screen name are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO screen (venue_id, screen_name)
             VALUES ($1, $2)
             RETURNING *`,
            [venueId, screenName]
        );

        res.status(201).json({ success: true, screen: result.rows[0] });
    } catch (error) {
        console.error(error.message);
        res.status(400).json({ success: false, message: "Unable to create screen" });
    }
};

const updateScreen = async (req, res) => {
    try {
        const { screenId } = req.params;
        const { venueId, screenName } = req.body;

        const result = await pool.query(
            `UPDATE screen
             SET venue_id = COALESCE($1, venue_id),
                 screen_name = COALESCE($2, screen_name)
             WHERE screen_id = $3
             RETURNING *`,
            [venueId || null, screenName || null, screenId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Screen not found" });
        }

        res.json({ success: true, screen: result.rows[0] });
    } catch (error) {
        console.error(error.message);
        res.status(400).json({ success: false, message: "Unable to update screen" });
    }
};

const deleteScreen = async (req, res) => {
    try {
        const { screenId } = req.params;

        const result = await pool.query(
            `DELETE FROM screen WHERE screen_id = $1 RETURNING *`,
            [screenId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Screen not found" });
        }

        res.json({ success: true, message: "Screen deleted successfully" });
    } catch (error) {
        console.error(error.message);
        res.status(400).json({
            success: false,
            message: "Unable to delete screen. It may contain scheduled shows."
        });
    }
};

// ===============================
// MOVIE MANAGEMENT
// ===============================

const getMovies = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM movie ORDER BY movie_id`
        );

        res.json({ success: true, movies: result.rows });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "Unable to retrieve movies" });
    }
};

const createMovie = async (req, res) => {
    try {
        const { title, durationMin, language, genre, releaseDate } = req.body;

        if (!title || !durationMin || !language || !genre || !releaseDate) {
            return res.status(400).json({
                success: false,
                message: "All movie details are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO movie
                (title, duration_min, language, genre, release_date)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [title, durationMin, language, genre, releaseDate]
        );

        res.status(201).json({ success: true, movie: result.rows[0] });
    } catch (error) {
        console.error(error.message);
        res.status(400).json({ success: false, message: "Unable to create movie" });
    }
};

const updateMovie = async (req, res) => {
    try {
        const { movieId } = req.params;
        const { title, durationMin, language, genre, releaseDate } = req.body;

        const result = await pool.query(
            `UPDATE movie
             SET title = COALESCE($1, title),
                 duration_min = COALESCE($2, duration_min),
                 language = COALESCE($3, language),
                 genre = COALESCE($4, genre),
                 release_date = COALESCE($5, release_date)
             WHERE movie_id = $6
             RETURNING *`,
            [title || null, durationMin || null, language || null,
             genre || null, releaseDate || null, movieId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Movie not found" });
        }

        res.json({ success: true, movie: result.rows[0] });
    } catch (error) {
        console.error(error.message);
        res.status(400).json({ success: false, message: "Unable to update movie" });
    }
};

const deleteMovie = async (req, res) => {
    try {
        const { movieId } = req.params;

        const result = await pool.query(
            `DELETE FROM movie WHERE movie_id = $1 RETURNING *`,
            [movieId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Movie not found" });
        }

        res.json({ success: true, message: "Movie deleted successfully" });
    } catch (error) {
        console.error(error.message);
        res.status(400).json({
            success: false,
            message: "Unable to delete movie. It may be linked to scheduled shows."
        });
    }
};

// ===============================
// ADMIN DASHBOARD
// ===============================

// Revenue per venue per month
const getRevenueDashboard = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM v_revenue_venue_month
             ORDER BY month DESC, net_revenue DESC`
        );

        res.json({ success: true, revenue: result.rows });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "Unable to retrieve revenue dashboard" });
    }
};

// Occupancy per show
const getOccupancyDashboard = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM v_show_occupancy
             ORDER BY start_time DESC`
        );

        res.json({ success: true, occupancy: result.rows });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "Unable to retrieve occupancy dashboard" });
    }
};

// Top 3 movies per city
const getTopMoviesDashboard = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM v_top_movies_city
             WHERE rank_in_city <= 3
             ORDER BY city_name, rank_in_city`
        );

        res.json({ success: true, topMovies: result.rows });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "Unable to retrieve top movies dashboard" });
    }
};

// Peak booking hours
const getPeakHoursDashboard = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM v_peak_hours
             ORDER BY hour_of_day`
        );

        res.json({ success: true, peakHours: result.rows });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "Unable to retrieve peak hours dashboard" });
    }
};

module.exports = {
    getCities, createCity, updateCity, deleteCity,
    getVenues, createVenue, updateVenue, deleteVenue,
    getScreens, createScreen, updateScreen, deleteScreen,
    getMovies, createMovie, updateMovie, deleteMovie,
    getRevenueDashboard,
    getOccupancyDashboard,
    getTopMoviesDashboard,
    getPeakHoursDashboard
};