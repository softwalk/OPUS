import pg from 'pg';
import { config } from '../config.js';
import logger from '../logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', { error: err.message });
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

/**
 * Execute a query with the pool (no tenant context)
 * Use for platform-level operations (tenants, users tables)
 */
export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('Query executed', { text: text.substring(0, 80), duration, rows: result.rowCount });
  return result;
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient() {
  return pool.connect();
}

/**
 * Verify database connection
 */
export async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as now, current_database() as db');
    logger.info('Database connected', {
      database: result.rows[0].db,
      time: result.rows[0].now,
    });
    return true;
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    return false;
  }
}

export { pool };
export default pool;
