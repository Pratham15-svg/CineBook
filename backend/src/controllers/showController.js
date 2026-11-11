
const pool = require("../config/db");

// Get all shows with optional filters
const getShows = async (req, res) => {
    try {
        const {
            search,
            city,
            language,
            genre,
            date,
            minPrice,
            maxPrice
        } = (req.method === "POST" ? req.body : req.query);

        let query = `
            SELECT *
            FROM v_show_search
            WHERE start_time > NOW()
        `;

        const values = [];
        let index = 1;

        if (search) {
            query += ` AND title ILIKE $${index}`;
            values.push(`%${search}%`);
            index++;
        }

        if (city) {
            query += ` AND city_name ILIKE $${index}`;
            values.push(`%${city}%`);
            index++;
        }

        if (language) {
            query += ` AND language ILIKE $${index}`;
            values.push(language);
            index++;
        }

        if (genre) {
            query += ` AND genre ILIKE $${index}`;
            values.push(`%${genre}%`);
            index++;
        }

        if (date) {
            query += ` AND start_time::date = $${index}::date`;
            values.push(date);
            index++;
        }

        if (minPrice) {
            query += ` AND max_price >= $${index}`;
            values.push(Number(minPrice));
            index++;
        }

        if (maxPrice) {
            query += ` AND min_price <= $${index}`;
            values.push(Number(maxPrice));
            index++;
        }

        query += ` ORDER BY start_time ASC`;

        const result = await pool.query(query, values);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            shows: result.rows
        });

    } catch (error) {
        console.error("Show search error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve shows"
        });
    }
};


// Get show details using show ID
const getShowById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM v_show_search WHERE show_id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Show not found"
            });
        }

        res.status(200).json({
            success: true,
            show: result.rows[0]
        });

    } catch (error) {
        console.error("Show details error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve show details"
        });
    }
};


// Get seat-by-seat availability for a show

const getShowSeats = async (req, res) => {
    try {
        const { id } = req.params;
        const showId = Number(id);

        if (!Number.isInteger(showId) || showId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid show ID"
            });
        }

        // Verify that the show exists and retrieve its screen
        const showResult = await pool.query(
            `SELECT show_id, screen_id
             FROM MOVIE_SHOW
             WHERE show_id = $1`,
            [showId]
        );

        if (showResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Show not found"
            });
        }

        const screenId = showResult.rows[0].screen_id;

        // Use the existing PostgreSQL seat-map function
        const seatsResult = await pool.query(
            `SELECT seat_no, category, price, seat_status AS status
             FROM fn_seat_map($1)`,
            [showId]
        );

        const seats = seatsResult.rows;

        res.status(200).json({
            success: true,
            show_id: showId,
            screen_id: screenId,
            total_seats: seats.length,
            available_seats: seats.filter(
                seat => seat.status === "AVAILABLE"
            ).length,
            held_seats: seats.filter(
                seat => seat.status === "HELD"
            ).length,
            booked_seats: seats.filter(
                seat => seat.status === "BOOKED"
            ).length,
            seats
        });

    } catch (error) {
        console.error("Show seat map error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve show seat map"
        });
    }
};


module.exports = {
    getShows,
    getShowById,
    getShowSeats
};
