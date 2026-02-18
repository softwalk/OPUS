import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, testConnection } from './pool.js';
import logger from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations() {
  const result = await query('SELECT name FROM _migrations ORDER BY id');
  return new Set(result.rows.map(r => r.name));
}

async function migrate() {
  const connected = await testConnection();
  if (!connected) {
    logger.error('Cannot connect to database. Aborting migration.');
    process.exit(1);
  }

  // Handle --reset flag
  if (process.argv.includes('--reset')) {
    logger.warn('Resetting database...');
    // Drop all tables in public schema
    await query(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    logger.info('All tables dropped');
  }

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  // Read migration files
  const files = await readdir(MIGRATIONS_DIR);
  const sqlFiles = files
    .filter(f => f.endsWith('.sql'))
    .sort(); // Alphabetical sort ensures correct order (001, 002, etc.)

  let appliedCount = 0;

  for (const file of sqlFiles) {
    if (applied.has(file)) {
      logger.debug(`Migration already applied: ${file}`);
      continue;
    }

    const filePath = join(MIGRATIONS_DIR, file);
    const sql = await readFile(filePath, 'utf-8');

    try {
      await query('BEGIN');
      await query(sql);
      await query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await query('COMMIT');
      logger.info(`Migration applied: ${file}`);
      appliedCount++;
    } catch (err) {
      await query('ROLLBACK');
      logger.error(`Migration failed: ${file}`, { error: err.message });
      process.exit(1);
    }
  }

  if (appliedCount === 0) {
    logger.info('No new migrations to apply');
  } else {
    logger.info(`Applied ${appliedCount} migration(s)`);
  }

  process.exit(0);
}

migrate();
