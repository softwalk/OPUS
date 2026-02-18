import crypto from 'crypto';
import { createAuditEntry } from './audit.service.js';
import logger from '../logger.js';

// ============================================================================
// HELPERS (internal)
// ============================================================================

/**
 * Retrieve the IVA percentage for a tenant from their config JSONB.
 * Returns a decimal fraction (e.g. 16 for 16%).
 * Falls back to 16 if the config key is missing.
 */
async function getTenantIva(client, tenantId) {
  const { rows: [row] } = await client.query(
    `SELECT config->>'iva_porcentaje' AS iva FROM tenants WHERE id = $1`,
    [tenantId]
  );
  if (!row || row.iva == null) return 16;
  return parseFloat(row.iva);
}

/**
 * Valid state transitions for digital orders.
 */
const ORDEN_TRANSITIONS = {
  pendiente: ['confirmada', 'cancelada'],
  confirmada: ['en_preparacion', 'cancelada'],
  en_preparacion: ['lista', 'cancelada'],
  lista: ['en_camino', 'entregada', 'cancelada'],
  en_camino: ['entregada', 'cancelada'],
  entregada: [],
  cancelada: [],
};

/**
 * Valid state transitions for reservaciones.
 */
const RESERVACION_TRANSITIONS = {
  pendiente: ['confirmada', 'cancelada'],
  confirmada: ['sentada', 'cancelada', 'no_show'],
  sentada: [],
  cancelada: [],
  no_show: [],
};

// ============================================================================
// 1. createOrden — Digital Order
// ============================================================================

/**
 * Create a digital order (QR table, delivery, or takeout).
 *
 * Includes full stock checking (86 + BOM) which was missing in Compurest.
 * Automatically creates a KDS entry for the kitchen.
 * All monetary values are INTEGER (centavos).
 *
 * @param {import('pg').PoolClient} client - Tenant-scoped DB client
 * @param {object} params
 * @param {'qr_mesa'|'delivery'|'para_llevar'} params.tipo
 * @param {string}  [params.mesaId]
 * @param {string}  [params.clienteNombre]
 * @param {string}  [params.clienteTelefono]
 * @param {string}  [params.direccionEntrega]
 * @param {string}  [params.zonaEntregaId]
 * @param {Array}   params.items - [{ producto_id, cantidad, modificadores, notas }]
 * @param {string}  [params.notas]
 * @param {string}  [params.formaPago]
 * @param {string}  params.tenantId
 * @param {string}  [params.usuario]
 * @param {string}  [params.usuarioId]
 * @param {string}  [params.ip]
 * @returns {Promise<object>}
 */
export async function createOrden(client, {
  tipo,
  mesaId = null,
  clienteNombre = null,
  clienteTelefono = null,
  direccionEntrega = null,
  zonaEntregaId = null,
  items,
  notas = null,
  formaPago = null,
  tenantId,
  usuario = null,
  usuarioId = null,
  ip = null,
}) {
  // --- 1. Stock check for every item (FIX from Compurest) -------------------
  const resolvedItems = [];

  for (const item of items) {
    const { rows: [prod] } = await client.query(
      `SELECT id, clave, descripcion, precio_venta, tipo, suspendido_86,
              suspendido_86_motivo, bloquear_sin_stock
       FROM productos WHERE id = $1 AND activo = true`,
      [item.producto_id]
    );

    if (!prod) {
      return {
        error: true,
        status: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: `Producto ${item.producto_id} no encontrado o inactivo`,
      };
    }

    // 86 hard block
    if (prod.suspendido_86) {
      return {
        error: true,
        status: 409,
        code: 'STOCK_86',
        message: `${prod.descripcion} esta marcado como 86 (${prod.suspendido_86_motivo || 'Agotado'})`,
        producto_id: prod.id,
      };
    }

    // BOM stock check for terminado products
    if (prod.tipo === 'terminado') {
      const { rows: receta } = await client.query(
        `SELECT insumo_id, cantidad FROM recetas WHERE producto_id = $1`,
        [prod.id]
      );

      if (receta.length > 0) {
        for (const ing of receta) {
          const { rows: [stockRow] } = await client.query(
            `SELECT COALESCE(SUM(cantidad), 0) AS stock FROM existencias WHERE producto_id = $1`,
            [ing.insumo_id]
          );

          const requerido = parseFloat(ing.cantidad) * (item.cantidad || 1);
          const disponible = parseFloat(stockRow.stock);

          if (disponible < requerido && prod.bloquear_sin_stock) {
            const { rows: [insumo] } = await client.query(
              `SELECT descripcion FROM productos WHERE id = $1`,
              [ing.insumo_id]
            );
            return {
              error: true,
              status: 409,
              code: 'STOCK_INSUFFICIENT',
              message: `Stock insuficiente de ${insumo?.descripcion || 'ingrediente'} para ${prod.descripcion}`,
              producto_id: prod.id,
            };
          }
        }
      }
    }

    const cantidad = item.cantidad || 1;
    const precioUnitario = prod.precio_venta;
    const importe = Math.round(cantidad * precioUnitario);

    resolvedItems.push({
      producto_id: prod.id,
      producto_nombre: prod.descripcion,
      clave: prod.clave,
      cantidad,
      precio_unitario: precioUnitario,
      importe,
      modificadores: item.modificadores || [],
      notas: item.notas || null,
    });
  }

  // --- 2. Delivery zone lookup -----------------------------------------------
  let costoEnvio = 0;
  let tiempoEstimado = null;

  if (tipo === 'delivery' && zonaEntregaId) {
    const { rows: [zona] } = await client.query(
      `SELECT costo_envio, tiempo_estimado FROM zonas_entrega
       WHERE id = $1 AND activa = true`,
      [zonaEntregaId]
    );

    if (zona) {
      costoEnvio = zona.costo_envio;
      tiempoEstimado = zona.tiempo_estimado;
    }
  }

  // --- 3. Mesa number for KDS ------------------------------------------------
  let mesaNumero = null;
  if (mesaId) {
    const { rows: [mesa] } = await client.query(
      `SELECT numero FROM mesas WHERE id = $1`,
      [mesaId]
    );
    mesaNumero = mesa?.numero || null;
  }

  // --- 4. Calculate totals ---------------------------------------------------
  const subtotal = resolvedItems.reduce((sum, i) => sum + i.importe, 0);
  const ivaPct = await getTenantIva(client, tenantId);
  const iva = Math.round(subtotal * ivaPct / 100);
  const total = subtotal + iva + costoEnvio;

  // --- 5. Begin transaction --------------------------------------------------
  await client.query('BEGIN');
  try {
    // Generate folio: D + YYMMDD-HHMMSS
    const { rows: [folioRow] } = await client.query(
      `SELECT 'D' || TO_CHAR(NOW(), 'YYMMDD-HH24MISS') AS folio`
    );
    const folio = folioRow.folio;

    // Insert orden
    const { rows: [orden] } = await client.query(
      `INSERT INTO ordenes_digitales
         (tenant_id, tipo, mesa_id, cliente_nombre, cliente_telefono,
          direccion_entrega, zona_entrega_id, costo_envio, subtotal, iva, total,
          notas, forma_pago, estado, tiempo_estimado, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               'pendiente', $14, NOW())
       RETURNING *`,
      [
        tenantId, tipo, mesaId, clienteNombre, clienteTelefono,
        direccionEntrega, zonaEntregaId, costoEnvio, subtotal, iva, total,
        notas, formaPago, tiempoEstimado,
      ]
    );

    // Insert items
    const insertedItems = [];
    for (const ri of resolvedItems) {
      const { rows: [itemRow] } = await client.query(
        `INSERT INTO ordenes_digitales_items
           (tenant_id, orden_id, producto_id, cantidad, precio_unitario, importe,
            modificadores, notas)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          tenantId, orden.id, ri.producto_id, ri.cantidad,
          ri.precio_unitario, ri.importe,
          JSON.stringify(ri.modificadores), ri.notas,
        ]
      );
      insertedItems.push({ ...itemRow, producto_nombre: ri.producto_nombre, clave: ri.clave });
    }

    // --- 6. AUTO-CREATE KDS ENTRY --------------------------------------------
    const kdsItems = resolvedItems.map(ri => ({
      producto_nombre: ri.producto_nombre,
      cantidad: ri.cantidad,
      modificadores: ri.modificadores,
      notas: ri.notas,
    }));

    await client.query(
      `INSERT INTO cocina_queue
         (tenant_id, tipo_origen, orden_digital_id, mesa_numero, items_json,
          estado, prioridad, notas, tiempo_estimado)
       VALUES ($1, 'digital', $2, $3, $4, 'pendiente', 0, $5, $6)`,
      [
        tenantId, orden.id, mesaNumero,
        JSON.stringify(kdsItems), notas, tiempoEstimado,
      ]
    );

    // --- 7. Audit entry ------------------------------------------------------
    await createAuditEntry(client, {
      tenantId,
      tipo: 'orden_digital',
      entidad: 'orden_digital',
      entidadId: orden.id,
      descripcion: `Orden digital ${tipo} creada — Folio: ${folio}`,
      datos: {
        tipo,
        folio,
        num_items: resolvedItems.length,
        subtotal,
        iva,
        total,
        costo_envio: costoEnvio,
        mesa_id: mesaId,
        cliente_nombre: clienteNombre,
      },
      usuario,
      usuarioId,
      ip,
    });

    await client.query('COMMIT');

    logger.info('Orden digital creada', {
      tenantId,
      ordenId: orden.id,
      folio,
      tipo,
      total,
      numItems: resolvedItems.length,
    });

    return {
      ...orden,
      folio,
      items: insertedItems,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error creando orden digital', { tenantId, error: err.message });
    throw err;
  }
}

// ============================================================================
// 2. getOrden
// ============================================================================

/**
 * Get a single digital order with its items and delivery zone info.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} ordenId - UUID
 * @returns {Promise<object>}
 */
export async function getOrden(client, ordenId) {
  const { rows: [orden] } = await client.query(
    `SELECT od.*, ze.nombre AS zona_nombre, ze.tiempo_estimado AS zona_tiempo_estimado
     FROM ordenes_digitales od
     LEFT JOIN zonas_entrega ze ON od.zona_entrega_id = ze.id
     WHERE od.id = $1`,
    [ordenId]
  );

  if (!orden) {
    return { error: true, status: 404, code: 'ORDEN_NOT_FOUND', message: 'Orden no encontrada' };
  }

  const { rows: items } = await client.query(
    `SELECT odi.*, p.descripcion AS producto_nombre, p.clave
     FROM ordenes_digitales_items odi
     JOIN productos p ON odi.producto_id = p.id
     WHERE odi.orden_id = $1
     ORDER BY odi.created_at`,
    [ordenId]
  );

  return { ...orden, items };
}

// ============================================================================
// 3. listOrdenes
// ============================================================================

/**
 * List digital orders with pagination and filters.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  [params.tipo]   - Filter by tipo
 * @param {string}  [params.estado] - Filter by estado
 * @param {string}  [params.desde]  - Start date (YYYY-MM-DD)
 * @param {string}  [params.hasta]  - End date (YYYY-MM-DD)
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=50]
 * @returns {Promise<object>}
 */
export async function listOrdenes(client, {
  tipo,
  estado,
  desde,
  hasta,
  page = 1,
  limit = 50,
} = {}) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (tipo) {
    conditions.push(`od.tipo = $${paramIdx++}`);
    params.push(tipo);
  }

  if (estado) {
    conditions.push(`od.estado = $${paramIdx++}`);
    params.push(estado);
  }

  if (desde) {
    conditions.push(`od.created_at >= $${paramIdx++}::date`);
    params.push(desde);
  }

  if (hasta) {
    conditions.push(`od.created_at < ($${paramIdx++}::date + INTERVAL '1 day')`);
    params.push(hasta);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const offset = (page - 1) * limit;

  // Count total matching
  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM ordenes_digitales od ${whereClause}`,
    params
  );

  // Fetch paginated rows
  const { rows } = await client.query(
    `SELECT od.*, ze.nombre AS zona_nombre
     FROM ordenes_digitales od
     LEFT JOIN zonas_entrega ze ON od.zona_entrega_id = ze.id
     ${whereClause}
     ORDER BY od.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return {
    ordenes: rows,
    total: countRow.total,
    page,
    limit,
    pages: Math.ceil(countRow.total / limit),
  };
}

// ============================================================================
// 4. updateEstadoOrden
// ============================================================================

/**
 * Update the state of a digital order with validated transitions.
 *
 * Valid transitions:
 *   pendiente -> confirmada -> en_preparacion -> lista -> en_camino -> entregada
 *   Any state -> cancelada
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string} params.ordenId
 * @param {string} params.estado    - New state
 * @param {string} [params.motivo]  - Reason (for cancellation)
 * @param {string} params.tenantId
 * @param {string} [params.usuario]
 * @param {string} [params.usuarioId]
 * @param {string} [params.ip]
 * @returns {Promise<object>}
 */
export async function updateEstadoOrden(client, {
  ordenId,
  estado,
  motivo = null,
  tenantId,
  usuario = null,
  usuarioId = null,
  ip = null,
}) {
  const { rows: [orden] } = await client.query(
    `SELECT id, estado, tipo FROM ordenes_digitales WHERE id = $1`,
    [ordenId]
  );

  if (!orden) {
    return { error: true, status: 404, code: 'ORDEN_NOT_FOUND', message: 'Orden no encontrada' };
  }

  // Validate transition
  const validNext = ORDEN_TRANSITIONS[orden.estado] || [];
  if (!validNext.includes(estado)) {
    return {
      error: true,
      status: 400,
      code: 'INVALID_TRANSITION',
      message: `No se puede cambiar de '${orden.estado}' a '${estado}'`,
    };
  }

  // Delivery orders support 'en_camino'
  if (estado === 'en_camino' && orden.tipo !== 'delivery') {
    return {
      error: true,
      status: 400,
      code: 'INVALID_TRANSITION',
      message: `Estado 'en_camino' solo aplica para ordenes delivery`,
    };
  }

  // Build update fields
  const setClauses = [`estado = $1`, `actualizada_en = NOW()`];
  const updateParams = [estado];
  let paramIdx = 2;

  if (estado === 'entregada') {
    setClauses.push(`actualizada_en = NOW()`);
  }

  const { rows: [updated] } = await client.query(
    `UPDATE ordenes_digitales
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx++}
     RETURNING *`,
    [...updateParams, ordenId]
  );

  // Audit entry
  await createAuditEntry(client, {
    tenantId,
    tipo: 'orden_digital_estado',
    entidad: 'orden_digital',
    entidadId: ordenId,
    descripcion: `Orden digital ${orden.estado} -> ${estado}${motivo ? ` (${motivo})` : ''}`,
    datos: {
      estado_anterior: orden.estado,
      estado_nuevo: estado,
      motivo,
    },
    usuario,
    usuarioId,
    ip,
  });

  logger.info('Estado orden digital actualizado', {
    tenantId,
    ordenId,
    estadoAnterior: orden.estado,
    estadoNuevo: estado,
  });

  return updated;
}

// ============================================================================
// 5. listZonasEntrega
// ============================================================================

/**
 * List active delivery zones with cost and estimated time.
 *
 * @param {import('pg').PoolClient} client
 * @returns {Promise<object[]>}
 */
export async function listZonasEntrega(client) {
  const { rows } = await client.query(
    `SELECT * FROM zonas_entrega WHERE activa = true ORDER BY nombre`
  );
  return rows;
}

// ============================================================================
// 6. createZonaEntrega
// ============================================================================

/**
 * Create a new delivery zone.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.nombre
 * @param {number}  params.costoEnvio      - Integer centavos
 * @param {number}  [params.tiempoEstimadoMin=30] - Estimated delivery time in minutes
 * @param {string}  [params.descripcion]
 * @param {string}  params.tenantId
 * @returns {Promise<object>}
 */
export async function createZonaEntrega(client, {
  nombre,
  costoEnvio,
  tiempoEstimadoMin = 30,
  descripcion = null,
  tenantId,
}) {
  const { rows: [zona] } = await client.query(
    `INSERT INTO zonas_entrega (tenant_id, nombre, descripcion, costo_envio, tiempo_estimado, activa)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING *`,
    [tenantId, nombre, descripcion, costoEnvio, tiempoEstimadoMin]
  );

  logger.info('Zona de entrega creada', { tenantId, zonaId: zona.id, nombre });

  return zona;
}

// ============================================================================
// 7. updateZonaEntrega
// ============================================================================

/**
 * Update an existing delivery zone.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.zonaId
 * @param {string}  [params.nombre]
 * @param {number}  [params.costoEnvio]
 * @param {number}  [params.tiempoEstimadoMin]
 * @param {string}  [params.descripcion]
 * @param {boolean} [params.activa]
 * @returns {Promise<object>}
 */
export async function updateZonaEntrega(client, {
  zonaId,
  nombre,
  costoEnvio,
  tiempoEstimadoMin,
  descripcion,
  activa,
}) {
  const setClauses = [];
  const params = [];
  let paramIdx = 1;

  if (nombre !== undefined) {
    setClauses.push(`nombre = $${paramIdx++}`);
    params.push(nombre);
  }
  if (costoEnvio !== undefined) {
    setClauses.push(`costo_envio = $${paramIdx++}`);
    params.push(costoEnvio);
  }
  if (tiempoEstimadoMin !== undefined) {
    setClauses.push(`tiempo_estimado = $${paramIdx++}`);
    params.push(tiempoEstimadoMin);
  }
  if (descripcion !== undefined) {
    setClauses.push(`descripcion = $${paramIdx++}`);
    params.push(descripcion);
  }
  if (activa !== undefined) {
    setClauses.push(`activa = $${paramIdx++}`);
    params.push(activa);
  }

  if (setClauses.length === 0) {
    return { error: true, status: 400, code: 'NO_CHANGES', message: 'No hay cambios que aplicar' };
  }

  const { rows: [zona] } = await client.query(
    `UPDATE zonas_entrega SET ${setClauses.join(', ')} WHERE id = $${paramIdx++} RETURNING *`,
    [...params, zonaId]
  );

  if (!zona) {
    return { error: true, status: 404, code: 'ZONA_NOT_FOUND', message: 'Zona de entrega no encontrada' };
  }

  logger.info('Zona de entrega actualizada', { zonaId });

  return zona;
}

// ============================================================================
// 8. resolveQR — PUBLIC endpoint (no tenant RLS context)
// ============================================================================

/**
 * Resolve a QR token to mesa + tenant info.
 * This is a PUBLIC endpoint so it uses the raw pool query function
 * instead of a tenant-scoped client.
 *
 * @param {Function} poolQuery - Raw pool.query function (no RLS)
 * @param {string} token       - QR token
 * @returns {Promise<object>}
 */
export async function resolveQR(poolQuery, token) {
  const { rows: [result] } = await poolQuery(
    `SELECT qm.id AS qr_id, qm.mesa_id, qm.token,
            m.numero AS mesa_numero,
            t.id AS tenant_id, t.slug AS tenant_slug, t.nombre AS tenant_nombre
     FROM qr_mesas qm
     JOIN mesas m ON qm.mesa_id = m.id AND qm.tenant_id = m.tenant_id
     JOIN tenants t ON qm.tenant_id = t.id
     WHERE qm.token = $1 AND qm.activo = true AND t.activo = true`,
    [token]
  );

  if (!result) {
    return { error: true, status: 404, code: 'QR_NOT_FOUND', message: 'QR invalido o inactivo' };
  }

  return {
    tenant_slug: result.tenant_slug,
    tenant_nombre: result.tenant_nombre,
    tenant_id: result.tenant_id,
    mesa_id: result.mesa_id,
    mesa_numero: result.mesa_numero,
  };
}

// ============================================================================
// 9. generateQR
// ============================================================================

/**
 * Generate a new QR token for a mesa.
 * Deactivates any existing active tokens for the same mesa.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string} params.mesaId
 * @param {string} params.tenantId
 * @returns {Promise<object>}
 */
export async function generateQR(client, { mesaId, tenantId }) {
  // Verify mesa exists
  const { rows: [mesa] } = await client.query(
    `SELECT id, numero FROM mesas WHERE id = $1`,
    [mesaId]
  );

  if (!mesa) {
    return { error: true, status: 404, code: 'MESA_NOT_FOUND', message: 'Mesa no encontrada' };
  }

  // Deactivate existing tokens for this mesa
  await client.query(
    `UPDATE qr_mesas SET activo = false WHERE mesa_id = $1 AND tenant_id = $2`,
    [mesaId, tenantId]
  );

  // Generate a new token
  const token = crypto.randomUUID();

  const { rows: [qr] } = await client.query(
    `INSERT INTO qr_mesas (tenant_id, mesa_id, token, activo)
     VALUES ($1, $2, $3, true)
     RETURNING *`,
    [tenantId, mesaId, token]
  );

  logger.info('QR generado', { tenantId, mesaId, mesaNumero: mesa.numero, token });

  return {
    token: qr.token,
    mesa_id: qr.mesa_id,
    mesa_numero: mesa.numero,
    qr_id: qr.id,
  };
}

// ============================================================================
// RESERVATION HELPERS
// ============================================================================

/**
 * Get reservation config from tenant JSONB config.
 * Falls back to sensible defaults.
 */
async function getReservacionConfig(client, tenantId) {
  const { rows: [row] } = await client.query(
    `SELECT config FROM tenants WHERE id = $1`,
    [tenantId]
  );
  const cfg = row?.config || {};
  return {
    duracionHoras: cfg.reservacion_duracion_horas ?? 2,
    toleranciaMin: cfg.reservacion_tolerancia_min ?? 15,
    horarioInicio: cfg.reservacion_horario_inicio ?? '12:00',
    horarioFin: cfg.reservacion_horario_fin ?? '22:00',
    intervaloMin: cfg.reservacion_intervalo_min ?? 30,
  };
}

// ============================================================================
// 10. checkDisponibilidadReservaciones — Availability check
// ============================================================================

/**
 * Check available time slots for reservations on a given date.
 * Returns available slots with how many mesas remain free per slot.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.fecha    - YYYY-MM-DD
 * @param {number}  [params.personas=2]
 * @param {string}  params.tenantId
 * @returns {Promise<object>}
 */
export async function checkDisponibilidadReservaciones(client, {
  fecha,
  personas = 2,
  tenantId,
}) {
  const config = await getReservacionConfig(client, tenantId);
  const duracionSec = config.duracionHoras * 3600;

  // Get all mesas that can seat this party (capacidad >= personas)
  const { rows: mesasAptas } = await client.query(
    `SELECT id, numero, capacidad, zona_id FROM mesas
     WHERE capacidad >= $1 AND estado != 'cerrada'
     ORDER BY capacidad ASC, numero ASC`,
    [personas]
  );

  if (mesasAptas.length === 0) {
    return {
      fecha,
      personas,
      config,
      slots: [],
      mensaje: `No hay mesas con capacidad para ${personas} personas`,
    };
  }

  // Get all active reservations for this date
  const { rows: reservaciones } = await client.query(
    `SELECT id, hora, personas, mesa_id, estado
     FROM reservaciones
     WHERE fecha = $1
       AND estado IN ('pendiente', 'confirmada', 'sentada')
     ORDER BY hora`,
    [fecha]
  );

  // Generate time slots from horarioInicio to horarioFin
  const slots = [];
  const [inicioH, inicioM] = config.horarioInicio.split(':').map(Number);
  const [finH, finM] = config.horarioFin.split(':').map(Number);
  const inicioMin = inicioH * 60 + inicioM;
  const finMin = finH * 60 + finM;

  for (let t = inicioMin; t <= finMin; t += config.intervaloMin) {
    const h = String(Math.floor(t / 60)).padStart(2, '0');
    const m = String(t % 60).padStart(2, '0');
    const slotHora = `${h}:${m}`;
    const slotSec = t * 60;

    // Count how many mesas are blocked by existing reservations in this slot's window
    const mesasBloqueadas = new Set();
    for (const r of reservaciones) {
      const [rh, rm] = r.hora.split(':').map(Number);
      const rSec = (rh * 60 + rm) * 60;
      // A reservation blocks a mesa from (hora - duracion) to (hora + duracion)
      if (Math.abs(slotSec - rSec) < duracionSec) {
        if (r.mesa_id) {
          mesasBloqueadas.add(r.mesa_id);
        } else {
          // Reservation without assigned mesa — count it as blocking one apt mesa
          // Find the smallest apt mesa not already blocked
          for (const mesa of mesasAptas) {
            if (!mesasBloqueadas.has(mesa.id) && mesa.capacidad >= (r.personas || 2)) {
              mesasBloqueadas.add(mesa.id);
              break;
            }
          }
        }
      }
    }

    const mesasDisponibles = mesasAptas.filter(m => !mesasBloqueadas.has(m.id));

    slots.push({
      hora: slotHora,
      mesas_disponibles: mesasDisponibles.length,
      mesas_total: mesasAptas.length,
      disponible: mesasDisponibles.length > 0,
      mesas: mesasDisponibles.map(m => ({ id: m.id, numero: m.numero, capacidad: m.capacidad })),
    });
  }

  return {
    fecha,
    personas,
    config,
    total_mesas_aptas: mesasAptas.length,
    slots,
  };
}

// ============================================================================
// 10b. createReservacion — Enhanced with auto-mesa suggestion
// ============================================================================

/**
 * Create a new reservation with smart availability checking.
 * - Checks capacity (are there mesas that fit this party?)
 * - Checks time conflicts (is there space in this time window?)
 * - Auto-suggests the best mesa (smallest that fits)
 * - Returns available alternatives if requested slot is full
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function createReservacion(client, {
  clienteNombre,
  clienteTelefono = null,
  clienteEmail = null,
  fecha,
  hora,
  personas = 2,
  zonaPreferidaId = null,
  notas = null,
  tenantId,
}) {
  const config = await getReservacionConfig(client, tenantId);
  const duracionSec = config.duracionHoras * 3600;

  // 1. Find mesas that can seat this party
  const mesaConditions = [`capacidad >= $1`, `estado != 'cerrada'`];
  const mesaParams = [personas];
  let mpIdx = 2;
  if (zonaPreferidaId) {
    mesaConditions.push(`zona_id = $${mpIdx++}`);
    mesaParams.push(zonaPreferidaId);
  }

  const { rows: mesasAptas } = await client.query(
    `SELECT id, numero, capacidad, zona_id FROM mesas
     WHERE ${mesaConditions.join(' AND ')}
     ORDER BY capacidad ASC, numero ASC`,
    mesaParams
  );

  if (mesasAptas.length === 0) {
    // If zona was specified, try without zona
    if (zonaPreferidaId) {
      const { rows: anyMesas } = await client.query(
        `SELECT id, numero, capacidad FROM mesas WHERE capacidad >= $1 AND estado != 'cerrada'`,
        [personas]
      );
      if (anyMesas.length === 0) {
        return {
          error: true,
          status: 409,
          code: 'NO_CAPACITY',
          message: `No hay mesas con capacidad para ${personas} personas`,
        };
      }
      // There are mesas in other zones
      return {
        error: true,
        status: 409,
        code: 'ZONA_SIN_CAPACIDAD',
        message: `No hay mesas disponibles en la zona solicitada para ${personas} personas. Hay ${anyMesas.length} mesa(s) en otras zonas.`,
      };
    }
    return {
      error: true,
      status: 409,
      code: 'NO_CAPACITY',
      message: `No hay mesas con capacidad para ${personas} personas`,
    };
  }

  // 2. Check time conflicts — which mesas are already reserved in this window?
  const { rows: conflictos } = await client.query(
    `SELECT id, hora, cliente_nombre, personas, mesa_id
     FROM reservaciones
     WHERE fecha = $1
       AND estado IN ('pendiente', 'confirmada')
       AND ABS(EXTRACT(EPOCH FROM (hora::time - $2::time))) < $3
     ORDER BY hora`,
    [fecha, hora, duracionSec]
  );

  const mesasBloqueadas = new Set();
  for (const c of conflictos) {
    if (c.mesa_id) {
      mesasBloqueadas.add(c.mesa_id);
    }
  }
  // Also count unassigned reservations as blocking potential mesas
  const unassigned = conflictos.filter(c => !c.mesa_id);
  for (const u of unassigned) {
    for (const mesa of mesasAptas) {
      if (!mesasBloqueadas.has(mesa.id) && mesa.capacidad >= (u.personas || 2)) {
        mesasBloqueadas.add(mesa.id);
        break;
      }
    }
  }

  const mesasLibres = mesasAptas.filter(m => !mesasBloqueadas.has(m.id));

  if (mesasLibres.length === 0) {
    // Slot is full — suggest alternatives
    const disponibilidad = await checkDisponibilidadReservaciones(client, { fecha, personas, tenantId });
    const alternativas = disponibilidad.slots
      .filter(s => s.disponible && s.hora !== hora)
      .slice(0, 5)
      .map(s => ({ hora: s.hora, mesas_disponibles: s.mesas_disponibles }));

    return {
      error: true,
      status: 409,
      code: 'HORARIO_LLENO',
      message: `No hay mesas disponibles para ${personas} personas a las ${hora}`,
      alternativas,
    };
  }

  // 3. Auto-suggest best mesa (smallest capacity that fits, preferring zona)
  const mesaSugerida = mesasLibres[0]; // Already sorted by capacidad ASC

  // 4. Generate confirmation code: 8-char alphanumeric
  const codigoConfirmacion = crypto.randomUUID().substring(0, 8).toUpperCase();

  // 5. Insert reservation with suggested mesa
  const { rows: [reservacion] } = await client.query(
    `INSERT INTO reservaciones
       (tenant_id, cliente_nombre, cliente_telefono, cliente_email,
        fecha, hora, personas, mesa_id, zona_preferida_id, notas,
        estado, codigo_confirmacion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pendiente', $11)
     RETURNING *`,
    [
      tenantId, clienteNombre, clienteTelefono, clienteEmail,
      fecha, hora, personas, mesaSugerida.id, zonaPreferidaId, notas,
      codigoConfirmacion,
    ]
  );

  logger.info('Reservacion creada', {
    tenantId,
    reservacionId: reservacion.id,
    fecha,
    hora,
    personas,
    mesaSugerida: mesaSugerida.numero,
    codigo: codigoConfirmacion,
  });

  return {
    ...reservacion,
    mesa_numero: mesaSugerida.numero,
    mesa_capacidad: mesaSugerida.capacidad,
    mesas_restantes: mesasLibres.length - 1,
    config: {
      duracion_horas: config.duracionHoras,
      tolerancia_min: config.toleranciaMin,
    },
  };
}

// ============================================================================
// 11. listReservaciones
// ============================================================================

/**
 * List reservations with filters. Defaults to today's date.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  [params.fecha]  - YYYY-MM-DD, defaults to today
 * @param {string}  [params.estado] - Filter by estado
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=50]
 * @returns {Promise<object>}
 */
export async function listReservaciones(client, {
  fecha,
  estado,
  page = 1,
  limit = 50,
} = {}) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  // Default to today
  const fechaFilter = fecha || new Date().toISOString().slice(0, 10);
  conditions.push(`r.fecha = $${paramIdx++}`);
  params.push(fechaFilter);

  if (estado) {
    conditions.push(`r.estado = $${paramIdx++}`);
    params.push(estado);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM reservaciones r ${whereClause}`,
    params
  );

  const { rows } = await client.query(
    `SELECT r.*, z.nombre AS zona_nombre, m.numero AS mesa_numero
     FROM reservaciones r
     LEFT JOIN zonas z ON r.zona_preferida_id = z.id
     LEFT JOIN mesas m ON r.mesa_id = m.id
     ${whereClause}
     ORDER BY r.hora ASC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return {
    reservaciones: rows,
    total: countRow.total,
    page,
    limit,
    pages: Math.ceil(countRow.total / limit),
  };
}

// ============================================================================
// 12. updateReservacionEstado
// ============================================================================

/**
 * Update reservation state with validated transitions.
 * Now handles mesa blocking/unblocking automatically:
 *
 * - pendiente → confirmada: Mesa estado → 'reservada'
 * - confirmada → sentada: Mesa estado → 'ocupada' + auto-create cuenta
 * - confirmada → cancelada/no_show: Mesa estado → 'libre'
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.reservacionId
 * @param {string}  params.estado
 * @param {string}  [params.mesaId]  - Override mesa when seating (optional)
 * @param {number}  [params.personas] - Override personas for cuenta
 * @param {string}  params.tenantId
 * @param {string}  [params.usuario]
 * @param {string}  [params.usuarioId]
 * @param {string}  [params.ip]
 * @returns {Promise<object>}
 */
export async function updateReservacionEstado(client, {
  reservacionId,
  estado,
  mesaId = null,
  personas = null,
  tenantId,
  usuario = null,
  usuarioId = null,
  ip = null,
}) {
  const { rows: [reservacion] } = await client.query(
    `SELECT id, estado, cliente_nombre, mesa_id, personas, fecha, hora
     FROM reservaciones WHERE id = $1`,
    [reservacionId]
  );

  if (!reservacion) {
    return { error: true, status: 404, code: 'RESERVACION_NOT_FOUND', message: 'Reservacion no encontrada' };
  }

  // Validate transition
  const validNext = RESERVACION_TRANSITIONS[reservacion.estado] || [];
  if (!validNext.includes(estado)) {
    return {
      error: true,
      status: 400,
      code: 'INVALID_TRANSITION',
      message: `No se puede cambiar de '${reservacion.estado}' a '${estado}'`,
    };
  }

  // Determine the mesa to work with
  const targetMesaId = mesaId || reservacion.mesa_id;

  // Build update
  const setClauses = [`estado = $1`, `updated_at = NOW()`];
  const updateParams = [estado];
  let paramIdx = 2;

  if (mesaId && mesaId !== reservacion.mesa_id) {
    setClauses.push(`mesa_id = $${paramIdx++}`);
    updateParams.push(mesaId);
  }

  await client.query('BEGIN');
  try {
    // Update reservation
    const { rows: [updated] } = await client.query(
      `UPDATE reservaciones SET ${setClauses.join(', ')} WHERE id = $${paramIdx++} RETURNING *`,
      [...updateParams, reservacionId]
    );

    let cuenta = null;

    // === CONFIRM: Block the mesa as 'reservada' ===
    if (estado === 'confirmada' && targetMesaId) {
      await client.query(
        `UPDATE mesas SET estado = 'reservada' WHERE id = $1 AND estado = 'libre'`,
        [targetMesaId]
      );
      logger.info('Mesa bloqueada por reservacion', { mesaId: targetMesaId, reservacionId });
    }

    // === SEAT: Change mesa to 'ocupada' + auto-create cuenta ===
    if (estado === 'sentada' && targetMesaId) {
      // Update mesa to ocupada
      await client.query(
        `UPDATE mesas SET estado = 'ocupada', personas = $1, abierta_en = NOW()
         WHERE id = $2`,
        [personas || reservacion.personas || 2, targetMesaId]
      );

      // Auto-create cuenta for this mesa (same as abrirMesa)
      const { rows: [newCuenta] } = await client.query(
        `INSERT INTO cuentas
           (tenant_id, mesa_id, estado, personas, subtotal, iva, total, created_at)
         VALUES ($1, $2, 'abierta', $3, 0, 0, 0, NOW())
         RETURNING *`,
        [tenantId, targetMesaId, personas || reservacion.personas || 2]
      );
      cuenta = newCuenta;

      logger.info('Mesa abierta por reservacion sentada', {
        mesaId: targetMesaId,
        cuentaId: cuenta.id,
        reservacionId,
      });
    }

    // === CANCEL / NO_SHOW: Release the mesa back to 'libre' ===
    if ((estado === 'cancelada' || estado === 'no_show') && targetMesaId) {
      await client.query(
        `UPDATE mesas SET estado = 'libre', personas = 0 WHERE id = $1 AND estado = 'reservada'`,
        [targetMesaId]
      );
      logger.info('Mesa liberada por reservacion cancelada/no_show', {
        mesaId: targetMesaId,
        reservacionId,
        estado,
      });
    }

    // Audit entry
    await createAuditEntry(client, {
      tenantId,
      tipo: 'reservacion_estado',
      entidad: 'reservacion',
      entidadId: reservacionId,
      descripcion: `Reservacion de ${reservacion.cliente_nombre}: ${reservacion.estado} -> ${estado}${targetMesaId ? ` (Mesa)` : ''}`,
      datos: {
        estado_anterior: reservacion.estado,
        estado_nuevo: estado,
        mesa_id: targetMesaId,
        cuenta_id: cuenta?.id || null,
      },
      usuario,
      usuarioId,
      ip,
    });

    await client.query('COMMIT');

    logger.info('Estado reservacion actualizado', {
      tenantId,
      reservacionId,
      estadoAnterior: reservacion.estado,
      estadoNuevo: estado,
    });

    return {
      ...updated,
      mesa_id: targetMesaId,
      cuenta: cuenta || null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error actualizando reservacion', { reservacionId, estado, error: err.message });
    throw err;
  }
}

// ============================================================================
// 12b. processNoShows — Auto-detect no-shows after tolerance
// ============================================================================

/**
 * Find confirmed reservations past their tolerance window and mark as no_show.
 * Should be called periodically (e.g., every 5 minutes via setInterval).
 *
 * @param {import('pg').PoolClient} client
 * @param {string} tenantId
 * @returns {Promise<object>}
 */
export async function processNoShows(client, tenantId) {
  const config = await getReservacionConfig(client, tenantId);

  // Find confirmed reservations where (fecha + hora + tolerancia) < NOW()
  const { rows: noShows } = await client.query(
    `SELECT r.id, r.cliente_nombre, r.mesa_id, r.hora, r.fecha
     FROM reservaciones r
     WHERE r.estado = 'confirmada'
       AND r.fecha <= CURRENT_DATE
       AND (r.fecha + r.hora + ($1 || ' minutes')::interval) < NOW()`,
    [config.toleranciaMin]
  );

  const results = [];
  for (const ns of noShows) {
    // Mark as no_show
    await client.query(
      `UPDATE reservaciones SET estado = 'no_show', updated_at = NOW() WHERE id = $1`,
      [ns.id]
    );

    // Release the mesa
    if (ns.mesa_id) {
      await client.query(
        `UPDATE mesas SET estado = 'libre', personas = 0 WHERE id = $1 AND estado = 'reservada'`,
        [ns.mesa_id]
      );
    }

    await createAuditEntry(client, {
      tenantId,
      tipo: 'reservacion_no_show',
      entidad: 'reservacion',
      entidadId: ns.id,
      descripcion: `No-show automatico: ${ns.cliente_nombre} (${ns.hora}) — tolerancia ${config.toleranciaMin}min excedida`,
      datos: { mesa_id: ns.mesa_id, hora: ns.hora, tolerancia_min: config.toleranciaMin },
      usuario: 'sistema',
    });

    results.push({ id: ns.id, cliente: ns.cliente_nombre, hora: ns.hora });
    logger.info('No-show automatico detectado', { tenantId, reservacionId: ns.id, cliente: ns.cliente_nombre });
  }

  return { processed: results.length, no_shows: results };
}

// ============================================================================
// 12c. releaseExpiredReservations — Unblock mesas after duration expires
// ============================================================================

/**
 * Release mesas whose reservation duration has expired but were never seated.
 * Handles the case where a reservation was confirmed, mesa was blocked,
 * but the reservation window passed without the client arriving.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} tenantId
 * @returns {Promise<object>}
 */
export async function releaseExpiredReservations(client, tenantId) {
  const config = await getReservacionConfig(client, tenantId);

  // Find reservations that are past their full window (hora + duracion)
  // but still in 'pendiente' state (never confirmed)
  const { rows: expired } = await client.query(
    `SELECT r.id, r.cliente_nombre, r.mesa_id, r.hora, r.fecha
     FROM reservaciones r
     WHERE r.estado = 'pendiente'
       AND r.fecha <= CURRENT_DATE
       AND (r.fecha + r.hora + ($1 || ' hours')::interval) < NOW()`,
    [config.duracionHoras]
  );

  const results = [];
  for (const ex of expired) {
    await client.query(
      `UPDATE reservaciones SET estado = 'cancelada', updated_at = NOW() WHERE id = $1`,
      [ex.id]
    );

    if (ex.mesa_id) {
      await client.query(
        `UPDATE mesas SET estado = 'libre', personas = 0 WHERE id = $1 AND estado = 'reservada'`,
        [ex.mesa_id]
      );
    }

    results.push({ id: ex.id, cliente: ex.cliente_nombre, hora: ex.hora });
    logger.info('Reservacion pendiente expirada', { tenantId, reservacionId: ex.id });
  }

  return { processed: results.length, expired: results };
}

// ============================================================================
// 12d. getReservacionesByMesa — Show reservations for a specific mesa
// ============================================================================

/**
 * Get all upcoming reservations for a specific mesa.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} mesaId
 * @returns {Promise<object[]>}
 */
export async function getReservacionesByMesa(client, mesaId) {
  const { rows } = await client.query(
    `SELECT r.*, m.numero AS mesa_numero
     FROM reservaciones r
     JOIN mesas m ON r.mesa_id = m.id
     WHERE r.mesa_id = $1
       AND r.estado IN ('pendiente', 'confirmada')
       AND r.fecha >= CURRENT_DATE
     ORDER BY r.fecha ASC, r.hora ASC`,
    [mesaId]
  );
  return rows;
}

// ============================================================================
// 12e. getMesasConReservaciones — Timeline view for admin
// ============================================================================

/**
 * Get all mesas with their reservations for a given date.
 * Returns a complete view for admin to see which mesas are reserved when.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} fecha - YYYY-MM-DD
 * @returns {Promise<object>}
 */
export async function getMesasConReservaciones(client, fecha) {
  // Get all mesas
  const { rows: mesas } = await client.query(
    `SELECT id, numero, capacidad, estado, zona_id FROM mesas
     WHERE estado != 'cerrada'
     ORDER BY numero`
  );

  // Get all reservations for this date
  const { rows: reservaciones } = await client.query(
    `SELECT r.id, r.hora, r.personas, r.mesa_id, r.estado,
            r.cliente_nombre, r.cliente_telefono, r.codigo_confirmacion
     FROM reservaciones r
     WHERE r.fecha = $1
       AND r.estado IN ('pendiente', 'confirmada', 'sentada')
     ORDER BY r.hora`,
    [fecha]
  );

  // Map reservations to mesas
  const mesasMap = mesas.map(mesa => ({
    ...mesa,
    reservaciones: reservaciones.filter(r => r.mesa_id === mesa.id),
  }));

  return {
    fecha,
    mesas: mesasMap,
    total_reservaciones: reservaciones.length,
    mesas_con_reservacion: new Set(reservaciones.map(r => r.mesa_id).filter(Boolean)).size,
  };
}

// ============================================================================
// 13. getReservacion
// ============================================================================

/**
 * Get a single reservation detail.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} reservacionId - UUID
 * @returns {Promise<object>}
 */
export async function getReservacion(client, reservacionId) {
  const { rows: [reservacion] } = await client.query(
    `SELECT r.*, z.nombre AS zona_nombre, m.numero AS mesa_numero
     FROM reservaciones r
     LEFT JOIN zonas z ON r.zona_preferida_id = z.id
     LEFT JOIN mesas m ON r.mesa_id = m.id
     WHERE r.id = $1`,
    [reservacionId]
  );

  if (!reservacion) {
    return { error: true, status: 404, code: 'RESERVACION_NOT_FOUND', message: 'Reservacion no encontrada' };
  }

  return reservacion;
}

// ============================================================================
// 14. loginCliente — Lightweight phone-based auth
// ============================================================================

/**
 * Simple phone-based client authentication.
 * Looks up or creates a sesion_cliente record and returns a session token.
 *
 * This is a PUBLIC endpoint: the tenant is resolved from tenant_slug
 * using the raw pool query before calling this function with a tenant client.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string} params.telefono
 * @param {string} [params.nombre]
 * @param {string} params.tenantId
 * @returns {Promise<object>}
 */
export async function loginCliente(client, { telefono, nombre = null, tenantId }) {
  // Look for existing active session
  const { rows: [existing] } = await client.query(
    `SELECT id, telefono, nombre, verificado
     FROM sesiones_cliente
     WHERE telefono = $1 AND tenant_id = $2
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC
     LIMIT 1`,
    [telefono, tenantId]
  );

  if (existing) {
    // Update name if provided and different
    const token = crypto.randomUUID();

    // SECURITY FIX: Persist the token in the session record for later validation
    await client.query(
      `UPDATE sesiones_cliente SET token = $1, nombre = COALESCE($2, nombre), updated_at = NOW() WHERE id = $3`,
      [token, nombre, existing.id]
    );

    return {
      session_id: existing.id,
      cliente_nombre: nombre || existing.nombre,
      telefono: existing.telefono,
      token,
    };
  }

  // Create new session
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // SECURITY FIX: Store the token in the session record
  const { rows: [session] } = await client.query(
    `INSERT INTO sesiones_cliente (tenant_id, telefono, nombre, verificado, token, expires_at)
     VALUES ($1, $2, $3, false, $4, $5)
     RETURNING *`,
    [tenantId, telefono, nombre, token, expiresAt]
  );

  logger.info('Sesion cliente creada', { tenantId, telefono, sessionId: session.id });

  return {
    session_id: session.id,
    cliente_nombre: nombre,
    telefono,
    token,
  };
}

// ============================================================================
// 15. getCalificaciones
// ============================================================================

/**
 * Get customer ratings/reviews with optional date filters.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  [params.desde]  - Start date
 * @param {string}  [params.hasta]  - End date
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=50]
 * @returns {Promise<object>}
 */
export async function getCalificaciones(client, {
  desde,
  hasta,
  page = 1,
  limit = 50,
} = {}) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (desde) {
    conditions.push(`c.created_at >= $${paramIdx++}::date`);
    params.push(desde);
  }

  if (hasta) {
    conditions.push(`c.created_at < ($${paramIdx++}::date + INTERVAL '1 day')`);
    params.push(hasta);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const offset = (page - 1) * limit;

  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM calificaciones c ${whereClause}`,
    params
  );

  const { rows } = await client.query(
    `SELECT c.*, od.tipo AS orden_tipo
     FROM calificaciones c
     LEFT JOIN ordenes_digitales od ON c.orden_id = od.id
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  // Calculate average rating
  const { rows: [avgRow] } = await client.query(
    `SELECT COALESCE(AVG(estrellas), 0)::numeric(3,2) AS promedio,
            COUNT(*)::integer AS total_calificaciones
     FROM calificaciones c
     ${whereClause}`,
    params
  );

  return {
    calificaciones: rows,
    total: countRow.total,
    page,
    limit,
    pages: Math.ceil(countRow.total / limit),
    promedio: parseFloat(avgRow.promedio),
    total_calificaciones: avgRow.total_calificaciones,
  };
}

// ============================================================================
// 16. addCalificacion
// ============================================================================

/**
 * Add a customer rating/review for a digital order.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  [params.ordenId]    - UUID of the digital order
 * @param {number}  params.puntuacion   - 1-5 stars
 * @param {string}  [params.comentario]
 * @param {string}  [params.clienteNombre]
 * @param {string}  params.tenantId
 * @returns {Promise<object>}
 */
export async function addCalificacion(client, {
  ordenId = null,
  puntuacion,
  comentario = null,
  clienteNombre = null,
  tenantId,
}) {
  // Validate puntuacion
  if (puntuacion < 1 || puntuacion > 5) {
    return {
      error: true,
      status: 400,
      code: 'INVALID_RATING',
      message: 'Puntuacion debe ser entre 1 y 5',
    };
  }

  // If ordenId provided, verify it exists
  if (ordenId) {
    const { rows: [orden] } = await client.query(
      `SELECT id FROM ordenes_digitales WHERE id = $1`,
      [ordenId]
    );

    if (!orden) {
      return { error: true, status: 404, code: 'ORDEN_NOT_FOUND', message: 'Orden no encontrada' };
    }

    // Check for duplicate rating
    const { rows: [existing] } = await client.query(
      `SELECT id FROM calificaciones WHERE orden_id = $1`,
      [ordenId]
    );

    if (existing) {
      return {
        error: true,
        status: 409,
        code: 'ALREADY_RATED',
        message: 'Esta orden ya tiene una calificacion',
      };
    }
  }

  const { rows: [calificacion] } = await client.query(
    `INSERT INTO calificaciones (tenant_id, orden_id, estrellas, comentario, cliente_nombre)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tenantId, ordenId, puntuacion, comentario, clienteNombre]
  );

  logger.info('Calificacion agregada', {
    tenantId,
    calificacionId: calificacion.id,
    estrellas: puntuacion,
    ordenId,
  });

  return calificacion;
}
