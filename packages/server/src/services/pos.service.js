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
 * Recalculate subtotal, IVA and total for a cuenta based on its active
 * consumos.  All monetary values are INTEGER (centavos).
 *
 * @param {import('pg').PoolClient} client
 * @param {string} cuentaId  - UUID
 * @param {string} tenantId  - UUID
 * @returns {Promise<{subtotal: number, iva: number, total: number}>}
 */
async function recalcularCuenta(client, cuentaId, tenantId) {
  const { rows: [sumRow] } = await client.query(
    `SELECT COALESCE(SUM(importe), 0)::integer AS subtotal
     FROM consumos
     WHERE cuenta_id = $1 AND estado = 'activo'`,
    [cuentaId]
  );

  const subtotal = sumRow.subtotal;
  const ivaPct = await getTenantIva(client, tenantId);
  const iva = Math.round(subtotal * ivaPct / 100);
  const total = subtotal + iva;

  await client.query(
    `UPDATE cuentas SET subtotal = $1, iva = $2, total = $3, updated_at = NOW()
     WHERE id = $4`,
    [subtotal, iva, total, cuentaId]
  );

  return { subtotal, iva, total };
}

// ============================================================================
// 1. listMesas
// ============================================================================

/**
 * List all mesas with zone info, assigned waiter name, and whether they
 * have an active (abierta) bill.
 */
export async function listMesas(client) {
  const { rows } = await client.query(`
    SELECT m.*,
           z.nombre   AS zona_nombre,
           p.nombre   AS mesero_nombre,
           ca.id      AS cuenta_id,
           ca.folio   AS cuenta_folio,
           ca.total   AS total,
           ca.abierta_en AS cuenta_abierta_en,
           (ca.id IS NOT NULL) AS tiene_cuenta
    FROM mesas m
    LEFT JOIN zonas z    ON m.zona_id   = z.id
    LEFT JOIN personal p ON m.mesero_id = p.id
    LEFT JOIN LATERAL (
      SELECT id, folio, total, abierta_en
      FROM cuentas
      WHERE mesa_id = m.id AND estado = 'abierta'
      ORDER BY abierta_en DESC
      LIMIT 1
    ) ca ON true
    ORDER BY m.numero
  `);

  return rows;
}

// ============================================================================
// 2. abrirMesa
// ============================================================================

/**
 * Open a mesa: mark it as occupied, create a new cuenta, and audit.
 *
 * @returns {{ cuenta_id: string, mesa_numero: number, folio: string }}
 */
export async function abrirMesa(client, {
  mesaId,
  personas = 1,
  meseroId = null,
  tenantId,
  usuario,
  usuarioId,
  ip,
}) {
  // --- Validate mesa state ---------------------------------------------------
  const { rows: [mesa] } = await client.query(
    `SELECT id, numero, estado FROM mesas WHERE id = $1`,
    [mesaId]
  );

  if (!mesa) {
    const err = new Error('Mesa no encontrada');
    err.status = 404; err.code = 'MESA_NOT_FOUND';
    throw err;
  }
  if (mesa.estado !== 'libre') {
    const err = new Error(`Mesa ${mesa.numero} no esta libre (estado actual: ${mesa.estado})`);
    err.status = 400; err.code = 'MESA_NOT_LIBRE';
    throw err;
  }

  // --- Transaction -----------------------------------------------------------
  await client.query('BEGIN');
  try {
    // 1. Mark mesa as occupied
    await client.query(
      `UPDATE mesas
       SET estado     = 'ocupada',
           personas   = $1,
           mesero_id  = $2,
           abierta_en = NOW()
       WHERE id = $3`,
      [personas, meseroId, mesaId]
    );

    // 2. Generate folio: YYMMDD-HHMMSS (unique enough per-second per-tenant)
    const folio = `TO_CHAR(NOW(), 'YYMMDD-HH24MISS')`;

    // 3. Insert cuenta
    const { rows: [cuenta] } = await client.query(
      `INSERT INTO cuentas (tenant_id, mesa_id, mesero_id, personas, estado, folio, abierta_en)
       VALUES ($1, $2, $3, $4, 'abierta', ${folio}, NOW())
       RETURNING id, folio`,
      [tenantId, mesaId, meseroId, personas]
    );

    // 4. Audit
    await createAuditEntry(client, {
      tenantId,
      tipo: 'apertura_mesa',
      entidad: 'mesa',
      entidadId: mesaId,
      descripcion: `Mesa ${mesa.numero} abierta con ${personas} personas`,
      datos: { cuenta_id: cuenta.id, mesero_id: meseroId },
      usuario,
      usuarioId,
      ip,
    });

    await client.query('COMMIT');

    logger.info('Mesa abierta', {
      tenantId,
      mesaNumero: mesa.numero,
      cuentaId: cuenta.id,
      folio: cuenta.folio,
    });

    return {
      cuenta_id: cuenta.id,
      cuenta: { id: cuenta.id, folio: cuenta.folio },
      mesa_numero: mesa.numero,
      folio: cuenta.folio,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error abriendo mesa', { mesaId, error: err.message });
    throw err;
  }
}

// ============================================================================
// 3. getCuenta
// ============================================================================

/**
 * Get full cuenta detail including its active consumos.
 */
export async function getCuenta(client, cuentaId) {
  const { rows: [cuenta] } = await client.query(
    `SELECT c.*,
            m.numero  AS mesa_numero,
            p.nombre  AS mesero_nombre,
            cl.nombre AS cliente_nombre
     FROM cuentas c
     LEFT JOIN mesas    m  ON c.mesa_id    = m.id
     LEFT JOIN personal p  ON c.mesero_id  = p.id
     LEFT JOIN clientes cl ON c.cliente_id = cl.id
     WHERE c.id = $1`,
    [cuentaId]
  );

  if (!cuenta) {
    const err = new Error('Cuenta no encontrada');
    err.status = 404; err.code = 'CUENTA_NOT_FOUND';
    throw err;
  }

  const { rows: consumos } = await client.query(
    `SELECT co.*,
            pr.descripcion AS producto_nombre,
            pr.clave       AS producto_clave
     FROM consumos co
     JOIN productos pr ON co.producto_id = pr.id
     WHERE co.cuenta_id = $1 AND co.estado != 'cancelado'
     ORDER BY co.created_at`,
    [cuentaId]
  );

  return { ...cuenta, consumos };
}

// ============================================================================
// 4. listCuentas
// ============================================================================

/**
 * List cuentas with optional filters and pagination.  Defaults to estado='abierta'.
 */
export async function listCuentas(client, { mesa_id, estado, page = 1, limit = 50 } = {}) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (mesa_id) {
    conditions.push(`c.mesa_id = $${paramIdx++}`);
    params.push(mesa_id);
  }

  if (estado) {
    conditions.push(`c.estado = $${paramIdx++}`);
    params.push(estado);
  } else {
    conditions.push(`c.estado = 'abierta'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  // Count total
  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM cuentas c ${whereClause}`,
    params
  );

  // Fetch paginated rows
  const { rows } = await client.query(
    `SELECT c.*,
            m.numero  AS mesa_numero,
            p.nombre  AS mesero_nombre,
            cl.nombre AS cliente_nombre
     FROM cuentas c
     LEFT JOIN mesas    m  ON c.mesa_id    = m.id
     LEFT JOIN personal p  ON c.mesero_id  = p.id
     LEFT JOIN clientes cl ON c.cliente_id = cl.id
     ${whereClause}
     ORDER BY c.abierta_en DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return {
    cuentas: rows,
    total: countRow.total,
    page,
    pages: Math.ceil(countRow.total / limit),
  };
}

// ============================================================================
// 5. addConsumo  (CRITICAL stock-check flow)
// ============================================================================

/**
 * Add a consumo (line item) to a cuenta.
 *
 * Implements the full stock-control pipeline:
 *   - Plato 86 check (hard block)
 *   - BOM stock check for terminado products with bloquear_sin_stock
 *   - Manager override via gerenteClave
 *   - Lost-sales tracking (ventas_perdidas)
 *
 * Price is ALWAYS taken from the product catalog at the time of sale.
 * Amounts are INTEGER (centavos).
 *
 * @returns {{ consumo_id, subtotal, iva, total, warning? } | { error, ... }}
 */
export async function addConsumo(client, {
  cuentaId,
  productoId,
  cantidad = 1,
  notas = null,
  gerenteClave = null,
  tenantId,
  usuario,
  usuarioId,
  ip,
}) {
  // --- 1. Look up product ----------------------------------------------------
  const { rows: [prod] } = await client.query(
    `SELECT * FROM productos WHERE id = $1 AND activo = true`,
    [productoId]
  );

  if (!prod) {
    const err = new Error('Producto no encontrado o inactivo');
    err.status = 404; err.code = 'PRODUCT_NOT_FOUND';
    throw err;
  }

  // --- 2. Plato 86 hard block ------------------------------------------------
  if (prod.suspendido_86) {
    await client.query(
      `INSERT INTO ventas_perdidas (tenant_id, producto_id, cantidad, motivo, precio_perdido)
       VALUES ($1, $2, $3, 'suspendido_86', $4)`,
      [tenantId, productoId, cantidad, prod.precio_venta * cantidad]
    );

    const err86 = new Error(`${prod.descripcion} esta marcado como 86 (${prod.suspendido_86_motivo || 'Agotado'})`);
    err86.status = 409; err86.code = 'STOCK_86';
    err86.details = { bloqueado: true, motivo: '86' };
    throw err86;
  }

  // --- 3. BOM stock check for terminado + bloquear_sin_stock -----------------
  let warning = null;

  if (prod.tipo === 'terminado') {
    const { rows: receta } = await client.query(
      `SELECT insumo_id, cantidad FROM recetas WHERE producto_id = $1`,
      [productoId]
    );

    if (receta.length > 0) {
      const faltantes = [];

      for (const ing of receta) {
        const { rows: [stockRow] } = await client.query(
          `SELECT COALESCE(SUM(cantidad), 0) AS stock FROM existencias WHERE producto_id = $1`,
          [ing.insumo_id]
        );

        const requerido = parseFloat(ing.cantidad) * cantidad;
        const disponible = parseFloat(stockRow.stock);

        if (disponible < requerido) {
          // Get ingredient name for error reporting
          const { rows: [insumo] } = await client.query(
            `SELECT clave, descripcion FROM productos WHERE id = $1`,
            [ing.insumo_id]
          );

          faltantes.push({
            insumo_id: ing.insumo_id,
            clave: insumo?.clave,
            descripcion: insumo?.descripcion,
            requerido,
            disponible,
            faltante: requerido - disponible,
          });
        }
      }

      if (faltantes.length > 0) {
        // --- 3a. Manager override attempt ------------------------------------
        if (gerenteClave) {
          const { rows: [gerente] } = await client.query(
            `SELECT id, nombre FROM personal
             WHERE codigo = $1 AND activo = true AND nivel_acceso >= 5`,
            [gerenteClave]
          );

          if (gerente) {
            // Valid manager: authorize the override
            await client.query(
              `INSERT INTO sobregiros_autorizados
                 (tenant_id, producto_id, cuenta_id, cantidad, autorizado_por, gerente_id, motivo)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                tenantId,
                productoId,
                cuentaId,
                cantidad,
                gerente.nombre,
                gerente.id,
                `Stock insuficiente: ${faltantes.map(f => f.clave).join(', ')}`,
              ]
            );

            logger.warn('Sobregiro autorizado', {
              tenantId,
              productoId,
              gerenteId: gerente.id,
              faltantes,
            });
            // ALLOW the sale to proceed (fall through)
            warning = {
              tipo: 'sobregiro_autorizado',
              autorizado_por: gerente.nombre,
              faltantes,
            };
          } else {
            // Invalid manager code
            const errClave = new Error('Clave de gerente invalida o nivel de acceso insuficiente');
            errClave.status = 403; errClave.code = 'CLAVE_INVALIDA';
            throw errClave;
          }
        } else if (prod.bloquear_sin_stock) {
          // --- 3b. Hard block: no manager code, bloquear_sin_stock = true ----
          await client.query(
            `INSERT INTO ventas_perdidas (tenant_id, producto_id, cantidad, motivo, precio_perdido)
             VALUES ($1, $2, $3, 'sin_stock', $4)`,
            [tenantId, productoId, cantidad, prod.precio_venta * cantidad]
          );

          const errStock = new Error(`Stock insuficiente para ${prod.descripcion}`);
          errStock.status = 409; errStock.code = 'STOCK_INSUFFICIENT';
          errStock.details = { requiere_autorizacion: true, faltantes };
          throw errStock;
        } else {
          // --- 3c. Soft warning: bloquear_sin_stock = false -------------------
          warning = {
            tipo: 'stock_bajo',
            message: `Advertencia: stock bajo para ingredientes de ${prod.descripcion}`,
            faltantes,
          };
        }
      }
    }
  }

  // --- 4-6. Insert the consumo -----------------------------------------------
  const precioUnitario = prod.precio_venta;
  // Integer math for centavos: cantidad can be decimal (e.g. 0.5 liters)
  const importe = Math.round(cantidad * precioUnitario);

  const { rows: [consumo] } = await client.query(
    `INSERT INTO consumos (tenant_id, cuenta_id, producto_id, cantidad, precio_unitario, importe, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [tenantId, cuentaId, productoId, cantidad, precioUnitario, importe, notas]
  );

  // --- 7. Recalculate cuenta totals ------------------------------------------
  const totales = await recalcularCuenta(client, cuentaId, tenantId);

  // --- 7b. Insert into cocina_queue (KDS) ------------------------------------
  try {
    const { rows: [cuentaInfo] } = await client.query(
      `SELECT m.numero AS mesa_numero FROM cuentas c
       LEFT JOIN mesas m ON c.mesa_id = m.id
       WHERE c.id = $1`,
      [cuentaId]
    );
    const mesaNum = cuentaInfo?.mesa_numero || null;

    await client.query(
      `INSERT INTO cocina_queue
         (tenant_id, tipo_origen, cuenta_id, mesa_numero, items_json, estado, mesero_nombre)
       VALUES ($1, 'pos', $2, $3, $4, 'pendiente', $5)`,
      [
        tenantId,
        cuentaId,
        mesaNum,
        JSON.stringify([{
          consumo_id: consumo.id,
          producto: prod.descripcion,
          clave: prod.clave,
          cantidad,
          notas: notas || null,
        }]),
        usuario || null,
      ]
    );
    logger.info('KDS queue item created for consumo', { tenantId, cuentaId, mesaNum, productoId });
  } catch (kdsErr) {
    // Non-critical: don't fail the sale if KDS insertion fails
    logger.warn('Failed to insert KDS queue item', { error: kdsErr.message, tenantId, cuentaId });
  }

  logger.info('Consumo agregado', {
    tenantId,
    consumoId: consumo.id,
    cuentaId,
    productoId,
    cantidad,
    importe,
  });

  // --- 8. Return result ------------------------------------------------------
  const result = {
    consumo_id: consumo.id,
    subtotal: totales.subtotal,
    iva: totales.iva,
    total: totales.total,
  };

  if (warning) {
    result.warning = warning;
  }

  return result;
}

// ============================================================================
// 6. cancelConsumo
// ============================================================================

/**
 * Cancel a single consumo line item and recalculate the cuenta.
 */
export async function cancelConsumo(client, {
  consumoId,
  motivo = null,
  tenantId,
  usuario,
  usuarioId,
  ip,
}) {
  // Look up consumo
  const { rows: [consumo] } = await client.query(
    `SELECT id, cuenta_id, producto_id, cantidad, importe, estado
     FROM consumos WHERE id = $1`,
    [consumoId]
  );

  if (!consumo) {
    const err = new Error('Consumo no encontrado');
    err.status = 404; err.code = 'CONSUMO_NOT_FOUND';
    throw err;
  }

  if (consumo.estado === 'cancelado') {
    const err = new Error('Consumo ya esta cancelado');
    err.status = 400; err.code = 'ALREADY_CANCELLED';
    throw err;
  }

  await client.query(
    `UPDATE consumos
     SET estado = 'cancelado', cancelado_por = $1, motivo_cancelacion = $2
     WHERE id = $3`,
    [usuario, motivo, consumoId]
  );

  // Recalculate
  const totales = await recalcularCuenta(client, consumo.cuenta_id, tenantId);

  // Audit
  await createAuditEntry(client, {
    tenantId,
    tipo: 'cancelacion_consumo',
    entidad: 'consumo',
    entidadId: consumoId,
    descripcion: `Consumo cancelado en cuenta ${consumo.cuenta_id}`,
    datos: {
      producto_id: consumo.producto_id,
      cantidad: consumo.cantidad,
      importe: consumo.importe,
      motivo,
    },
    usuario,
    usuarioId,
    ip,
  });

  logger.info('Consumo cancelado', { tenantId, consumoId, cuentaId: consumo.cuenta_id });

  return {
    ok: true,
    cuenta_id: consumo.cuenta_id,
    subtotal: totales.subtotal,
    iva: totales.iva,
    total: totales.total,
  };
}

// ============================================================================
// 7. cobrar  (CRITICAL: inventory deduction happens HERE, never at consumo)
// ============================================================================

/**
 * Settle (charge) a cuenta.
 *
 * BOM EXPLOSION: inventory deduction happens at payment time (COBOL rule).
 * For each active consumo, the recipe is exploded and insumo quantities
 * are subtracted from the first almacen.
 *
 * @returns {{ ok, folio, total, forma_pago } | { error, ... }}
 */
export async function cobrar(client, {
  cuentaId,
  formaPagoId = null,
  propina = 0,
  clienteId = null,
  tenantId,
  usuario,
  usuarioId,
  ip,
}) {
  // --- 1. Validate cuenta state ----------------------------------------------
  const { rows: [cuenta] } = await client.query(
    `SELECT c.*, m.numero AS mesa_numero, fp.nombre AS forma_pago_nombre
     FROM cuentas c
     LEFT JOIN mesas m ON c.mesa_id = m.id
     LEFT JOIN formas_pago fp ON fp.id = $2
     WHERE c.id = $1`,
    [cuentaId, formaPagoId]
  );

  if (!cuenta) {
    const err = new Error('Cuenta no encontrada');
    err.status = 404; err.code = 'CUENTA_NOT_FOUND';
    throw err;
  }

  if (cuenta.estado !== 'abierta' && cuenta.estado !== 'precuenta') {
    const err = new Error(`Cuenta no se puede cobrar (estado: ${cuenta.estado})`);
    err.status = 400; err.code = 'CUENTA_NOT_COBRABLE';
    throw err;
  }

  // --- 2. Begin transaction --------------------------------------------------
  await client.query('BEGIN');
  try {
    // --- 3. Update cuenta as cobrada -----------------------------------------
    await client.query(
      `UPDATE cuentas
       SET estado       = 'cobrada',
           forma_pago_id = $1,
           propina      = $2,
           cliente_id   = $3,
           cerrada_en   = NOW(),
           updated_at   = NOW()
       WHERE id = $4`,
      [formaPagoId, propina, clienteId, cuentaId]
    );

    // --- 4. Release the mesa -------------------------------------------------
    if (cuenta.mesa_id) {
      await client.query(
        `UPDATE mesas
         SET estado     = 'libre',
             personas   = 0,
             mesero_id  = NULL,
             abierta_en = NULL
         WHERE id = $1`,
        [cuenta.mesa_id]
      );
    }

    // --- 5. BOM EXPLOSION: deduct inventory ----------------------------------
    const { rows: consumos } = await client.query(
      `SELECT id, producto_id, cantidad
       FROM consumos
       WHERE cuenta_id = $1 AND estado = 'activo'`,
      [cuentaId]
    );

    // Resolve the default almacen once (first by numero)
    const { rows: [almacen] } = await client.query(
      `SELECT id FROM almacenes WHERE tenant_id = $1 ORDER BY numero LIMIT 1`,
      [tenantId]
    );

    const almacenId = almacen?.id;

    if (almacenId) {
      for (const consumo of consumos) {
        const { rows: receta } = await client.query(
          `SELECT insumo_id, cantidad AS cant_receta FROM recetas WHERE producto_id = $1`,
          [consumo.producto_id]
        );

        for (const ing of receta) {
          const cantDescontar = parseFloat(ing.cant_receta) * parseFloat(consumo.cantidad);

          // Deduct from existencias
          await client.query(
            `UPDATE existencias
             SET cantidad   = cantidad - $1,
                 updated_at = NOW()
             WHERE producto_id = $2 AND almacen_id = $3`,
            [cantDescontar, ing.insumo_id, almacenId]
          );

          // Log inventory movement
          await client.query(
            `INSERT INTO movimientos_inventario
               (tenant_id, producto_id, almacen_id, tipo, cantidad, referencia, usuario)
             VALUES ($1, $2, $3, 'salida_venta', $4, $5, $6)`,
            [
              tenantId,
              ing.insumo_id,
              almacenId,
              cantDescontar,
              `Cuenta #${cuenta.folio}`,
              usuario,
            ]
          );
        }
      }
    } else {
      logger.warn('No almacen found for BOM explosion, inventory not deducted', { tenantId, cuentaId });
    }

    // --- 6. Audit entry ------------------------------------------------------
    await createAuditEntry(client, {
      tenantId,
      tipo: 'cobro',
      entidad: 'cuenta',
      entidadId: cuentaId,
      descripcion: `Cuenta #${cuenta.folio} cobrada — Total: $${(cuenta.total / 100).toFixed(2)}`,
      datos: {
        folio: cuenta.folio,
        subtotal: cuenta.subtotal,
        iva: cuenta.iva,
        total: cuenta.total,
        propina,
        forma_pago_id: formaPagoId,
        cliente_id: clienteId,
        mesa_numero: cuenta.mesa_numero,
        num_consumos: consumos.length,
      },
      usuario,
      usuarioId,
      ip,
    });

    await client.query('COMMIT');

    logger.info('Cuenta cobrada', {
      tenantId,
      cuentaId,
      folio: cuenta.folio,
      total: cuenta.total,
    });

    // --- 7. Return -----------------------------------------------------------
    return {
      ok: true,
      folio: cuenta.folio,
      total: cuenta.total,
      propina,
      forma_pago: cuenta.forma_pago_nombre || null,
      mesa_id: cuenta.mesa_id,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error cobrando cuenta', { cuentaId, error: err.message });
    throw err;
  }
}

// ============================================================================
// 8. recalcularCuenta  (re-exported for external use)
// ============================================================================

export { recalcularCuenta };

// ============================================================================
// 9. precuenta
// ============================================================================

/**
 * Transition a cuenta to precuenta state (print preview / pre-check).
 */
export async function precuenta(client, cuentaId) {
  const { rows: [cuenta] } = await client.query(
    `SELECT id, estado FROM cuentas WHERE id = $1`,
    [cuentaId]
  );

  if (!cuenta) {
    const err = new Error('Cuenta no encontrada');
    err.status = 404; err.code = 'CUENTA_NOT_FOUND';
    throw err;
  }

  if (cuenta.estado !== 'abierta') {
    const err = new Error(`Solo se puede pedir precuenta de una cuenta abierta (estado: ${cuenta.estado})`);
    err.status = 400; err.code = 'CUENTA_NOT_ABIERTA';
    throw err;
  }

  await client.query(
    `UPDATE cuentas SET estado = 'precuenta', updated_at = NOW() WHERE id = $1`,
    [cuentaId]
  );

  return { ok: true, cuenta_id: cuentaId, estado: 'precuenta' };
}

// ============================================================================
// 10. corteCaja
// ============================================================================

/**
 * Generate a cash register cut (corte de caja) for a given shift.
 *
 * Aggregates all cobrada cuentas for the shift/date and creates a
 * cortes_caja record with totals broken down by payment method.
 */
export async function corteCaja(client, {
  turnoId = null,
  cajeroId,
  tenantId,
  usuario,
  usuarioId,
  ip,
}) {
  await client.query('BEGIN');
  try {
    // --- Aggregate totals from today's cobrada cuentas -----------------------
    // Build optional turno filter
    const turnoFilter = turnoId ? `AND c.turno = $2` : '';
    const turnoParams = turnoId ? [tenantId, turnoId] : [tenantId];

    // Total sales for today
    const { rows: [ventas] } = await client.query(
      `SELECT
         COUNT(*)::integer                       AS num_cuentas,
         COALESCE(SUM(c.total), 0)::integer      AS total_ventas,
         COALESCE(SUM(c.propina), 0)::integer    AS total_propinas
       FROM cuentas c
       WHERE c.tenant_id = $1
         AND c.estado = 'cobrada'
         AND c.cerrada_en::date = CURRENT_DATE
         ${turnoFilter}`,
      turnoParams
    );

    // Breakdown by payment type: efectivo vs tarjeta vs otros
    // We assume formas_pago with clave 'efectivo' is cash, 'tarjeta' is card
    const { rows: desglose } = await client.query(
      `SELECT
         fp.clave,
         COALESCE(SUM(c.total), 0)::integer AS monto
       FROM cuentas c
       LEFT JOIN formas_pago fp ON c.forma_pago_id = fp.id
       WHERE c.tenant_id = $1
         AND c.estado = 'cobrada'
         AND c.cerrada_en::date = CURRENT_DATE
         ${turnoFilter}
       GROUP BY fp.clave`,
      turnoParams
    );

    const efectivoSistema = desglose.find(d => d.clave === 'efectivo')?.monto || 0;
    const tarjeta = desglose.find(d => d.clave === 'tarjeta')?.monto || 0;
    const otros = (ventas.total_ventas || 0) - efectivoSistema - tarjeta;

    // --- Insert corte --------------------------------------------------------
    const { rows: [corte] } = await client.query(
      `INSERT INTO cortes_caja
         (tenant_id, cajero_id, turno, fecha,
          efectivo_sistema, efectivo_real, diferencia,
          tarjeta, otros, total_ventas, num_cuentas)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, $4, 0, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenantId,
        cajeroId,
        turnoId,
        efectivoSistema,
        tarjeta,
        otros < 0 ? 0 : otros,
        ventas.total_ventas || 0,
        ventas.num_cuentas || 0,
      ]
    );

    // --- Audit ---------------------------------------------------------------
    await createAuditEntry(client, {
      tenantId,
      tipo: 'corte_caja',
      entidad: 'corte',
      entidadId: corte.id,
      descripcion: `Corte de caja — ${ventas.num_cuentas} cuentas, Total: $${((ventas.total_ventas || 0) / 100).toFixed(2)}`,
      datos: {
        num_cuentas: ventas.num_cuentas,
        total_ventas: ventas.total_ventas,
        efectivo: efectivoSistema,
        tarjeta,
        otros,
        cajero_id: cajeroId,
      },
      usuario,
      usuarioId,
      ip,
    });

    await client.query('COMMIT');

    logger.info('Corte de caja generado', {
      tenantId,
      corteId: corte.id,
      totalVentas: ventas.total_ventas,
      numCuentas: ventas.num_cuentas,
    });

    return corte;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error generando corte de caja', { tenantId, error: err.message });
    throw err;
  }
}
