/**
 * Database helper utilities — DRY extractors for repeated patterns.
 *
 * @module helpers/db
 */

// ============================================================================
// withTransaction — Wraps a function in BEGIN/COMMIT/ROLLBACK
// ============================================================================

/**
 * Execute a function inside a PostgreSQL transaction on an existing client.
 * Handles BEGIN, COMMIT, and ROLLBACK automatically.
 *
 * Unlike `tenantTransaction` (which acquires its own client), this works
 * with the `req.tenantClient` already attached by the tenant middleware.
 *
 * @param {import('pg').PoolClient} client - An existing PG client
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn - The transactional work
 * @returns {Promise<T>}
 * @template T
 *
 * @example
 *   const result = await withTransaction(req.tenantClient, async (client) => {
 *     await client.query('INSERT INTO ...', [...]);
 *     await client.query('UPDATE ...', [...]);
 *     return { ok: true };
 *   });
 */
export async function withTransaction(client, fn) {
  await client.query('BEGIN');
  try {
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

// ============================================================================
// paginatedQuery — The count + fetch pagination pattern
// ============================================================================

/**
 * Execute a paginated query — runs a COUNT(*) query and a data query,
 * returns a standard paginated response object.
 *
 * @param {import('pg').PoolClient} client - PG client
 * @param {object} options
 * @param {string} options.baseTable - The FROM clause (can include JOINs)
 * @param {string} options.selectColumns - The SELECT columns for data query
 * @param {string[]} [options.conditions=[]] - WHERE conditions (e.g. ["activo = $1"])
 * @param {any[]} [options.params=[]] - Params for the conditions
 * @param {string} [options.orderBy='created_at DESC'] - ORDER BY clause
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.groupBy] - Optional GROUP BY clause
 * @returns {Promise<{ data: any[], total: number, page: number, limit: number, pages: number }>}
 *
 * @example
 *   const result = await paginatedQuery(client, {
 *     baseTable: 'productos p',
 *     selectColumns: 'p.id, p.descripcion, p.precio_venta',
 *     conditions: ['p.activo = $1'],
 *     params: [true],
 *     orderBy: 'p.descripcion ASC',
 *     page: 2,
 *     limit: 25,
 *   });
 *   // => { data: [...], total: 148, page: 2, limit: 25, pages: 6 }
 */
export async function paginatedQuery(client, {
  baseTable,
  selectColumns,
  conditions = [],
  params = [],
  orderBy = 'created_at DESC',
  page = 1,
  limit = 20,
  groupBy,
}) {
  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const groupByClause = groupBy ? `GROUP BY ${groupBy}` : '';

  // For grouped queries, count distinct groups
  const countSql = groupBy
    ? `SELECT COUNT(*)::integer AS total FROM (SELECT 1 FROM ${baseTable} ${whereClause} ${groupByClause}) AS _count`
    : `SELECT COUNT(*)::integer AS total FROM ${baseTable} ${whereClause}`;

  const { rows: [{ total }] } = await client.query(countSql, params);

  const offset = (page - 1) * limit;
  const nextIdx = params.length + 1;

  const dataSql = `SELECT ${selectColumns} FROM ${baseTable} ${whereClause} ${groupByClause} ORDER BY ${orderBy} LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`;
  const { rows: data } = await client.query(dataSql, [...params, limit, offset]);

  return {
    data,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

// ============================================================================
// buildDynamicUpdate — Builds a SET clause from allowed fields
// ============================================================================

/**
 * Build dynamic SET clause for UPDATE queries from a data object
 * and a list of allowed field names.
 *
 * @param {object} data - The input data (e.g. req.body)
 * @param {string[]} allowedFields - Field names that may be updated
 * @param {number} [startIdx=1] - Starting parameter index ($1, $2, ...)
 * @returns {{ setClauses: string[], params: any[], nextIdx: number } | null}
 *   Returns null if no fields matched (callers should return a 400 error).
 *
 * @example
 *   const upd = buildDynamicUpdate(req.body, ['nombre', 'telefono', 'email'], 2);
 *   if (!upd) return { error: true, status: 400, code: 'NO_FIELDS', message: 'Nada que actualizar' };
 *   await client.query(
 *     `UPDATE clientes SET ${upd.setClauses.join(', ')} WHERE id = $1`,
 *     [clienteId, ...upd.params]
 *   );
 */
export function buildDynamicUpdate(data, allowedFields, startIdx = 1) {
  const setClauses = [];
  const params = [];
  let idx = startIdx;

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      setClauses.push(`${field} = $${idx++}`);
      params.push(data[field]);
    }
  }

  if (setClauses.length === 0) return null;

  return { setClauses, params, nextIdx: idx };
}

// ============================================================================
// findOneOr404 — Fetch a single row or return a service error
// ============================================================================

/**
 * Fetch a single row from a table by ID, returning a standard service error if not found.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} table - Table name
 * @param {string} id - Row ID (UUID)
 * @param {object} [options]
 * @param {string} [options.columns='*'] - Columns to select
 * @param {string} [options.entityName] - Human-readable entity name for error message
 * @param {string} [options.errorCode] - Error code (default: TABLE_NOT_FOUND)
 * @returns {Promise<{ row: object } | { error: true, status: number, code: string, message: string }>}
 */
export async function findOneOr404(client, table, id, options = {}) {
  const {
    columns = '*',
    entityName = table,
    errorCode = `${table.toUpperCase()}_NOT_FOUND`,
  } = options;

  const { rows: [row] } = await client.query(
    `SELECT ${columns} FROM ${table} WHERE id = $1`,
    [id]
  );

  if (!row) {
    return {
      error: true,
      status: 404,
      code: errorCode,
      message: `${entityName} no encontrado`,
    };
  }

  return { row };
}
