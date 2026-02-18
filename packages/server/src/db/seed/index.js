import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, testConnection } from '../pool.js';
import logger from '../../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function seed() {
  logger.info('Starting seed process...');

  const connected = await testConnection();
  if (!connected) {
    logger.error('Cannot connect to database. Aborting seed.');
    process.exit(1);
  }

  // Check if tenants already exist (skip seeding if so)
  const existing = await query('SELECT COUNT(*) as count FROM tenants');
  if (parseInt(existing.rows[0].count, 10) > 0) {
    logger.info('Tenants already exist. Skipping seed. Use "npm run db:reset" to start fresh.');
    process.exit(0);
  }

  // Read and execute seed SQL
  const seedPath = join(__dirname, 'seed.sql');
  const sql = await readFile(seedPath, 'utf-8');

  try {
    await query('BEGIN');
    await query(sql);
    await query('COMMIT');
    logger.info('Seed data inserted successfully');
  } catch (err) {
    await query('ROLLBACK');
    logger.error('Seed failed', { error: err.message, detail: err.detail || '' });
    process.exit(1);
  }

  process.exit(0);
}

seed();
