/**
 * Tenant configuration helpers.
 *
 * @module helpers/tenant
 */

/**
 * Retrieve the IVA percentage for a tenant from their config JSONB.
 * Returns a number (e.g. 16 for 16%).
 * Falls back to 16 if the config key is missing.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} tenantId
 * @returns {Promise<number>}
 */
export async function getTenantIva(client, tenantId) {
  const { rows: [row] } = await client.query(
    `SELECT config->>'iva_porcentaje' AS iva FROM tenants WHERE id = $1`,
    [tenantId]
  );
  if (!row || row.iva == null) return 16;
  return parseFloat(row.iva);
}

/**
 * Retrieve the default almacen (warehouse) for a tenant.
 * Returns the first active almacen ordered by numero.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} tenantId
 * @returns {Promise<string|null>} almacen ID, or null if none found
 */
export async function getDefaultAlmacen(client, tenantId) {
  const { rows: [almacen] } = await client.query(
    `SELECT id FROM almacenes WHERE tenant_id = $1 ORDER BY numero LIMIT 1`,
    [tenantId]
  );
  return almacen?.id || null;
}
