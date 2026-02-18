import { createAuditEntry } from './audit.service.js';
import logger from '../logger.js';

// Valid movement types (from migration 006 CHECK constraint)
const TIPOS_VALIDOS = [
  'entrada_compra', 'entrada_traspaso', 'entrada_produccion', 'entrada_ajuste',
  'salida_venta', 'salida_traspaso', 'salida_desperdicio', 'salida_copeo', 'salida_ajuste',
];

// ============================================================================
// 1. listAlmacenes
// ============================================================================

/**
 * List all almacenes (warehouses) for the current tenant, ordered by numero.
 *
 * @param {import('pg').PoolClient} client - Tenant-scoped DB client
 * @returns {Promise<object[]>}
 */
export async function listAlmacenes(client) {
  const { rows } = await client.query(
    `SELECT * FROM almacenes WHERE activo = true ORDER BY numero`
  );
  return rows;
}

// ============================================================================
// 2. createAlmacen
// ============================================================================

/**
 * Create a new almacen (warehouse).
 * Enforces the COBOL constraint: numero must be <= 8.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.nombre      - Warehouse name
 * @param {number}  params.numero      - Warehouse number (1-8, COBOL constraint)
 * @param {string}  [params.descripcion] - Optional description
 * @param {string}  params.tenantId    - Tenant UUID
 * @returns {Promise<object>}
 */
export async function createAlmacen(client, { nombre, numero, descripcion = null, tenantId }) {
  // COBOL constraint: max 8 warehouses
  if (numero < 1 || numero > 8) {
    return {
      error: true,
      status: 400,
      code: 'ALMACEN_NUMERO_INVALID',
      message: 'El numero de almacen debe estar entre 1 y 8 (restriccion COBOL)',
    };
  }

  // Check for duplicate numero
  const { rows: existing } = await client.query(
    `SELECT id FROM almacenes WHERE numero = $1 AND tenant_id = $2`,
    [numero, tenantId]
  );

  if (existing.length > 0) {
    return {
      error: true,
      status: 409,
      code: 'ALMACEN_NUMERO_DUPLICADO',
      message: `Ya existe un almacen con el numero ${numero}`,
    };
  }

  const { rows: [almacen] } = await client.query(
    `INSERT INTO almacenes (tenant_id, numero, nombre, descripcion)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tenantId, numero, nombre, descripcion]
  );

  logger.info('Almacen creado', { tenantId, almacenId: almacen.id, numero, nombre });

  return almacen;
}

// ============================================================================
// 3. getExistencias
// ============================================================================

/**
 * List existencias (stock levels) with producto and almacen info.
 * Supports optional filters: almacen_id, producto_id, tipo, solo_con_stock, search.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  [params.almacenId]    - Filter by almacen UUID
 * @param {string}  [params.productoId]   - Filter by producto UUID
 * @param {string}  [params.tipo]         - Filter by producto tipo (insumo, subproducto, terminado)
 * @param {boolean} [params.soloConStock] - Only items with cantidad > 0
 * @param {string}  [params.search]       - ILIKE search on clave or descripcion
 * @returns {Promise<object[]>}
 */
export async function getExistencias(client, { almacenId, productoId, tipo, soloConStock, search } = {}) {
  const conditions = ['1=1'];
  const params = [];
  let paramIdx = 1;

  if (almacenId) {
    conditions.push(`e.almacen_id = $${paramIdx++}`);
    params.push(almacenId);
  }

  if (productoId) {
    conditions.push(`e.producto_id = $${paramIdx++}`);
    params.push(productoId);
  }

  if (tipo) {
    conditions.push(`p.tipo = $${paramIdx++}`);
    params.push(tipo);
  }

  if (soloConStock) {
    conditions.push(`e.cantidad > 0`);
  }

  if (search) {
    conditions.push(`(p.clave ILIKE $${paramIdx} OR p.descripcion ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  const { rows } = await client.query(
    `SELECT e.*, p.clave, p.descripcion, p.tipo AS producto_tipo, p.unidad,
            p.costo_unitario, p.punto_reorden,
            a.nombre AS almacen_nombre, a.numero AS almacen_numero
     FROM existencias e
     JOIN productos p ON e.producto_id = p.id
     JOIN almacenes a ON e.almacen_id = a.id
     WHERE ${whereClause}
     ORDER BY p.descripcion`,
    params
  );

  return rows;
}

// ============================================================================
// 4. getExistenciaProducto
// ============================================================================

/**
 * Get stock of a specific product across ALL almacenes.
 * Returns per-almacen breakdown and a grand total.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} productoId - Product UUID
 * @returns {Promise<{ existencias: object[], total: number }>}
 */
export async function getExistenciaProducto(client, productoId) {
  const { rows: existencias } = await client.query(
    `SELECT e.*, a.nombre AS almacen_nombre, a.numero AS almacen_numero
     FROM existencias e
     JOIN almacenes a ON e.almacen_id = a.id
     WHERE e.producto_id = $1
     ORDER BY a.numero`,
    [productoId]
  );

  const { rows: [totalRow] } = await client.query(
    `SELECT COALESCE(SUM(cantidad), 0) AS total
     FROM existencias
     WHERE producto_id = $1`,
    [productoId]
  );

  return {
    existencias,
    total: parseFloat(totalRow.total),
  };
}

// ============================================================================
// 5. createMovimiento  (CORE inventory engine)
// ============================================================================

/**
 * Create an inventory movement — the core function that updates stock levels.
 *
 * - Validates the movement type against the 9 valid types
 * - Determines direction from tipo prefix (entrada_ = positive, salida_ = negative)
 * - Upserts the existencia row (INSERT if not exists)
 * - Updates existencia quantity with signed amount
 * - Logs a warning (but allows) if salida would go negative (manager override at POS level)
 * - Records the movimiento with absolute quantity (tipo encodes direction)
 * - Creates an audit trail entry
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.productoId    - Product UUID
 * @param {string}  params.almacenId     - Warehouse UUID
 * @param {string}  params.tipo          - Movement type (one of 9 valid types)
 * @param {number}  params.cantidad      - Absolute quantity (always positive)
 * @param {number}  [params.costoUnitario=0] - Unit cost in centavos (INTEGER)
 * @param {string}  [params.referencia]  - Reference text (e.g. purchase order #, cuenta folio)
 * @param {string}  params.tenantId      - Tenant UUID
 * @param {string}  [params.usuario]     - Username / codigo
 * @param {string}  [params.usuarioId]   - User UUID
 * @param {string}  [params.ip]          - Request IP
 * @returns {Promise<object>}
 */
export async function createMovimiento(client, {
  productoId,
  almacenId,
  tipo,
  cantidad,
  costoUnitario = 0,
  referencia = null,
  tenantId,
  usuario = null,
  usuarioId = null,
  ip = null,
}) {
  // --- 1. Validate tipo --------------------------------------------------
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return {
      error: true,
      status: 400,
      code: 'TIPO_INVALIDO',
      message: `Tipo de movimiento invalido: ${tipo}. Validos: ${TIPOS_VALIDOS.join(', ')}`,
    };
  }

  // --- 2. Calculate signed quantity --------------------------------------
  const signedCantidad = tipo.startsWith('entrada_') ? cantidad : -cantidad;

  // --- 3. Upsert existencia row -----------------------------------------
  // Check if existencia row exists for this producto+almacen
  const { rows: [existencia] } = await client.query(
    `SELECT id, cantidad FROM existencias
     WHERE producto_id = $1 AND almacen_id = $2`,
    [productoId, almacenId]
  );

  if (!existencia) {
    // Create the existencia row with cantidad = 0 (the UPDATE below will set the real value)
    await client.query(
      `INSERT INTO existencias (tenant_id, producto_id, almacen_id, cantidad)
       VALUES ($1, $2, $3, 0)`,
      [tenantId, productoId, almacenId]
    );
  }

  // --- 4. Check for negative stock on salida types ----------------------
  if (tipo.startsWith('salida_')) {
    const currentQty = existencia ? parseFloat(existencia.cantidad) : 0;
    const newQty = currentQty + signedCantidad; // signedCantidad is negative

    if (newQty < 0) {
      logger.warn('Movimiento salida resultara en stock negativo', {
        tenantId,
        productoId,
        almacenId,
        tipo,
        cantidadActual: currentQty,
        cantidadSalida: cantidad,
        resultante: newQty,
      });
    }
  }

  // --- 5. Update existencias --------------------------------------------
  await client.query(
    `UPDATE existencias
     SET cantidad   = cantidad + $1,
         updated_at = NOW()
     WHERE producto_id = $2 AND almacen_id = $3`,
    [signedCantidad, productoId, almacenId]
  );

  // --- 6. Insert movimiento record (absolute cantidad) ------------------
  const { rows: [movimiento] } = await client.query(
    `INSERT INTO movimientos_inventario
       (tenant_id, producto_id, almacen_id, tipo, cantidad, costo_unitario, referencia, usuario)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [tenantId, productoId, almacenId, tipo, cantidad, costoUnitario, referencia, usuario]
  );

  // --- 7. Audit entry ---------------------------------------------------
  await createAuditEntry(client, {
    tenantId,
    tipo: 'movimiento_inventario',
    entidad: 'movimiento_inventario',
    entidadId: movimiento.id,
    descripcion: `${tipo}: ${cantidad} unidades`,
    datos: {
      producto_id: productoId,
      almacen_id: almacenId,
      tipo,
      cantidad,
      costo_unitario: costoUnitario,
      referencia,
    },
    usuario,
    usuarioId,
    ip,
  });

  logger.info('Movimiento de inventario creado', {
    tenantId,
    movimientoId: movimiento.id,
    tipo,
    productoId,
    almacenId,
    cantidad,
  });

  return movimiento;
}

// ============================================================================
// 6. listMovimientos
// ============================================================================

/**
 * Paginated list of inventory movements with producto and almacen info.
 * Supports filters: producto_id, almacen_id, tipo, date range.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  [params.productoId]  - Filter by product UUID
 * @param {string}  [params.almacenId]   - Filter by almacen UUID
 * @param {string}  [params.tipo]        - Filter by movement type
 * @param {string}  [params.desde]       - Start date (YYYY-MM-DD)
 * @param {string}  [params.hasta]       - End date (YYYY-MM-DD)
 * @param {number}  [params.page=1]      - Page number
 * @param {number}  [params.limit=50]    - Items per page
 * @returns {Promise<{ movimientos: object[], total: number, page: number, pages: number }>}
 */
export async function listMovimientos(client, {
  productoId,
  almacenId,
  tipo,
  desde,
  hasta,
  page = 1,
  limit = 50,
} = {}) {
  const conditions = ['1=1'];
  const params = [];
  let paramIdx = 1;

  if (productoId) {
    conditions.push(`mi.producto_id = $${paramIdx++}`);
    params.push(productoId);
  }

  if (almacenId) {
    conditions.push(`mi.almacen_id = $${paramIdx++}`);
    params.push(almacenId);
  }

  if (tipo) {
    conditions.push(`mi.tipo = $${paramIdx++}`);
    params.push(tipo);
  }

  if (desde) {
    conditions.push(`mi.created_at >= $${paramIdx++}::date`);
    params.push(desde);
  }

  if (hasta) {
    conditions.push(`mi.created_at < ($${paramIdx++}::date + INTERVAL '1 day')`);
    params.push(hasta);
  }

  const whereClause = conditions.join(' AND ');

  // Count total matching rows
  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total
     FROM movimientos_inventario mi
     WHERE ${whereClause}`,
    params
  );

  const total = countRow.total;
  const pages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;

  // Fetch paginated results
  const { rows: movimientos } = await client.query(
    `SELECT mi.*, p.clave, p.descripcion AS producto_nombre, p.unidad,
            a.nombre AS almacen_nombre
     FROM movimientos_inventario mi
     JOIN productos p ON mi.producto_id = p.id
     JOIN almacenes a ON mi.almacen_id = a.id
     WHERE ${whereClause}
     ORDER BY mi.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return { movimientos, total, page, pages };
}

// ============================================================================
// 7. traspasoAlmacen
// ============================================================================

/**
 * Transfer stock from one almacen to another.
 * Creates a salida_traspaso in the source and an entrada_traspaso in the destination.
 * Both movements reference each other for traceability.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.productoId   - Product UUID
 * @param {string}  params.deAlmacenId  - Source almacen UUID
 * @param {string}  params.aAlmacenId   - Destination almacen UUID
 * @param {number}  params.cantidad     - Quantity to transfer
 * @param {string}  params.tenantId     - Tenant UUID
 * @param {string}  [params.usuario]
 * @param {string}  [params.usuarioId]
 * @param {string}  [params.ip]
 * @returns {Promise<{ salida: object, entrada: object }>}
 */
export async function traspasoAlmacen(client, {
  productoId,
  deAlmacenId,
  aAlmacenId,
  cantidad,
  tenantId,
  usuario = null,
  usuarioId = null,
  ip = null,
}) {
  if (deAlmacenId === aAlmacenId) {
    return {
      error: true,
      status: 400,
      code: 'TRASPASO_MISMO_ALMACEN',
      message: 'No se puede traspasar al mismo almacen',
    };
  }

  const referencia = `Traspaso ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;

  // Salida from source
  const salida = await createMovimiento(client, {
    productoId,
    almacenId: deAlmacenId,
    tipo: 'salida_traspaso',
    cantidad,
    referencia,
    tenantId,
    usuario,
    usuarioId,
    ip,
  });

  if (salida.error) return salida;

  // Entrada to destination
  const entrada = await createMovimiento(client, {
    productoId,
    almacenId: aAlmacenId,
    tipo: 'entrada_traspaso',
    cantidad,
    referencia,
    tenantId,
    usuario,
    usuarioId,
    ip,
  });

  if (entrada.error) return entrada;

  logger.info('Traspaso de almacen realizado', {
    tenantId,
    productoId,
    deAlmacenId,
    aAlmacenId,
    cantidad,
  });

  return { salida, entrada };
}

// ============================================================================
// 8. ajusteInventario
// ============================================================================

/**
 * Adjust inventory based on a physical count.
 * Calculates the difference between the real count and the system count,
 * then creates the appropriate entrada_ajuste or salida_ajuste movement.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.productoId   - Product UUID
 * @param {string}  params.almacenId    - Almacen UUID
 * @param {number}  params.cantidadReal - Physical count quantity
 * @param {string}  params.tenantId     - Tenant UUID
 * @param {string}  [params.usuario]
 * @param {string}  [params.usuarioId]
 * @param {string}  [params.ip]
 * @returns {Promise<{ anterior: number, actual: number, diferencia: number, movimiento: object|null }>}
 */
export async function ajusteInventario(client, {
  productoId,
  almacenId,
  cantidadReal,
  tenantId,
  usuario = null,
  usuarioId = null,
  ip = null,
}) {
  // Get current existencia
  const { rows: [existencia] } = await client.query(
    `SELECT cantidad FROM existencias
     WHERE producto_id = $1 AND almacen_id = $2`,
    [productoId, almacenId]
  );

  const anterior = existencia ? parseFloat(existencia.cantidad) : 0;
  const diferencia = cantidadReal - anterior;

  // No change needed
  if (diferencia === 0) {
    return {
      anterior,
      actual: cantidadReal,
      diferencia: 0,
      movimiento: null,
    };
  }

  const tipo = diferencia > 0 ? 'entrada_ajuste' : 'salida_ajuste';
  const cantidadAbsoluta = Math.abs(diferencia);

  const movimiento = await createMovimiento(client, {
    productoId,
    almacenId,
    tipo,
    cantidad: cantidadAbsoluta,
    referencia: `Ajuste de inventario: ${anterior} -> ${cantidadReal}`,
    tenantId,
    usuario,
    usuarioId,
    ip,
  });

  if (movimiento.error) return movimiento;

  logger.info('Ajuste de inventario realizado', {
    tenantId,
    productoId,
    almacenId,
    anterior,
    actual: cantidadReal,
    diferencia,
  });

  return {
    anterior,
    actual: cantidadReal,
    diferencia,
    movimiento,
  };
}

// ============================================================================
// 9. getKardex
// ============================================================================

/**
 * Get the movement history (kardex) for a specific product, chronologically.
 * Optionally filtered by almacen and date range.
 * Calculates a running balance.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.productoId   - Product UUID
 * @param {string}  [params.almacenId]  - Filter by almacen UUID
 * @param {string}  [params.desde]      - Start date (YYYY-MM-DD)
 * @param {string}  [params.hasta]      - End date (YYYY-MM-DD)
 * @returns {Promise<{ movimientos: object[], producto_nombre: string }>}
 */
export async function getKardex(client, {
  productoId,
  almacenId,
  desde,
  hasta,
} = {}) {
  const conditions = ['mi.producto_id = $1'];
  const params = [productoId];
  let paramIdx = 2;

  if (almacenId) {
    conditions.push(`mi.almacen_id = $${paramIdx++}`);
    params.push(almacenId);
  }

  if (desde) {
    conditions.push(`mi.created_at >= $${paramIdx++}::date`);
    params.push(desde);
  }

  if (hasta) {
    conditions.push(`mi.created_at < ($${paramIdx++}::date + INTERVAL '1 day')`);
    params.push(hasta);
  }

  const whereClause = conditions.join(' AND ');

  const { rows } = await client.query(
    `SELECT mi.*, p.descripcion AS producto_nombre,
            a.nombre AS almacen_nombre, a.numero AS almacen_numero
     FROM movimientos_inventario mi
     JOIN productos p ON mi.producto_id = p.id
     JOIN almacenes a ON mi.almacen_id = a.id
     WHERE ${whereClause}
     ORDER BY mi.created_at ASC`,
    params
  );

  // Calculate running balance
  let saldo = 0;
  const movimientos = rows.map((row) => {
    const cantidadMovimiento = parseFloat(row.cantidad);
    const signed = row.tipo.startsWith('entrada_') ? cantidadMovimiento : -cantidadMovimiento;
    saldo += signed;

    return {
      ...row,
      cantidad_signed: signed,
      saldo,
    };
  });

  // Get product name (even if no movements)
  let productoNombre = rows.length > 0 ? rows[0].producto_nombre : null;
  if (!productoNombre) {
    const { rows: [prod] } = await client.query(
      `SELECT descripcion FROM productos WHERE id = $1`,
      [productoId]
    );
    productoNombre = prod?.descripcion || null;
  }

  return {
    movimientos,
    producto_nombre: productoNombre,
  };
}
