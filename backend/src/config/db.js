const { Pool } = require('pg');

// Configurable for controlled before/after load tests (default: pg's 10).
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'cinebook',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: Number(process.env.DB_POOL_MAX || 10),
});
pool.on('error', err => console.error('Unexpected database pool error:', err.message));
module.exports = pool;
