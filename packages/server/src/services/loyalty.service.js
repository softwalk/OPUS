import { createAuditEntry } from './audit.service.js';
import { fromCents } from '@opus/shared/utils/money';
import logger from '../logger.js';

/**
 * Default loyalty configuration used when a tenant has no custom config.
 * All monetary values are INTEGER centavos; thresholds are point totals.
 */
const DEFAULT_CONFIG = {
  puntos_por_peso: 1,            // 1 point per peso spent
  puntos_canjeables_min: 100,    // minimum 100 points to redeem
  valor_punto: 10,               // each point worth 10 centavos ($0.10)
  nivel_bronce_puntos: 0,
  nivel_plata_puntos: 500,
  nivel_oro_puntos: 2000,
  nivel_platino_puntos: 5000,
};

// ============================================================================
// 1. getConfig
// ============================================================================

/**
 * Retrieve the loyalty configuration for a tenant.
 * Falls back to DEFAULT_CONFIG if no custom row exists.
 *
 * @param {import('pg').PoolClient} client - Tenant-scoped DB client
 * @param {string} tenantId - UUID
 * @returns {Promise<object>}
 */
export async function getConfig(client, tenantId) {
  const { rows: [config] } = await client.query(
    `SELECT * FROM fidelizacion_config WHERE tenant_id = $1`,
    [tenantId]
  );

  if (!config) {
    logger.debug('No loyalty config found, returning defaults', { tenantId });
    return { ...DEFAULT_CONFIG, tenant_id: tenantId, is_default: true };
  }

  return config;
}

// ============================================================================
// 2. updateConfig
// ============================================================================

/**
 * Upsert the loyalty configuration for a tenant.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.tenantId
 * @param {number}  params.puntos_por_peso
 * @param {number}  params.puntos_canjeables_min
 * @param {number}  params.valor_punto           - centavos per point
 * @param {number}  params.nivel_bronce_puntos
 * @param {number}  params.nivel_plata_puntos
 * @param {number}  params.nivel_oro_puntos
 * @param {number}  params.nivel_platino_puntos
 * @returns {Promise<object>}
 */
export async function updateConfig(client, {
  tenantId,
  puntos_por_peso,
  puntos_canjeables_min,
  valor_punto,
  nivel_bronce_puntos,
  nivel_plata_puntos,
  nivel_oro_puntos,
  nivel_platino_puntos,
}) {
  const { rows: [config] } = await client.query(
    `INSERT INTO fidelizacion_config
       (tenant_id, puntos_por_peso, puntos_canjeables_min, valor_punto,
        nivel_bronce_puntos, nivel_plata_puntos, nivel_oro_puntos, nivel_platino_puntos)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (tenant_id) DO UPDATE SET
       puntos_por_peso       = EXCLUDED.puntos_por_peso,
       puntos_canjeables_min = EXCLUDED.puntos_canjeables_min,
       valor_punto           = EXCLUDED.valor_punto,
       nivel_bronce_puntos   = EXCLUDED.nivel_bronce_puntos,
       nivel_plata_puntos    = EXCLUDED.nivel_plata_puntos,
       nivel_oro_puntos      = EXCLUDED.nivel_oro_puntos,
       nivel_platino_puntos  = EXCLUDED.nivel_platino_puntos,
       updated_at            = NOW()
     RETURNING *`,
    [
      tenantId,
      puntos_por_peso,
      puntos_canjeables_min,
      valor_punto,
      nivel_bronce_puntos,
      nivel_plata_puntos,
      nivel_oro_puntos,
      nivel_platino_puntos,
    ]
  );

  logger.info('Loyalty config updated', { tenantId });

  return config;
}

// ============================================================================
// 3. acumular — accumulate points when billing
// ============================================================================

/**
 * Accumulate loyalty points for a client after a sale.
 * Points are calculated from the bill amount using the tenant config.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string} params.clienteId  - UUID of the cliente
 * @param {number} params.monto      - Total amount in centavos
 * @param {string} params.cuentaId   - UUID of the cuenta (reference)
 * @param {string} params.tenantId
 * @returns {Promise<{ puntos_ganados: number, puntos_total: number, nivel: string }>}
 */
export async function acumular(client, { clienteId, monto, cuentaId, tenantId }) {
  // 1. Get loyalty config
  const config = await getConfig(client, tenantId);

  // 2. Calculate points: floor(amount_in_pesos * puntos_por_peso)
  const puntos = Math.floor(fromCents(monto) * config.puntos_por_peso);

  if (puntos <= 0) {
    return { puntos_ganados: 0, puntos_total: 0, nivel: 'bronce' };
  }

  // 3. Record the point transaction
  await client.query(
    `INSERT INTO fidelizacion_puntos
       (tenant_id, cliente_id, tipo, puntos, descripcion, cuenta_id)
     VALUES ($1, $2, 'acumulado', $3, $4, $5)`,
    [tenantId, clienteId, puntos, `Venta cuenta ${cuentaId}`, cuentaId]
  );

  // 4. Update client's accumulated points
  await client.query(
    `UPDATE clientes
     SET puntos_acumulados = puntos_acumulados + $1,
         updated_at = NOW()
     WHERE id = $2`,
    [puntos, clienteId]
  );

  // 5. Recalculate tier
  const nivel = await recalcularNivel(client, clienteId, tenantId);

  // 6. Get updated total
  const { rows: [cliente] } = await client.query(
    `SELECT puntos_acumulados FROM clientes WHERE id = $1`,
    [clienteId]
  );

  logger.info('Puntos acumulados', {
    tenantId,
    clienteId,
    puntos,
    total: cliente.puntos_acumulados,
    nivel,
  });

  return {
    puntos_ganados: puntos,
    puntos_total: cliente.puntos_acumulados,
    nivel,
  };
}

// ============================================================================
// 4. canjear — redeem points
// ============================================================================

/**
 * Redeem loyalty points for a monetary value.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string} params.clienteId  - UUID of the cliente
 * @param {number} params.puntos     - Number of points to redeem
 * @param {string} params.tenantId
 * @returns {Promise<object>}
 */
export async function canjear(client, { clienteId, puntos, tenantId }) {
  // 1. Get config and validate minimum redemption
  const config = await getConfig(client, tenantId);

  if (puntos < config.puntos_canjeables_min) {
    return {
      error: true,
      status: 400,
      code: 'PUNTOS_MINIMOS',
      message: `Se requieren al menos ${config.puntos_canjeables_min} puntos para canjear (solicitados: ${puntos})`,
    };
  }

  // 2. Get client and verify sufficient points
  const { rows: [cliente] } = await client.query(
    `SELECT id, nombre, puntos_acumulados FROM clientes WHERE id = $1`,
    [clienteId]
  );

  if (!cliente) {
    return {
      error: true,
      status: 404,
      code: 'CLIENTE_NOT_FOUND',
      message: 'Cliente no encontrado',
    };
  }

  if (cliente.puntos_acumulados < puntos) {
    return {
      error: true,
      status: 400,
      code: 'PUNTOS_INSUFICIENTES',
      message: `Puntos insuficientes. Disponibles: ${cliente.puntos_acumulados}, solicitados: ${puntos}`,
    };
  }

  // 3. Calculate monetary value in centavos
  const valor_monetario = puntos * config.valor_punto;

  // 4. Record the redemption transaction (points as negative)
  await client.query(
    `INSERT INTO fidelizacion_puntos
       (tenant_id, cliente_id, tipo, puntos, descripcion)
     VALUES ($1, $2, 'canjeado', $3, $4)`,
    [tenantId, clienteId, -puntos, `Canje de ${puntos} puntos`]
  );

  // 5. Update client's accumulated points
  await client.query(
    `UPDATE clientes
     SET puntos_acumulados = puntos_acumulados - $1,
         updated_at = NOW()
     WHERE id = $2`,
    [puntos, clienteId]
  );

  // 6. Recalculate tier
  const nivel = await recalcularNivel(client, clienteId, tenantId);

  // 7. Get updated totals
  const { rows: [clienteActualizado] } = await client.query(
    `SELECT puntos_acumulados FROM clientes WHERE id = $1`,
    [clienteId]
  );

  logger.info('Puntos canjeados', {
    tenantId,
    clienteId,
    puntos,
    valor_monetario,
    restantes: clienteActualizado.puntos_acumulados,
    nivel,
  });

  return {
    puntos_canjeados: puntos,
    valor_monetario,
    puntos_restantes: clienteActualizado.puntos_acumulados,
    nivel,
  };
}

// ============================================================================
// 5. getHistorial — points history for a client
// ============================================================================

/**
 * Retrieve the point transaction history for a specific client.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.clienteId
 * @param {string}  [params.desde]    - Start date (YYYY-MM-DD)
 * @param {string}  [params.hasta]    - End date (YYYY-MM-DD)
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=50]
 * @returns {Promise<{ historial: object[], total: number, page: number, limit: number }>}
 */
export async function getHistorial(client, { clienteId, desde, hasta, page = 1, limit = 50 }) {
  const conditions = ['fp.cliente_id = $1'];
  const params = [clienteId];
  let paramIdx = 2;

  if (desde) {
    conditions.push(`fp.created_at >= $${paramIdx}::timestamptz`);
    params.push(desde);
    paramIdx++;
  }

  if (hasta) {
    conditions.push(`fp.created_at <= $${paramIdx}::timestamptz`);
    params.push(hasta);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');
  const offset = (page - 1) * limit;

  // Count total
  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total
     FROM fidelizacion_puntos fp
     WHERE ${whereClause}`,
    params
  );

  // Fetch page
  const { rows: historial } = await client.query(
    `SELECT fp.id, fp.tipo, fp.puntos, fp.descripcion, fp.cuenta_id, fp.created_at
     FROM fidelizacion_puntos fp
     WHERE ${whereClause}
     ORDER BY fp.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  return {
    historial,
    total: countRow.total,
    page,
    limit,
  };
}

// ============================================================================
// 6. getRanking — top clients by points
// ============================================================================

/**
 * Get the ranking of clients by accumulated loyalty points.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {number} [params.limit=20]
 * @returns {Promise<object[]>}
 */
export async function getRanking(client, { limit = 20 } = {}) {
  const { rows } = await client.query(
    `SELECT
       c.id,
       c.nombre,
       c.telefono,
       c.puntos_acumulados,
       c.nivel_fidelizacion,
       COUNT(fp.id)::integer AS total_transacciones,
       COALESCE(SUM(CASE WHEN fp.tipo = 'acumulado' THEN fp.puntos ELSE 0 END), 0)::integer AS puntos_ganados_total
     FROM clientes c
     LEFT JOIN fidelizacion_puntos fp ON fp.cliente_id = c.id
     GROUP BY c.id
     ORDER BY c.puntos_acumulados DESC
     LIMIT $1`,
    [limit]
  );

  return rows;
}

// ============================================================================
// 7. getClienteLoyalty — single client's loyalty status
// ============================================================================

/**
 * Retrieve a single client's loyalty status: current points, tier,
 * and a summary of point transactions.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} clienteId - UUID
 * @returns {Promise<object>}
 */
export async function getClienteLoyalty(client, clienteId) {
  // Client info
  const { rows: [cliente] } = await client.query(
    `SELECT id, nombre, telefono, email, puntos_acumulados, nivel_fidelizacion
     FROM clientes WHERE id = $1`,
    [clienteId]
  );

  if (!cliente) {
    return {
      error: true,
      status: 404,
      code: 'CLIENTE_NOT_FOUND',
      message: 'Cliente no encontrado',
    };
  }

  // Transaction summary
  const { rows: [resumen] } = await client.query(
    `SELECT
       COUNT(*)::integer AS total_transacciones,
       COALESCE(SUM(CASE WHEN tipo = 'acumulado' THEN puntos ELSE 0 END), 0)::integer AS total_acumulado,
       COALESCE(SUM(CASE WHEN tipo = 'canjeado' THEN ABS(puntos) ELSE 0 END), 0)::integer AS total_canjeado,
       MIN(created_at) AS primera_transaccion,
       MAX(created_at) AS ultima_transaccion
     FROM fidelizacion_puntos
     WHERE cliente_id = $1`,
    [clienteId]
  );

  // Last 5 transactions
  const { rows: ultimas } = await client.query(
    `SELECT id, tipo, puntos, descripcion, created_at
     FROM fidelizacion_puntos
     WHERE cliente_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [clienteId]
  );

  return {
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email,
    },
    puntos_acumulados: cliente.puntos_acumulados,
    nivel: cliente.nivel_fidelizacion,
    resumen,
    ultimas_transacciones: ultimas,
  };
}

// ============================================================================
// 8. recalcularNivel — private helper to recalculate tier
// ============================================================================

/**
 * Recalculate a client's loyalty tier based on their accumulated points
 * and the tenant's tier thresholds.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} clienteId
 * @param {string} tenantId
 * @returns {Promise<string>} The new tier name
 */
async function recalcularNivel(client, clienteId, tenantId) {
  // Get config for thresholds
  const config = await getConfig(client, tenantId);

  // Get client's current points
  const { rows: [cliente] } = await client.query(
    `SELECT puntos_acumulados FROM clientes WHERE id = $1`,
    [clienteId]
  );

  if (!cliente) {
    return 'bronce';
  }

  const puntos = cliente.puntos_acumulados;

  // Determine tier based on thresholds (highest matching tier wins)
  let nivel = 'bronce';
  if (puntos >= config.nivel_platino_puntos) {
    nivel = 'platino';
  } else if (puntos >= config.nivel_oro_puntos) {
    nivel = 'oro';
  } else if (puntos >= config.nivel_plata_puntos) {
    nivel = 'plata';
  }

  // Update client's tier
  await client.query(
    `UPDATE clientes
     SET nivel_fidelizacion = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [nivel, clienteId]
  );

  return nivel;
}
