
const { Pool } = require("pg");

// Create a connection pool
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// Check database connection
pool.on("connect", () => {
    console.log("Connected to CineBook PostgreSQL database!");
});

// Handle unexpected database errors
pool.on("error", (err) => {
    console.error("Unexpected database error:", err.message);
});

module.exports = pool;
