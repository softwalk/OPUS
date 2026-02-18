import { createAuditEntry } from './audit.service.js';
import logger from '../logger.js';

// ============================================================================
// CLIENTES — CRUD
// ============================================================================

/**
 * List all clientes with pagination.
 * @param {import('pg').PoolClient} client
 * @param {{ page?: number, limit?: number, search?: string }} params
 */
export async function listClientes(client, { page = 1, limit = 50, search } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (search) {
    conditions.push(`(c.nombre ILIKE $${idx} OR c.codigo ILIKE $${idx} OR c.telefono ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM clientes c ${whereClause}`,
    params
  );

  const { rows } = await client.query(
    `SELECT c.id, c.codigo, c.nombre, c.rfc, c.direccion, c.telefono, c.email,
            c.limite_credito, c.saldo, c.puntos_acumulados, c.nivel_fidelizacion,
            c.created_at, c.updated_at
     FROM clientes c
     ${whereClause}
     ORDER BY c.nombre
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: rows, total: countRow.total, page, limit };
}

/**
 * Get a single cliente by ID.
 */
export async function getCliente(client, clienteId) {
  const { rows: [cliente] } = await client.query(
    `SELECT * FROM clientes WHERE id = $1`,
    [clienteId]
  );
  if (!cliente) {
    return { error: true, status: 404, code: 'CLIENTE_NOT_FOUND', message: 'Cliente no encontrado' };
  }
  return cliente;
}

/**
 * Create a new cliente.
 */
export async function createCliente(client, { codigo, nombre, rfc, direccion, telefono, email, limite_credito, tenantId }) {
  // Auto-generate codigo if not provided
  if (!codigo) {
    const { rows: [{ count }] } = await client.query(
      `SELECT COUNT(*)::integer AS count FROM clientes`
    );
    codigo = `CLI${String(count + 1).padStart(4, '0')}`;
  }

  const { rows: [created] } = await client.query(
    `INSERT INTO clientes (tenant_id, codigo, nombre, rfc, direccion, telefono, email, limite_credito)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [tenantId, codigo, nombre, rfc || null, direccion || null, telefono || null, email || null, limite_credito || 0]
  );

  logger.info('Cliente created', { tenantId, clienteId: created.id, nombre });
  return created;
}

/**
 * Update a cliente.
 */
export async function updateCliente(client, clienteId, updates) {
  const fields = [];
  const params = [];
  let idx = 1;

  const allowedFields = ['codigo', 'nombre', 'rfc', 'direccion', 'telefono', 'email', 'limite_credito'];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = $${idx}`);
      params.push(updates[field]);
      idx++;
    }
  }

  if (fields.length === 0) {
    return { error: true, status: 400, code: 'NO_FIELDS', message: 'No se proporcionaron campos para actualizar' };
  }

  fields.push(`updated_at = NOW()`);
  params.push(clienteId);

  const { rows: [updated] } = await client.query(
    `UPDATE clientes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );

  if (!updated) {
    return { error: true, status: 404, code: 'CLIENTE_NOT_FOUND', message: 'Cliente no encontrado' };
  }

  return updated;
}

// ============================================================================
// PROVEEDORES — CRUD
// ============================================================================

/**
 * List proveedores with pagination.
 */
export async function listProveedores(client, { page = 1, limit = 50, search } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (search) {
    conditions.push(`(p.nombre ILIKE $${idx} OR p.codigo ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM proveedores p ${whereClause}`,
    params
  );

  const { rows } = await client.query(
    `SELECT p.* FROM proveedores p
     ${whereClause}
     ORDER BY p.nombre
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: rows, total: countRow.total, page, limit };
}

/**
 * Get a single proveedor.
 */
export async function getProveedor(client, proveedorId) {
  const { rows: [prov] } = await client.query(
    `SELECT * FROM proveedores WHERE id = $1`,
    [proveedorId]
  );
  if (!prov) {
    return { error: true, status: 404, code: 'PROVEEDOR_NOT_FOUND', message: 'Proveedor no encontrado' };
  }
  return prov;
}

/**
 * Create a proveedor.
 */
export async function createProveedor(client, { codigo, nombre, rfc, direccion, telefono, email, contacto, tenantId }) {
  if (!codigo) {
    const { rows: [{ count }] } = await client.query(
      `SELECT COUNT(*)::integer AS count FROM proveedores`
    );
    codigo = `PROV${String(count + 1).padStart(4, '0')}`;
  }

  const { rows: [created] } = await client.query(
    `INSERT INTO proveedores (tenant_id, codigo, nombre, rfc, direccion, telefono, email, contacto)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [tenantId, codigo, nombre, rfc || null, direccion || null, telefono || null, email || null, contacto || null]
  );

  logger.info('Proveedor created', { tenantId, proveedorId: created.id, nombre });
  return created;
}

/**
 * Update a proveedor.
 */
export async function updateProveedor(client, proveedorId, updates) {
  const fields = [];
  const params = [];
  let idx = 1;

  const allowedFields = ['codigo', 'nombre', 'rfc', 'direccion', 'telefono', 'email', 'contacto'];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = $${idx}`);
      params.push(updates[field]);
      idx++;
    }
  }

  if (fields.length === 0) {
    return { error: true, status: 400, code: 'NO_FIELDS', message: 'No se proporcionaron campos para actualizar' };
  }

  fields.push(`updated_at = NOW()`);
  params.push(proveedorId);

  const { rows: [updated] } = await client.query(
    `UPDATE proveedores SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );

  if (!updated) {
    return { error: true, status: 404, code: 'PROVEEDOR_NOT_FOUND', message: 'Proveedor no encontrado' };
  }

  return updated;
}

// ============================================================================
// ORDENES DE COMPRA
// ============================================================================

/**
 * List purchase orders with pagination.
 */
export async function listCompras(client, { page = 1, limit = 50, estado } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (estado) {
    conditions.push(`oc.estado = $${idx}`);
    params.push(estado);
    idx++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM ordenes_compra oc ${whereClause}`,
    params
  );

  const { rows } = await client.query(
    `SELECT oc.*, p.nombre AS proveedor_nombre,
            (SELECT COUNT(*)::integer FROM orden_compra_lineas WHERE orden_compra_id = oc.id) AS total_lineas
     FROM ordenes_compra oc
     JOIN proveedores p ON p.id = oc.proveedor_id
     ${whereClause}
     ORDER BY oc.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: rows, total: countRow.total, page, limit };
}

/**
 * Get a single compra (purchase order) with its lines.
 */
export async function getCompra(client, compraId) {
  const { rows: [oc] } = await client.query(
    `SELECT oc.*, p.nombre AS proveedor_nombre
     FROM ordenes_compra oc
     JOIN proveedores p ON p.id = oc.proveedor_id
     WHERE oc.id = $1`,
    [compraId]
  );

  if (!oc) {
    return { error: true, status: 404, code: 'COMPRA_NOT_FOUND', message: 'Orden de compra no encontrada' };
  }

  const { rows: lineas } = await client.query(
    `SELECT ocl.*, pr.descripcion AS producto_nombre, pr.unidad
     FROM orden_compra_lineas ocl
     JOIN productos pr ON pr.id = ocl.producto_id
     WHERE ocl.orden_compra_id = $1
     ORDER BY ocl.created_at`,
    [compraId]
  );

  return { ...oc, lineas };
}

/**
 * Create a purchase order with lines.
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string} params.proveedor_id
 * @param {string} [params.fecha_entrega]
 * @param {string} [params.notas]
 * @param {Array<{ producto_id: string, cantidad: number, precio_unitario: number }>} params.lineas
 * @param {string} params.tenantId
 */
export async function createCompra(client, { proveedor_id, fecha_entrega, notas, lineas, tenantId }) {
  // Generate folio
  const { rows: [{ count }] } = await client.query(
    `SELECT COUNT(*)::integer AS count FROM ordenes_compra`
  );
  const folio = `OC-${String(count + 1).padStart(5, '0')}`;

  // Calculate total
  const total = lineas.reduce((sum, l) => sum + Math.round(l.cantidad * l.precio_unitario), 0);

  // Create OC header
  const { rows: [oc] } = await client.query(
    `INSERT INTO ordenes_compra (tenant_id, folio, proveedor_id, estado, fecha_entrega, notas, total)
     VALUES ($1, $2, $3, 'pendiente', $4, $5, $6)
     RETURNING *`,
    [tenantId, folio, proveedor_id, fecha_entrega || null, notas || null, total]
  );

  // Create lines
  for (const linea of lineas) {
    const subtotal = Math.round(linea.cantidad * linea.precio_unitario);
    await client.query(
      `INSERT INTO orden_compra_lineas (tenant_id, orden_compra_id, producto_id, cantidad, precio_unitario, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, oc.id, linea.producto_id, linea.cantidad, linea.precio_unitario, subtotal]
    );
  }

  logger.info('Orden de compra created', { tenantId, ocId: oc.id, folio, total });
  return { ...oc, lineas };
}

/**
 * Receive a purchase order: create inventory entries + CxP.
 * Only for estado = 'pendiente'.
 */
export async function recibirCompra(client, compraId, { almacen_id, tenantId, usuario, usuarioId, ip }) {
  // 1. Get OC
  const { rows: [oc] } = await client.query(
    `SELECT * FROM ordenes_compra WHERE id = $1`,
    [compraId]
  );

  if (!oc) {
    return { error: true, status: 404, code: 'COMPRA_NOT_FOUND', message: 'Orden de compra no encontrada' };
  }

  if (oc.estado !== 'pendiente') {
    return { error: true, status: 409, code: 'COMPRA_NO_PENDIENTE', message: `La OC ya está en estado '${oc.estado}'` };
  }

  // 2. Get lines
  const { rows: lineas } = await client.query(
    `SELECT * FROM orden_compra_lineas WHERE orden_compra_id = $1`,
    [compraId]
  );

  // 3. Create inventory entries for each line
  for (const linea of lineas) {
    // Upsert existencias
    await client.query(
      `INSERT INTO existencias (tenant_id, producto_id, almacen_id, cantidad, costo_promedio)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, producto_id, almacen_id) DO UPDATE SET
         cantidad = existencias.cantidad + EXCLUDED.cantidad,
         costo_promedio = CASE
           WHEN existencias.cantidad + EXCLUDED.cantidad > 0
           THEN ((existencias.cantidad * existencias.costo_promedio) + (EXCLUDED.cantidad * EXCLUDED.costo_promedio))
                / (existencias.cantidad + EXCLUDED.cantidad)
           ELSE EXCLUDED.costo_promedio
         END,
         updated_at = NOW()`,
      [tenantId, linea.producto_id, almacen_id, linea.cantidad, linea.precio_unitario]
    );

    // Create movimiento_inventario
    await client.query(
      `INSERT INTO movimientos_inventario
         (tenant_id, producto_id, almacen_id, tipo, cantidad, costo_unitario, referencia, usuario_id)
       VALUES ($1, $2, $3, 'entrada_compra', $4, $5, $6, $7)`,
      [tenantId, linea.producto_id, almacen_id, linea.cantidad, linea.precio_unitario, `OC ${oc.folio}`, usuarioId]
    );
  }

  // 4. Update OC status
  await client.query(
    `UPDATE ordenes_compra SET estado = 'recibida', fecha_recepcion = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [compraId]
  );

  // 5. Create CxP (cuenta por pagar)
  await client.query(
    `INSERT INTO cuentas_pagar (tenant_id, proveedor_id, concepto, importe, saldo, fecha)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE))`,
    [
      tenantId,
      oc.proveedor_id,
      `Recepción OC ${oc.folio}`,
      oc.total,
      oc.total,
      oc.fecha_entrega || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    ]
  );

  // 6. Audit
  await createAuditEntry(client, {
    tenantId,
    tabla: 'ordenes_compra',
    registro_id: compraId,
    accion: 'recepcion_oc',
    datos_nuevos: { estado: 'recibida', lineas: lineas.length },
    usuario,
    ip,
  });

  logger.info('OC received', { tenantId, compraId, lineas: lineas.length });

  return { ok: true, message: `OC ${oc.folio} recibida. ${lineas.length} productos ingresados al almacén.` };
}

/**
 * Cancel a purchase order (only if pendiente).
 */
export async function cancelarCompra(client, compraId) {
  const { rows: [oc] } = await client.query(
    `SELECT * FROM ordenes_compra WHERE id = $1`,
    [compraId]
  );

  if (!oc) {
    return { error: true, status: 404, code: 'COMPRA_NOT_FOUND', message: 'Orden de compra no encontrada' };
  }

  if (oc.estado !== 'pendiente') {
    return { error: true, status: 409, code: 'COMPRA_NO_CANCELABLE', message: 'Solo se pueden cancelar OC pendientes' };
  }

  await client.query(
    `UPDATE ordenes_compra SET estado = 'cancelada', updated_at = NOW() WHERE id = $1`,
    [compraId]
  );

  return { ok: true, message: `OC ${oc.folio} cancelada` };
}

// ============================================================================
// CUENTAS POR COBRAR (CxC)
// ============================================================================

/**
 * List CxC with pagination and optional filters.
 */
export async function listCxC(client, { page = 1, limit = 50, estado } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (estado) {
    conditions.push(`cc.estado = $${idx}`);
    params.push(estado);
    idx++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM cuentas_cobrar cc ${whereClause}`,
    params
  );

  const { rows } = await client.query(
    `SELECT cc.*, c.nombre AS cliente_nombre
     FROM cuentas_cobrar cc
     JOIN clientes c ON c.id = cc.cliente_id
     ${whereClause}
     ORDER BY cc.fecha ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: rows, total: countRow.total, page, limit };
}

/**
 * Create CxC manually (also created automatically at cobrar with forma_pago CX).
 */
export async function createCxC(client, { cliente_id, concepto, monto, fecha_vencimiento, referencia, tenantId }) {
  const { rows: [created] } = await client.query(
    `INSERT INTO cuentas_cobrar (tenant_id, cliente_id, concepto, importe, saldo, fecha)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE))
     RETURNING *`,
    [tenantId, cliente_id, concepto, monto, monto, fecha_vencimiento || null]
  );

  // Update client's balance
  await client.query(
    `UPDATE clientes SET saldo = saldo + $1, updated_at = NOW() WHERE id = $2`,
    [monto, cliente_id]
  );

  logger.info('CxC created', { tenantId, cxcId: created.id, monto });
  return created;
}

/**
 * Abonar (partial payment) to CxC.
 * @param {import('pg').PoolClient} client
 * @param {string} cxcId
 * @param {{ monto: number, tenantId: string, usuario: string, ip: string }} params
 */
export async function abonarCxC(client, cxcId, { monto, tenantId, usuario, ip }) {
  const { rows: [cxc] } = await client.query(
    `SELECT cc.*, c.nombre AS cliente_nombre
     FROM cuentas_cobrar cc
     JOIN clientes c ON c.id = cc.cliente_id
     WHERE cc.id = $1`,
    [cxcId]
  );

  if (!cxc) {
    return { error: true, status: 404, code: 'CXC_NOT_FOUND', message: 'Cuenta por cobrar no encontrada' };
  }

  if (cxc.estado === 'pagada') {
    return { error: true, status: 409, code: 'CXC_YA_PAGADA', message: 'Esta cuenta ya fue pagada en su totalidad' };
  }

  if (monto > cxc.saldo) {
    return { error: true, status: 400, code: 'MONTO_EXCEDE_SALDO', message: `El monto ($${(monto / 100).toFixed(2)}) excede el saldo ($${(cxc.saldo / 100).toFixed(2)})` };
  }

  const nuevoSaldo = cxc.saldo - monto;
  const nuevoEstado = nuevoSaldo === 0 ? 'pagada' : 'parcial';

  // Update CxC
  await client.query(
    `UPDATE cuentas_cobrar
     SET saldo = $1, estado = $2, updated_at = NOW()
     WHERE id = $3`,
    [nuevoSaldo, nuevoEstado, cxcId]
  );

  // Update client's balance
  await client.query(
    `UPDATE clientes
     SET saldo = saldo - $1, updated_at = NOW()
     WHERE id = $2`,
    [monto, cxc.cliente_id]
  );

  // Create poliza de ingreso
  await client.query(
    `INSERT INTO polizas (tenant_id, tipo, descripcion, importe, referencia)
     VALUES ($1, 'ingreso', $2, $3, $4)`,
    [tenantId, `Abono CxC - ${cxc.cliente_nombre}`, monto, `CxC-${cxcId}`]
  );

  // Audit
  await createAuditEntry(client, {
    tenantId,
    tabla: 'cuentas_cobrar',
    registro_id: cxcId,
    accion: 'abono_cxc',
    datos_nuevos: { monto_abono: monto, saldo_anterior: cxc.saldo, saldo_nuevo: nuevoSaldo, estado: nuevoEstado },
    usuario,
    ip,
  });

  logger.info('CxC abono', { tenantId, cxcId, monto, nuevoSaldo, nuevoEstado });

  return {
    ok: true,
    abono: monto,
    saldo_anterior: cxc.saldo,
    saldo_nuevo: nuevoSaldo,
    estado: nuevoEstado,
  };
}

// ============================================================================
// CUENTAS POR PAGAR (CxP)
// ============================================================================

/**
 * List CxP with pagination and optional filters.
 */
export async function listCxP(client, { page = 1, limit = 50, estado } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (estado) {
    conditions.push(`cp.estado = $${idx}`);
    params.push(estado);
    idx++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM cuentas_pagar cp ${whereClause}`,
    params
  );

  const { rows } = await client.query(
    `SELECT cp.*, p.nombre AS proveedor_nombre
     FROM cuentas_pagar cp
     JOIN proveedores p ON p.id = cp.proveedor_id
     ${whereClause}
     ORDER BY cp.fecha ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: rows, total: countRow.total, page, limit };
}

/**
 * Abonar (partial payment) to CxP.
 */
export async function abonarCxP(client, cxpId, { monto, tenantId, usuario, ip }) {
  const { rows: [cxp] } = await client.query(
    `SELECT cp.*, p.nombre AS proveedor_nombre
     FROM cuentas_pagar cp
     JOIN proveedores p ON p.id = cp.proveedor_id
     WHERE cp.id = $1`,
    [cxpId]
  );

  if (!cxp) {
    return { error: true, status: 404, code: 'CXP_NOT_FOUND', message: 'Cuenta por pagar no encontrada' };
  }

  if (cxp.estado === 'pagada') {
    return { error: true, status: 409, code: 'CXP_YA_PAGADA', message: 'Esta cuenta ya fue pagada en su totalidad' };
  }

  if (monto > cxp.saldo) {
    return { error: true, status: 400, code: 'MONTO_EXCEDE_SALDO', message: `El monto excede el saldo pendiente` };
  }

  const nuevoSaldo = cxp.saldo - monto;
  const nuevoEstado = nuevoSaldo === 0 ? 'pagada' : 'parcial';

  await client.query(
    `UPDATE cuentas_pagar
     SET saldo = $1, estado = $2, updated_at = NOW()
     WHERE id = $3`,
    [nuevoSaldo, nuevoEstado, cxpId]
  );

  // Create poliza de egreso
  await client.query(
    `INSERT INTO polizas (tenant_id, tipo, descripcion, importe, referencia)
     VALUES ($1, 'egreso', $2, $3, $4)`,
    [tenantId, `Pago CxP - ${cxp.proveedor_nombre}`, monto, `CxP-${cxpId}`]
  );

  // Audit
  await createAuditEntry(client, {
    tenantId,
    tabla: 'cuentas_pagar',
    registro_id: cxpId,
    accion: 'abono_cxp',
    datos_nuevos: { monto_abono: monto, saldo_anterior: cxp.saldo, saldo_nuevo: nuevoSaldo, estado: nuevoEstado },
    usuario,
    ip,
  });

  logger.info('CxP abono', { tenantId, cxpId, monto, nuevoSaldo, nuevoEstado });

  return {
    ok: true,
    abono: monto,
    saldo_anterior: cxp.saldo,
    saldo_nuevo: nuevoSaldo,
    estado: nuevoEstado,
  };
}

// ============================================================================
// FACTURACION
// ============================================================================

/**
 * List facturas with pagination.
 */
export async function listFacturas(client, { page = 1, limit = 50, desde, hasta } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (desde) {
    conditions.push(`f.created_at >= $${idx}::timestamptz`);
    params.push(desde);
    idx++;
  }
  if (hasta) {
    conditions.push(`f.created_at <= $${idx}::timestamptz`);
    params.push(hasta);
    idx++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM facturas f ${whereClause}`,
    params
  );

  const { rows } = await client.query(
    `SELECT f.*, c.nombre AS cliente_nombre
     FROM facturas f
     LEFT JOIN clientes c ON c.id = f.cliente_id
     ${whereClause}
     ORDER BY f.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: rows, total: countRow.total, page, limit };
}

/**
 * Create a factura.
 */
export async function createFactura(client, { cliente_id, cuenta_id, subtotal, iva, total, tenantId }) {
  // Generate folio
  const { rows: [{ count }] } = await client.query(
    `SELECT COUNT(*)::integer AS count FROM facturas`
  );
  const folio = `F-${String(count + 1).padStart(6, '0')}`;

  const { rows: [factura] } = await client.query(
    `INSERT INTO facturas (tenant_id, folio, cliente_id, cuenta_id, subtotal, iva, total)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [tenantId, folio, cliente_id || null, cuenta_id || null, subtotal, iva, total]
  );

  logger.info('Factura created', { tenantId, facturaId: factura.id, folio, total });
  return factura;
}

// ============================================================================
// POLIZAS (Income / Expense entries)
// ============================================================================

/**
 * List polizas with pagination and date range.
 */
export async function listPolizas(client, { page = 1, limit = 50, tipo, desde, hasta } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (tipo) {
    conditions.push(`p.tipo = $${idx}`);
    params.push(tipo);
    idx++;
  }
  if (desde) {
    conditions.push(`p.created_at >= $${idx}::timestamptz`);
    params.push(desde);
    idx++;
  }
  if (hasta) {
    conditions.push(`p.created_at <= $${idx}::timestamptz`);
    params.push(hasta);
    idx++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM polizas p ${whereClause}`,
    params
  );

  const { rows } = await client.query(
    `SELECT p.* FROM polizas p
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  // Get totals summary
  const { rows: [totales] } = await client.query(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN importe ELSE 0 END), 0)::bigint AS total_ingresos,
       COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN importe ELSE 0 END), 0)::bigint AS total_egresos
     FROM polizas p ${whereClause}`,
    params
  );

  return {
    data: rows,
    total: countRow.total,
    page,
    limit,
    resumen: {
      total_ingresos: Number(totales.total_ingresos),
      total_egresos: Number(totales.total_egresos),
      balance: Number(totales.total_ingresos) - Number(totales.total_egresos),
    },
  };
}

/**
 * Create a poliza (manual entry).
 */
export async function createPoliza(client, {
  tipo, cuenta, num_documento, fecha, descripcion, importe, iva, forma_pago, referencia, tenantId,
}) {
  const { rows: [poliza] } = await client.query(
    `INSERT INTO polizas (tenant_id, tipo, cuenta, num_documento, fecha, descripcion, importe, iva, forma_pago, referencia)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [tenantId, tipo, cuenta || null, num_documento || null, fecha || null, descripcion || null, importe, iva || 0, forma_pago || null, referencia || null]
  );

  logger.info('Poliza created', { tenantId, polizaId: poliza.id, tipo, importe });
  return poliza;
}

// ============================================================================
// PERSONAL
// ============================================================================

/**
 * List personal with pagination.
 */
export async function listPersonal(client, { page = 1, limit = 50, puesto } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (puesto) {
    conditions.push(`p.puesto = $${idx}`);
    params.push(puesto);
    idx++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM personal p ${whereClause}`,
    params
  );

  const { rows } = await client.query(
    `SELECT p.id, p.codigo, p.nombre, p.puesto, p.nivel_acceso, p.email, p.telefono,
            p.direccion, p.activo, p.created_at, p.updated_at
     FROM personal p
     ${whereClause}
     ORDER BY p.nombre
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: rows, total: countRow.total, page, limit };
}

/**
 * Get a single personal record.
 */
export async function getPersonal(client, personalId) {
  const { rows: [persona] } = await client.query(
    `SELECT id, codigo, nombre, puesto, nivel_acceso, email, telefono, direccion, activo,
            created_at, updated_at
     FROM personal WHERE id = $1`,
    [personalId]
  );

  if (!persona) {
    return { error: true, status: 404, code: 'PERSONAL_NOT_FOUND', message: 'Personal no encontrado' };
  }

  // Get asistencia summary
  const { rows: [asistencia] } = await client.query(
    `SELECT
       COUNT(*)::integer AS total_registros,
       COUNT(CASE WHEN tipo = 'entrada' THEN 1 END)::integer AS entradas,
       COUNT(CASE WHEN tipo = 'salida' THEN 1 END)::integer AS salidas,
       MAX(created_at) AS ultimo_registro
     FROM asistencia
     WHERE personal_id = $1`,
    [personalId]
  );

  return { ...persona, asistencia };
}

/**
 * Create personal.
 */
export async function createPersonal(client, { codigo, nombre, puesto, nivel_acceso, email, telefono, direccion, tenantId }) {
  // Check for duplicate codigo
  const { rows: [existing] } = await client.query(
    `SELECT id FROM personal WHERE codigo = $1`,
    [codigo]
  );

  if (existing) {
    return { error: true, status: 409, code: 'CODIGO_DUPLICADO', message: `Ya existe personal con código '${codigo}'` };
  }

  const { rows: [created] } = await client.query(
    `INSERT INTO personal (tenant_id, codigo, nombre, puesto, nivel_acceso, email, telefono, direccion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, codigo, nombre, puesto, nivel_acceso, email, telefono, direccion, activo, created_at`,
    [tenantId, codigo, nombre, puesto, nivel_acceso, email || null, telefono || null, direccion || null]
  );

  logger.info('Personal created', { tenantId, personalId: created.id, codigo, puesto });
  return created;
}

/**
 * Update personal.
 */
export async function updatePersonal(client, personalId, updates) {
  const fields = [];
  const params = [];
  let idx = 1;

  const allowedFields = ['nombre', 'puesto', 'nivel_acceso', 'email', 'telefono', 'direccion', 'activo'];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = $${idx}`);
      params.push(updates[field]);
      idx++;
    }
  }

  if (fields.length === 0) {
    return { error: true, status: 400, code: 'NO_FIELDS', message: 'No se proporcionaron campos para actualizar' };
  }

  fields.push(`updated_at = NOW()`);
  params.push(personalId);

  const { rows: [updated] } = await client.query(
    `UPDATE personal SET ${fields.join(', ')} WHERE id = $${idx}
     RETURNING id, codigo, nombre, puesto, nivel_acceso, email, telefono, direccion, activo, updated_at`,
    params
  );

  if (!updated) {
    return { error: true, status: 404, code: 'PERSONAL_NOT_FOUND', message: 'Personal no encontrado' };
  }

  return updated;
}

// ============================================================================
// ASISTENCIA
// ============================================================================

/**
 * Register attendance entry (entrada/salida).
 */
export async function registrarAsistencia(client, { personal_id, tipo, tenantId }) {
  // Verify personal exists
  const { rows: [persona] } = await client.query(
    `SELECT id, nombre, codigo FROM personal WHERE id = $1`,
    [personal_id]
  );

  if (!persona) {
    return { error: true, status: 404, code: 'PERSONAL_NOT_FOUND', message: 'Personal no encontrado' };
  }

  const { rows: [registro] } = await client.query(
    `INSERT INTO asistencia (tenant_id, personal_id, tipo)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [tenantId, personal_id, tipo]
  );

  logger.info('Asistencia registered', { tenantId, personalId: personal_id, tipo });

  return {
    ...registro,
    personal_nombre: persona.nombre,
    personal_codigo: persona.codigo,
  };
}

/**
 * Get attendance history for personal.
 */
export async function getAsistencia(client, { personal_id, desde, hasta, page = 1, limit = 50 }) {
  const conditions = ['a.personal_id = $1'];
  const params = [personal_id];
  let idx = 2;

  if (desde) {
    conditions.push(`a.created_at >= $${idx}::timestamptz`);
    params.push(desde);
    idx++;
  }
  if (hasta) {
    conditions.push(`a.created_at <= $${idx}::timestamptz`);
    params.push(hasta);
    idx++;
  }

  const whereClause = conditions.join(' AND ');
  const offset = (page - 1) * limit;

  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM asistencia a WHERE ${whereClause}`,
    params
  );

  const { rows } = await client.query(
    `SELECT a.*, p.nombre AS personal_nombre, p.codigo AS personal_codigo
     FROM asistencia a
     JOIN personal p ON p.id = a.personal_id
     WHERE ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: rows, total: countRow.total, page, limit };
}

// ============================================================================
// DASHBOARD FINANCIERO
// ============================================================================

/**
 * Get financial dashboard summary.
 */
export async function getDashboardFinanciero(client) {
  // CxC summary
  const { rows: [cxc] } = await client.query(
    `SELECT
       COUNT(*)::integer AS total_cuentas,
       COALESCE(SUM(saldo), 0)::bigint AS saldo_total,
       COUNT(CASE WHEN estado = 'pendiente' THEN 1 END)::integer AS pendientes,
       COUNT(CASE WHEN estado = 'vencida' THEN 1 END)::integer AS vencidas
     FROM cuentas_cobrar
     WHERE estado != 'pagada'`
  );

  // CxP summary
  const { rows: [cxp] } = await client.query(
    `SELECT
       COUNT(*)::integer AS total_cuentas,
       COALESCE(SUM(saldo), 0)::bigint AS saldo_total,
       COUNT(CASE WHEN estado = 'pendiente' THEN 1 END)::integer AS pendientes,
       COUNT(CASE WHEN estado = 'vencida' THEN 1 END)::integer AS vencidas
     FROM cuentas_pagar
     WHERE estado != 'pagada'`
  );

  // Polizas del mes
  const { rows: [polizasMes] } = await client.query(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN importe ELSE 0 END), 0)::bigint AS ingresos_mes,
       COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN importe ELSE 0 END), 0)::bigint AS egresos_mes
     FROM polizas
     WHERE created_at >= date_trunc('month', NOW())`
  );

  // OC pendientes
  const { rows: [ocPendientes] } = await client.query(
    `SELECT COUNT(*)::integer AS total, COALESCE(SUM(total), 0)::bigint AS monto_total
     FROM ordenes_compra WHERE estado = 'pendiente'`
  );

  return {
    cuentas_cobrar: {
      total_cuentas: cxc.total_cuentas,
      saldo_total: Number(cxc.saldo_total),
      pendientes: cxc.pendientes,
      vencidas: cxc.vencidas,
    },
    cuentas_pagar: {
      total_cuentas: cxp.total_cuentas,
      saldo_total: Number(cxp.saldo_total),
      pendientes: cxp.pendientes,
      vencidas: cxp.vencidas,
    },
    polizas_mes: {
      ingresos: Number(polizasMes.ingresos_mes),
      egresos: Number(polizasMes.egresos_mes),
      balance: Number(polizasMes.ingresos_mes) - Number(polizasMes.egresos_mes),
    },
    ordenes_compra_pendientes: {
      total: ocPendientes.total,
      monto_total: Number(ocPendientes.monto_total),
    },
  };
}
