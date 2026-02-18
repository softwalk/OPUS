import pool from './pool.js';
import logger from '../logger.js';

/**
 * Get a database client with tenant context set via RLS.
 * MUST be released after use with client.release().
 *
 * Usage:
 *   const client = await getTenantClient(tenantId);
 *   try {
 *     const result = await client.query('SELECT * FROM productos');
 *     // RLS automatically filters by tenant_id
 *     return result.rows;
 *   } finally {
 *     client.release();
 *   }
 *
 * @param {string} tenantId - UUID of the tenant
 * @returns {Promise<import('pg').PoolClient>}
 */
export async function getTenantClient(tenantId) {
  const client = await pool.connect();
  try {
    // SECURITY: Use session-level set_config (3rd param = false) for non-transactional queries.
    // For transactional queries, tenantTransaction() wraps in BEGIN/COMMIT where
    // the context persists for the session lifetime of this client.
    // IMPORTANT: When the client is released back to the pool, we MUST reset the
    // tenant context to prevent cross-tenant data leakage.
    await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantId]);
    logger.debug('Tenant context set', { tenantId });

    // Wrap release to clear tenant context before returning to pool
    const originalRelease = client.release.bind(client);
    let released = false;
    client.release = async () => {
      if (released) return;
      released = true;
      try {
        // Reset tenant context to prevent leakage to next user of this connection
        await client.query(`SELECT set_config('app.current_tenant', '', false)`);
      } catch {
        // If reset fails, still release the client
      }
      return originalRelease();
    };

    return client;
  } catch (err) {
    client.release();
    throw err;
  }
}

/**
 * Execute a query within a tenant context.
 * Automatically acquires and releases the connection.
 *
 * @param {string} tenantId - UUID of the tenant
 * @param {string} text - SQL query
 * @param {any[]} [params] - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function tenantQuery(tenantId, text, params) {
  const client = await getTenantClient(tenantId);
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries within a tenant transaction.
 * Rolls back on error.
 *
 * @param {string} tenantId - UUID of the tenant
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn - Transaction function
 * @returns {Promise<T>}
 * @template T
 */
export async function tenantTransaction(tenantId, fn) {
  const client = await getTenantClient(tenantId);
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', { tenantId, error: err.message });
    throw err;
  } finally {
    client.release();
  }
}
