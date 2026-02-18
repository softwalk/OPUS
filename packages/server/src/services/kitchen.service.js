import { createAuditEntry } from './audit.service.js';
import { COCINA_ESTADOS, KDS_DEFAULTS } from '@opus/shared/constants';
import logger from '../logger.js';

// ============================================================================
// HELPERS (internal)
// ============================================================================

/**
 * Retrieve KDS urgency thresholds from the tenant's config JSONB.
 * Returns { alerta: number, critico: number } in minutes.
 */
async function getTenantKdsConfig(client, tenantId) {
  const { rows: [row] } = await client.query(
    `SELECT config->>'kds_alerta_min' AS alerta, config->>'kds_critico_min' AS critico
     FROM tenants WHERE id = $1`,
    [tenantId]
  );

  return {
    alerta: row?.alerta != null ? parseFloat(row.alerta) : KDS_DEFAULTS.ALERTA_MINUTOS,
    critico: row?.critico != null ? parseFloat(row.critico) : KDS_DEFAULTS.CRITICO_MINUTOS,
  };
}

/**
 * Valid state transitions for cocina_queue items.
 * Key = current estado, value = allowed next estado.
 */
const VALID_TRANSITIONS = {
  [COCINA_ESTADOS.PENDIENTE]: COCINA_ESTADOS.EN_PREPARACION,
  [COCINA_ESTADOS.EN_PREPARACION]: COCINA_ESTADOS.LISTO,
  [COCINA_ESTADOS.LISTO]: COCINA_ESTADOS.ENTREGADO,
};

// ============================================================================
// 1. getQueue
// ============================================================================

/**
 * Get the KDS queue with real-time urgency calculation.
 *
 * Urgency levels are derived from tenant config:
 *   - normal:     < alerta minutes
 *   - alerta:     >= alerta AND < critico minutes
 *   - critico:    >= critico minutes
 *   - completado: estado is 'listo' or 'entregado'
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  [params.area]     - Filter by area_produccion
 * @param {string}  [params.estado]   - Filter by estado
 * @param {string}  params.tenantId   - UUID
 * @returns {Promise<object[]>}
 */
export async function getQueue(client, { area, estado, tenantId }) {
  const { alerta, critico } = await getTenantKdsConfig(client, tenantId);

  const conditions = [`cq.estado NOT IN ('entregado')`];
  const params = [critico, alerta];
  let paramIdx = 3;

  if (area) {
    conditions.push(`cq.area = $${paramIdx++}`);
    params.push(area);
  }

  if (estado) {
    // Override the default exclusion of 'entregado' when explicitly filtering
    conditions.length = 0;
    conditions.push(`cq.estado = $${paramIdx++}`);
    params.push(estado);
    // Re-add urgency params at positions $1 and $2
    if (area) {
      conditions.push(`cq.area = $${paramIdx - 2}`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await client.query(
    `SELECT cq.*,
       EXTRACT(EPOCH FROM (NOW() - cq.created_at)) / 60 AS minutos_transcurridos,
       CASE
         WHEN cq.estado IN ('listo', 'entregado') THEN 'completado'
         WHEN EXTRACT(EPOCH FROM (NOW() - cq.created_at)) / 60 > $1 THEN 'critico'
         WHEN EXTRACT(EPOCH FROM (NOW() - cq.created_at)) / 60 > $2 THEN 'alerta'
         ELSE 'normal'
       END AS urgencia
     FROM cocina_queue cq
     ${whereClause}
     ORDER BY
       cq.prioridad DESC,
       CASE
         WHEN cq.estado IN ('listo', 'entregado') THEN 3
         WHEN EXTRACT(EPOCH FROM (NOW() - cq.created_at)) / 60 > $1 THEN 0
         WHEN EXTRACT(EPOCH FROM (NOW() - cq.created_at)) / 60 > $2 THEN 1
         ELSE 2
       END ASC,
       cq.created_at ASC`,
    params
  );

  logger.debug('KDS queue fetched', {
    tenantId,
    area,
    estado,
    count: rows.length,
  });

  return rows;
}

// ============================================================================
// 2. createQueueItem
// ============================================================================

/**
 * Insert a new item into the cocina_queue (KDS queue).
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.cuentaId     - UUID of the cuenta
 * @param {number}  params.mesaNumero   - Mesa number for display
 * @param {Array}   params.items        - JSON array of items to prepare
 * @param {string}  [params.meseroNombre] - Waiter name for display
 * @param {number}  [params.prioridad]  - Priority level (higher = more urgent)
 * @param {string}  [params.area]       - Production area (cocina, bar, etc.)
 * @param {string}  params.tenantId     - UUID
 * @returns {Promise<object>} The created queue item
 */
export async function createQueueItem(client, {
  cuentaId,
  mesaNumero,
  items,
  meseroNombre = null,
  prioridad = 0,
  area = null,
  tenantId,
}) {
  const { rows: [result] } = await client.query(
    `INSERT INTO cocina_queue
       (tenant_id, cuenta_id, mesa_numero, items_json, mesero_nombre, prioridad, area, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente')
     RETURNING *`,
    [tenantId, cuentaId, mesaNumero, JSON.stringify(items), meseroNombre, prioridad, area]
  );

  logger.info('KDS queue item created', {
    tenantId,
    queueId: result.id,
    mesaNumero,
    area,
    itemCount: items.length,
  });

  return result;
}

// ============================================================================
// 3. updateEstado
// ============================================================================

/**
 * Transition the state of a KDS queue item.
 *
 * Valid transitions:
 *   pendiente -> en_preparacion -> listo -> entregado
 *
 * Timestamps are set automatically:
 *   - en_preparacion: inicio_preparacion
 *   - listo:          listo_en  (+ waiter notification)
 *   - entregado:      entregado_en
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.queueId    - UUID of the queue item
 * @param {string}  params.estado     - New estado
 * @param {string}  params.tenantId   - UUID
 * @param {string}  [params.usuario]  - Username
 * @param {string}  [params.usuarioId] - UUID of acting user
 * @param {string}  [params.ip]       - IP address
 * @returns {Promise<object | {error: true, ...}>}
 */
export async function updateEstado(client, {
  queueId,
  estado,
  tenantId,
  usuario = null,
  usuarioId = null,
  ip = null,
}) {
  // --- 1. Fetch current item --------------------------------------------------
  const { rows: [item] } = await client.query(
    `SELECT id, estado, mesa_numero, cuenta_id, items_json FROM cocina_queue WHERE id = $1`,
    [queueId]
  );

  if (!item) {
    return { error: true, status: 404, code: 'QUEUE_ITEM_NOT_FOUND', message: 'Item de cocina no encontrado' };
  }

  // --- 2. Validate transition -------------------------------------------------
  const allowedNext = VALID_TRANSITIONS[item.estado];

  if (!allowedNext || allowedNext !== estado) {
    return {
      error: true,
      status: 400,
      code: 'INVALID_TRANSITION',
      message: `Transicion invalida: ${item.estado} -> ${estado}. Transicion permitida: ${item.estado} -> ${allowedNext || 'ninguna'}`,
    };
  }

  // --- 3. Build timestamp SET clause ------------------------------------------
  let timestampClause = '';
  if (estado === 'en_preparacion') {
    timestampClause = ', inicio_preparacion = NOW()';
  } else if (estado === 'listo') {
    timestampClause = ', listo_en = NOW()';
  } else if (estado === 'entregado') {
    timestampClause = ', entregado_en = NOW()';
  }

  // --- 4. Perform update ------------------------------------------------------
  const { rows: [updated] } = await client.query(
    `UPDATE cocina_queue
     SET estado = $1 ${timestampClause}
     WHERE id = $2
     RETURNING *`,
    [estado, queueId]
  );

  // --- 5. Notify waiter when order is ready -----------------------------------
  if (estado === 'listo') {
    await client.query(
      `INSERT INTO notificaciones (tenant_id, destinatario_tipo, titulo, mensaje, tipo)
       VALUES ($1, 'mesero', $2, $3, 'info')`,
      [
        tenantId,
        `Orden lista — Mesa ${item.mesa_numero}`,
        `La orden de mesa ${item.mesa_numero} esta lista para servir`,
      ]
    );
  }

  // --- 6. Audit entry ---------------------------------------------------------
  await createAuditEntry(client, {
    tenantId,
    tipo: 'kds_estado',
    entidad: 'cocina_queue',
    entidadId: queueId,
    descripcion: `Orden mesa ${item.mesa_numero}: ${item.estado} -> ${estado}`,
    datos: {
      estado_anterior: item.estado,
      estado_nuevo: estado,
      mesa_numero: item.mesa_numero,
      cuenta_id: item.cuenta_id,
    },
    usuario,
    usuarioId,
    ip,
  });

  logger.info('KDS estado actualizado', {
    tenantId,
    queueId,
    mesaNumero: item.mesa_numero,
    estadoAnterior: item.estado,
    estadoNuevo: estado,
  });

  return updated;
}

// ============================================================================
// 4. getEstadisticas
// ============================================================================

/**
 * Get KDS analytics for a date range.
 *
 * Returns:
 *   - Counts by estado
 *   - Average preparation time (inicio_preparacion -> listo_en)
 *   - Items exceeding alerta/critico thresholds
 *   - Busiest hours
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.desde    - Start date (ISO string or YYYY-MM-DD)
 * @param {string}  params.hasta    - End date (ISO string or YYYY-MM-DD)
 * @param {string}  params.tenantId - UUID
 * @returns {Promise<object>}
 */
export async function getEstadisticas(client, { desde, hasta, tenantId }) {
  const { alerta, critico } = await getTenantKdsConfig(client, tenantId);

  // --- Summary counts and average prep time ----------------------------------
  const { rows: [resumen] } = await client.query(
    `SELECT
       COUNT(*)::integer AS total,
       COUNT(*) FILTER (WHERE estado = 'pendiente')::integer AS pendientes,
       COUNT(*) FILTER (WHERE estado = 'en_preparacion')::integer AS en_preparacion,
       COUNT(*) FILTER (WHERE estado = 'listo')::integer AS listos,
       COUNT(*) FILTER (WHERE estado = 'entregado')::integer AS entregados,
       AVG(EXTRACT(EPOCH FROM (listo_en - inicio_preparacion)))
         FILTER (WHERE listo_en IS NOT NULL AND inicio_preparacion IS NOT NULL) AS avg_prep_seconds
     FROM cocina_queue
     WHERE created_at >= $1 AND created_at <= $2`,
    [desde, hasta]
  );

  // --- Items exceeding thresholds --------------------------------------------
  const { rows: [thresholds] } = await client.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE EXTRACT(EPOCH FROM (COALESCE(listo_en, NOW()) - created_at)) / 60 > $3
       )::integer AS excedieron_critico,
       COUNT(*) FILTER (
         WHERE EXTRACT(EPOCH FROM (COALESCE(listo_en, NOW()) - created_at)) / 60 > $4
           AND EXTRACT(EPOCH FROM (COALESCE(listo_en, NOW()) - created_at)) / 60 <= $3
       )::integer AS excedieron_alerta
     FROM cocina_queue
     WHERE created_at >= $1 AND created_at <= $2`,
    [desde, hasta, critico, alerta]
  );

  // --- Busiest hours ---------------------------------------------------------
  const { rows: horasPico } = await client.query(
    `SELECT
       EXTRACT(HOUR FROM created_at)::integer AS hora,
       COUNT(*)::integer AS cantidad
     FROM cocina_queue
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY EXTRACT(HOUR FROM created_at)
     ORDER BY cantidad DESC`,
    [desde, hasta]
  );

  logger.debug('KDS estadisticas generadas', {
    tenantId,
    desde,
    hasta,
    total: resumen.total,
  });

  return {
    resumen: {
      ...resumen,
      avg_prep_seconds: resumen.avg_prep_seconds != null
        ? parseFloat(parseFloat(resumen.avg_prep_seconds).toFixed(1))
        : null,
    },
    umbrales: {
      alerta_min: alerta,
      critico_min: critico,
      excedieron_alerta: thresholds.excedieron_alerta,
      excedieron_critico: thresholds.excedieron_critico,
    },
    horas_pico: horasPico,
  };
}

// ============================================================================
// 5. getHistorial
// ============================================================================

/**
 * Paginated history of completed (entregado) queue items.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  [params.desde]  - Start date filter
 * @param {string}  [params.hasta]  - End date filter
 * @param {number}  [params.page=1] - Page number (1-based)
 * @param {number}  [params.limit=50] - Items per page
 * @returns {Promise<{ data: object[], pagination: object }>}
 */
export async function getHistorial(client, {
  desde = null,
  hasta = null,
  page = 1,
  limit = 50,
}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (safePage - 1) * safeLimit;

  const conditions = [`cq.estado = 'entregado'`];
  const params = [];
  let paramIdx = 1;

  if (desde) {
    conditions.push(`cq.created_at >= $${paramIdx++}`);
    params.push(desde);
  }

  if (hasta) {
    conditions.push(`cq.created_at <= $${paramIdx++}`);
    params.push(hasta);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Count total for pagination
  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM cocina_queue cq ${whereClause}`,
    params
  );

  // Fetch page
  const { rows } = await client.query(
    `SELECT cq.*,
       EXTRACT(EPOCH FROM (cq.listo_en - cq.inicio_preparacion)) AS prep_seconds
     FROM cocina_queue cq
     ${whereClause}
     ORDER BY cq.entregado_en DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, safeLimit, offset]
  );

  return {
    data: rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: countRow.total,
      pages: Math.ceil(countRow.total / safeLimit),
    },
  };
}
