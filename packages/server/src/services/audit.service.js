import logger from '../logger.js';

/**
 * Create an audit trail entry in the auditoria table.
 *
 * Uses the provided database client (which should already have tenant
 * context set if needed for RLS), so this can participate in the same
 * transaction as the operation being audited.
 *
 * @param {import('pg').PoolClient | { query: Function }} client - Database client (from pool or transaction)
 * @param {object} params
 * @param {string}  params.tenantId     - UUID of the tenant (required)
 * @param {string}  params.tipo         - Audit event type, e.g. 'login', 'venta', 'ajuste_stock' (required)
 * @param {string}  [params.entidad]    - Entity type, e.g. 'cuenta', 'producto', 'usuario'
 * @param {string}  [params.entidadId]  - Entity ID (UUID or readable ID)
 * @param {string}  [params.descripcion] - Human-readable description of the action
 * @param {object}  [params.datos]      - Additional data (stored as JSONB)
 * @param {string}  [params.usuario]    - Username / codigo of the actor
 * @param {string}  [params.usuarioId]  - UUID of the acting user
 * @param {string}  [params.ip]         - IP address of the request
 * @returns {Promise<object>} The created audit row
 */
export async function createAuditEntry(client, {
  tenantId,
  tipo,
  entidad = null,
  entidadId = null,
  descripcion = null,
  datos = null,
  usuario = null,
  usuarioId = null,
  ip = null,
}) {
  try {
    const result = await client.query(
      `INSERT INTO auditoria (tenant_id, tipo, entidad, entidad_id, descripcion, datos_json, usuario, usuario_id, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        tipo,
        entidad,
        entidadId,
        descripcion,
        datos ? JSON.stringify(datos) : null,
        usuario,
        usuarioId,
        ip,
      ]
    );

    logger.debug('Audit entry created', {
      tenantId,
      tipo,
      entidad,
      entidadId,
    });

    return result.rows[0];
  } catch (err) {
    // Audit failures should not break the main operation,
    // so we log and swallow the error.
    logger.error('Failed to create audit entry', {
      tenantId,
      tipo,
      entidad,
      entidadId,
      error: err.message,
    });
    return null;
  }
}
