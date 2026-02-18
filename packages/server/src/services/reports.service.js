import logger from '../logger.js';

// ============================================================================
// HELPERS
// ============================================================================

/** Convert integer centavos to decimal pesos. */
function fromCents(c) { return c / 100; }

// ============================================================================
// 1. VENTAS DEL DIA
// ============================================================================

/**
 * Get daily sales summary (grouped by cuenta).
 * @param {import('pg').PoolClient} client
 * @param {{ fecha?: string }} params - fecha as YYYY-MM-DD (defaults to today)
 */
export async function ventasDia(client, { fecha } = {}) {
  const targetDate = fecha || new Date().toISOString().split('T')[0];

  // Summary
  const { rows: [resumen] } = await client.query(
    `SELECT
       COUNT(*)::integer AS total_cuentas,
       COALESCE(SUM(total), 0)::bigint AS venta_total,
       COALESCE(SUM(subtotal), 0)::bigint AS subtotal_total,
       COALESCE(SUM(iva), 0)::bigint AS iva_total,
       COALESCE(SUM(propina), 0)::bigint AS propina_total,
       COALESCE(AVG(total), 0)::integer AS ticket_promedio
     FROM cuentas
     WHERE estado = 'cobrada'
       AND cerrada_en::date = $1::date`,
    [targetDate]
  );

  // By forma de pago
  const { rows: porFormaPago } = await client.query(
    `SELECT fp.nombre AS forma_pago,
            COUNT(c.id)::integer AS num_cuentas,
            COALESCE(SUM(c.total), 0)::bigint AS monto
     FROM cuentas c
     JOIN formas_pago fp ON fp.id = c.forma_pago_id
     WHERE c.estado = 'cobrada'
       AND c.cerrada_en::date = $1::date
     GROUP BY fp.nombre
     ORDER BY monto DESC`,
    [targetDate]
  );

  // By mesero
  const { rows: porMesero } = await client.query(
    `SELECT p.nombre AS mesero,
            COUNT(c.id)::integer AS num_cuentas,
            COALESCE(SUM(c.total), 0)::bigint AS venta,
            COALESCE(SUM(c.propina), 0)::bigint AS propinas
     FROM cuentas c
     JOIN personal p ON p.id = c.mesero_id
     WHERE c.estado = 'cobrada'
       AND c.cerrada_en::date = $1::date
     GROUP BY p.nombre
     ORDER BY venta DESC`,
    [targetDate]
  );

  // Top 10 products sold
  const { rows: topProductos } = await client.query(
    `SELECT pr.descripcion,
            SUM(co.cantidad)::numeric AS cantidad_vendida,
            SUM(co.importe)::bigint AS importe_total
     FROM consumos co
     JOIN cuentas cu ON cu.id = co.cuenta_id
     JOIN productos pr ON pr.id = co.producto_id
     WHERE cu.estado = 'cobrada'
       AND cu.cerrada_en::date = $1::date
       AND co.estado = 'activo'
     GROUP BY pr.descripcion
     ORDER BY cantidad_vendida DESC
     LIMIT 10`,
    [targetDate]
  );

  return {
    fecha: targetDate,
    resumen: {
      total_cuentas: resumen.total_cuentas,
      venta_total: Number(resumen.venta_total),
      subtotal_total: Number(resumen.subtotal_total),
      iva_total: Number(resumen.iva_total),
      propina_total: Number(resumen.propina_total),
      ticket_promedio: resumen.ticket_promedio,
    },
    por_forma_pago: porFormaPago.map(r => ({ ...r, monto: Number(r.monto) })),
    por_mesero: porMesero.map(r => ({ ...r, venta: Number(r.venta), propinas: Number(r.propinas) })),
    top_productos: topProductos.map(r => ({ ...r, cantidad_vendida: Number(r.cantidad_vendida), importe_total: Number(r.importe_total) })),
  };
}

// ============================================================================
// 2. VENTAS POR PERIODO
// ============================================================================

/**
 * Get sales summary for a date range, grouped by day.
 */
export async function ventasPeriodo(client, { desde, hasta }) {
  if (!desde || !hasta) {
    return { error: true, status: 400, code: 'FECHAS_REQUERIDAS', message: 'Se requieren desde y hasta' };
  }

  const { rows: porDia } = await client.query(
    `SELECT
       cerrada_en::date AS fecha,
       COUNT(*)::integer AS total_cuentas,
       COALESCE(SUM(total), 0)::bigint AS venta_total,
       COALESCE(SUM(propina), 0)::bigint AS propina_total,
       COALESCE(AVG(total), 0)::integer AS ticket_promedio
     FROM cuentas
     WHERE estado = 'cobrada'
       AND cerrada_en::date BETWEEN $1::date AND $2::date
     GROUP BY cerrada_en::date
     ORDER BY fecha`,
    [desde, hasta]
  );

  // Totals for the entire period
  const { rows: [totales] } = await client.query(
    `SELECT
       COUNT(*)::integer AS total_cuentas,
       COALESCE(SUM(total), 0)::bigint AS venta_total,
       COALESCE(SUM(subtotal), 0)::bigint AS subtotal_total,
       COALESCE(SUM(iva), 0)::bigint AS iva_total,
       COALESCE(SUM(propina), 0)::bigint AS propina_total,
       COALESCE(AVG(total), 0)::integer AS ticket_promedio
     FROM cuentas
     WHERE estado = 'cobrada'
       AND cerrada_en::date BETWEEN $1::date AND $2::date`,
    [desde, hasta]
  );

  return {
    desde,
    hasta,
    totales: {
      total_cuentas: totales.total_cuentas,
      venta_total: Number(totales.venta_total),
      subtotal_total: Number(totales.subtotal_total),
      iva_total: Number(totales.iva_total),
      propina_total: Number(totales.propina_total),
      ticket_promedio: totales.ticket_promedio,
    },
    por_dia: porDia.map(r => ({
      ...r,
      venta_total: Number(r.venta_total),
      propina_total: Number(r.propina_total),
    })),
  };
}

// ============================================================================
// 3. VENTAS POR MESERO
// ============================================================================

/**
 * Sales summary by mesero for a date range.
 */
export async function ventasMesero(client, { desde, hasta }) {
  if (!desde || !hasta) {
    return { error: true, status: 400, code: 'FECHAS_REQUERIDAS', message: 'Se requieren desde y hasta' };
  }

  const { rows } = await client.query(
    `SELECT
       p.id AS mesero_id,
       p.nombre AS mesero,
       p.codigo,
       COUNT(c.id)::integer AS total_cuentas,
       COALESCE(SUM(c.total), 0)::bigint AS venta_total,
       COALESCE(SUM(c.propina), 0)::bigint AS propina_total,
       COALESCE(AVG(c.total), 0)::integer AS ticket_promedio,
       COUNT(DISTINCT c.cerrada_en::date)::integer AS dias_trabajados
     FROM cuentas c
     JOIN personal p ON p.id = c.mesero_id
     WHERE c.estado = 'cobrada'
       AND c.cerrada_en::date BETWEEN $1::date AND $2::date
     GROUP BY p.id, p.nombre, p.codigo
     ORDER BY venta_total DESC`,
    [desde, hasta]
  );

  return {
    desde,
    hasta,
    meseros: rows.map(r => ({
      ...r,
      venta_total: Number(r.venta_total),
      propina_total: Number(r.propina_total),
    })),
  };
}

// ============================================================================
// 4. VENTAS POR PRODUCTO
// ============================================================================

/**
 * Sales analysis by product for a date range.
 */
export async function ventasProducto(client, { desde, hasta }) {
  if (!desde || !hasta) {
    return { error: true, status: 400, code: 'FECHAS_REQUERIDAS', message: 'Se requieren desde y hasta' };
  }

  const { rows } = await client.query(
    `SELECT
       pr.id AS producto_id,
       pr.clave,
       pr.descripcion,
       g.nombre AS grupo,
       SUM(co.cantidad)::numeric AS cantidad_vendida,
       COALESCE(SUM(co.importe), 0)::bigint AS ingreso_total,
       COUNT(DISTINCT cu.id)::integer AS en_cuentas,
       pr.precio_venta AS precio_actual,
       pr.costo_unitario AS costo_actual
     FROM consumos co
     JOIN cuentas cu ON cu.id = co.cuenta_id
     JOIN productos pr ON pr.id = co.producto_id
     LEFT JOIN grupos g ON g.id = pr.grupo_id
     WHERE cu.estado = 'cobrada'
       AND cu.cerrada_en::date BETWEEN $1::date AND $2::date
       AND co.estado = 'activo'
     GROUP BY pr.id, pr.clave, pr.descripcion, g.nombre, pr.precio_venta, pr.costo_unitario
     ORDER BY ingreso_total DESC`,
    [desde, hasta]
  );

  return {
    desde,
    hasta,
    productos: rows.map(r => ({
      ...r,
      cantidad_vendida: Number(r.cantidad_vendida),
      ingreso_total: Number(r.ingreso_total),
    })),
  };
}

// ============================================================================
// 5. VENTAS POR HORA
// ============================================================================

/**
 * Sales by hour of day for a date range (helps with staffing decisions).
 */
export async function ventasHora(client, { desde, hasta }) {
  if (!desde || !hasta) {
    return { error: true, status: 400, code: 'FECHAS_REQUERIDAS', message: 'Se requieren desde y hasta' };
  }

  const { rows } = await client.query(
    `SELECT
       EXTRACT(HOUR FROM cerrada_en) AS hora,
       COUNT(*)::integer AS total_cuentas,
       COALESCE(SUM(total), 0)::bigint AS venta_total,
       COALESCE(AVG(total), 0)::integer AS ticket_promedio
     FROM cuentas
     WHERE estado = 'cobrada'
       AND cerrada_en::date BETWEEN $1::date AND $2::date
     GROUP BY EXTRACT(HOUR FROM cerrada_en)
     ORDER BY hora`,
    [desde, hasta]
  );

  return {
    desde,
    hasta,
    por_hora: rows.map(r => ({
      hora: Number(r.hora),
      total_cuentas: r.total_cuentas,
      venta_total: Number(r.venta_total),
      ticket_promedio: r.ticket_promedio,
    })),
  };
}

// ============================================================================
// 6. COMPARATIVO DE PERIODOS
// ============================================================================

/**
 * Compare two date ranges across all key metrics.
 */
export async function comparativo(client, { periodo1_desde, periodo1_hasta, periodo2_desde, periodo2_hasta }) {
  if (!periodo1_desde || !periodo1_hasta || !periodo2_desde || !periodo2_hasta) {
    return { error: true, status: 400, code: 'PERIODOS_REQUERIDOS', message: 'Se requieren ambos periodos completos' };
  }

  async function getPeriodoData(desde, hasta) {
    const { rows: [data] } = await client.query(
      `SELECT
         COUNT(*)::integer AS total_cuentas,
         COALESCE(SUM(total), 0)::bigint AS venta_total,
         COALESCE(SUM(subtotal), 0)::bigint AS subtotal,
         COALESCE(SUM(iva), 0)::bigint AS iva,
         COALESCE(SUM(propina), 0)::bigint AS propinas,
         COALESCE(AVG(total), 0)::integer AS ticket_promedio,
         COUNT(DISTINCT cerrada_en::date)::integer AS dias_con_venta
       FROM cuentas
       WHERE estado = 'cobrada'
         AND cerrada_en::date BETWEEN $1::date AND $2::date`,
      [desde, hasta]
    );
    return {
      total_cuentas: data.total_cuentas,
      venta_total: Number(data.venta_total),
      subtotal: Number(data.subtotal),
      iva: Number(data.iva),
      propinas: Number(data.propinas),
      ticket_promedio: data.ticket_promedio,
      dias_con_venta: data.dias_con_venta,
    };
  }

  const p1 = await getPeriodoData(periodo1_desde, periodo1_hasta);
  const p2 = await getPeriodoData(periodo2_desde, periodo2_hasta);

  // Calculate variations
  const variacion = (actual, anterior) => {
    if (anterior === 0) return actual > 0 ? 100 : 0;
    return Math.round(((actual - anterior) / anterior) * 10000) / 100; // two decimal places
  };

  return {
    periodo_1: { desde: periodo1_desde, hasta: periodo1_hasta, ...p1 },
    periodo_2: { desde: periodo2_desde, hasta: periodo2_hasta, ...p2 },
    variaciones: {
      venta_total_pct: variacion(p1.venta_total, p2.venta_total),
      total_cuentas_pct: variacion(p1.total_cuentas, p2.total_cuentas),
      ticket_promedio_pct: variacion(p1.ticket_promedio, p2.ticket_promedio),
    },
  };
}

// ============================================================================
// 7. DASHBOARD RESUMEN
// ============================================================================

/**
 * General dashboard with KPIs.
 */
export async function dashboardResumen(client) {
  const hoy = new Date().toISOString().split('T')[0];

  // Ventas hoy
  const { rows: [ventasHoy] } = await client.query(
    `SELECT
       COUNT(*)::integer AS cuentas,
       COALESCE(SUM(total), 0)::bigint AS venta
     FROM cuentas
     WHERE estado = 'cobrada' AND cerrada_en::date = $1::date`,
    [hoy]
  );

  // Ventas mes actual
  const { rows: [ventasMes] } = await client.query(
    `SELECT
       COUNT(*)::integer AS cuentas,
       COALESCE(SUM(total), 0)::bigint AS venta
     FROM cuentas
     WHERE estado = 'cobrada'
       AND cerrada_en >= date_trunc('month', NOW())`
  );

  // Cuentas abiertas
  const { rows: [abiertas] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM cuentas WHERE estado = 'abierta'`
  );

  // Mesas ocupadas
  const { rows: [mesasOcupadas] } = await client.query(
    `SELECT
       COUNT(CASE WHEN estado = 'ocupada' THEN 1 END)::integer AS ocupadas,
       COUNT(*)::integer AS total
     FROM mesas`
  );

  // KDS pendientes
  const { rows: [kdsPendientes] } = await client.query(
    `SELECT COUNT(*)::integer AS total
     FROM cocina_queue
     WHERE estado IN ('pendiente', 'en_preparacion')`
  );

  // Alertas de stock
  const { rows: [alertasStock] } = await client.query(
    `SELECT COUNT(*)::integer AS total
     FROM productos
     WHERE suspendido_86 = true`
  );

  // Ordenes digitales pendientes
  const { rows: [ordenesPendientes] } = await client.query(
    `SELECT COUNT(*)::integer AS total
     FROM ordenes_digitales
     WHERE estado IN ('pendiente', 'confirmada', 'en_preparacion')`
  );

  return {
    ventas_hoy: {
      cuentas: ventasHoy.cuentas,
      total: Number(ventasHoy.venta),
    },
    ventas_mes: {
      cuentas: ventasMes.cuentas,
      total: Number(ventasMes.venta),
    },
    cuentas_abiertas: abiertas.total,
    mesas: {
      ocupadas: mesasOcupadas.ocupadas,
      total: mesasOcupadas.total,
    },
    kds_pendientes: kdsPendientes.total,
    productos_86: alertasStock.total,
    ordenes_digitales_pendientes: ordenesPendientes.total,
  };
}

// ============================================================================
// 8. FOOD COST
// ============================================================================

/**
 * Calculate food cost percentage by product for a given date range.
 * food_cost_pct = (costo_ingredientes / ingreso_venta) * 100
 */
export async function foodCost(client, { desde, hasta }) {
  if (!desde || !hasta) {
    return { error: true, status: 400, code: 'FECHAS_REQUERIDAS', message: 'Se requieren desde y hasta' };
  }

  // Products sold in the period with their revenue
  const { rows: productos } = await client.query(
    `SELECT
       pr.id,
       pr.clave,
       pr.descripcion,
       g.nombre AS grupo,
       SUM(co.cantidad)::numeric AS cantidad_vendida,
       COALESCE(SUM(co.importe), 0)::bigint AS ingreso_total,
       pr.costo_unitario AS costo_receta
     FROM consumos co
     JOIN cuentas cu ON cu.id = co.cuenta_id
     JOIN productos pr ON pr.id = co.producto_id
     LEFT JOIN grupos g ON g.id = pr.grupo_id
     WHERE cu.estado = 'cobrada'
       AND cu.cerrada_en::date BETWEEN $1::date AND $2::date
       AND co.estado = 'activo'
     GROUP BY pr.id, pr.clave, pr.descripcion, g.nombre, pr.costo_unitario
     ORDER BY ingreso_total DESC`,
    [desde, hasta]
  );

  // Calculate food cost for each product
  const resultado = productos.map(p => {
    const cantidadVendida = Number(p.cantidad_vendida);
    const ingresoTotal = Number(p.ingreso_total);
    const costoTotal = Math.round(cantidadVendida * p.costo_receta);
    const foodCostPct = ingresoTotal > 0
      ? Math.round((costoTotal / ingresoTotal) * 10000) / 100
      : 0;

    return {
      id: p.id,
      clave: p.clave,
      descripcion: p.descripcion,
      grupo: p.grupo,
      cantidad_vendida: cantidadVendida,
      ingreso_total: ingresoTotal,
      costo_total: costoTotal,
      food_cost_pct: foodCostPct,
      margen: ingresoTotal - costoTotal,
    };
  });

  // Global food cost
  const totalIngreso = resultado.reduce((s, r) => s + r.ingreso_total, 0);
  const totalCosto = resultado.reduce((s, r) => s + r.costo_total, 0);
  const globalFoodCost = totalIngreso > 0
    ? Math.round((totalCosto / totalIngreso) * 10000) / 100
    : 0;

  return {
    desde,
    hasta,
    food_cost_global: globalFoodCost,
    ingreso_total: totalIngreso,
    costo_total: totalCosto,
    margen_total: totalIngreso - totalCosto,
    productos: resultado,
  };
}

// ============================================================================
// 9. DESVIACIONES (Theoretical vs Real consumption)
// ============================================================================

/**
 * Compare theoretical consumption (based on recipes * sales) vs
 * real consumption (based on inventory movements).
 */
export async function desviaciones(client, { desde, hasta }) {
  if (!desde || !hasta) {
    return { error: true, status: 400, code: 'FECHAS_REQUERIDAS', message: 'Se requieren desde y hasta' };
  }

  // Step 1: Get all items sold in the period (with their recipes)
  const { rows: ventas } = await client.query(
    `SELECT
       co.producto_id,
       pr.descripcion AS producto,
       SUM(co.cantidad)::numeric AS cantidad_vendida
     FROM consumos co
     JOIN cuentas cu ON cu.id = co.cuenta_id
     JOIN productos pr ON pr.id = co.producto_id
     WHERE cu.estado = 'cobrada'
       AND cu.cerrada_en::date BETWEEN $1::date AND $2::date
       AND co.estado = 'activo'
     GROUP BY co.producto_id, pr.descripcion`,
    [desde, hasta]
  );

  // Step 2: For each sold product, get recipe and calculate theoretical consumption
  const consumoTeorico = {};
  for (const venta of ventas) {
    const { rows: receta } = await client.query(
      `SELECT r.insumo_id, r.cantidad AS cantidad_receta, pr.descripcion AS insumo_nombre, pr.unidad
       FROM recetas r
       JOIN productos pr ON pr.id = r.insumo_id
       WHERE r.producto_id = $1`,
      [venta.producto_id]
    );

    for (const ingrediente of receta) {
      const key = ingrediente.insumo_id;
      if (!consumoTeorico[key]) {
        consumoTeorico[key] = {
          insumo_id: key,
          insumo_nombre: ingrediente.insumo_nombre,
          unidad: ingrediente.unidad,
          teorico: 0,
        };
      }
      consumoTeorico[key].teorico += Number(venta.cantidad_vendida) * Number(ingrediente.cantidad_receta);
    }
  }

  // Step 3: Get real consumption from inventory movements
  const insumoIds = Object.keys(consumoTeorico);
  if (insumoIds.length === 0) {
    return { desde, hasta, desviaciones: [], message: 'No hay ventas con receta en el periodo' };
  }

  const { rows: movimientos } = await client.query(
    `SELECT
       producto_id,
       COALESCE(SUM(CASE WHEN tipo LIKE 'salida_%' THEN cantidad ELSE 0 END), 0)::numeric AS consumo_real
     FROM movimientos_inventario
     WHERE producto_id = ANY($1::uuid[])
       AND created_at::date BETWEEN $2::date AND $3::date
     GROUP BY producto_id`,
    [insumoIds, desde, hasta]
  );

  const movimientoMap = {};
  for (const m of movimientos) {
    movimientoMap[m.producto_id] = Number(m.consumo_real);
  }

  // Step 4: Calculate deviations
  const desviacionesList = Object.values(consumoTeorico).map(item => {
    const real = movimientoMap[item.insumo_id] || 0;
    const desviacion = real - item.teorico;
    const desviacionPct = item.teorico > 0
      ? Math.round((desviacion / item.teorico) * 10000) / 100
      : 0;

    return {
      insumo_id: item.insumo_id,
      insumo: item.insumo_nombre,
      unidad: item.unidad,
      consumo_teorico: Math.round(item.teorico * 10000) / 10000,
      consumo_real: real,
      desviacion: Math.round(desviacion * 10000) / 10000,
      desviacion_pct: desviacionPct,
      status: Math.abs(desviacionPct) <= 5 ? 'normal' : desviacionPct > 0 ? 'exceso' : 'faltante',
    };
  });

  // Sort by absolute deviation percentage (worst first)
  desviacionesList.sort((a, b) => Math.abs(b.desviacion_pct) - Math.abs(a.desviacion_pct));

  return {
    desde,
    hasta,
    total_insumos: desviacionesList.length,
    con_desviacion: desviacionesList.filter(d => d.status !== 'normal').length,
    desviaciones: desviacionesList,
  };
}

// ============================================================================
// 10. EXPLOSION BOM (Bill of Materials)
// ============================================================================

/**
 * Given a product and quantity (batch), calculate total raw materials needed.
 * This "explodes" the recipe to show all ingredients.
 */
export async function explosionBOM(client, { producto_id, porciones = 1 }) {
  // Get product info
  const { rows: [producto] } = await client.query(
    `SELECT id, clave, descripcion, tipo FROM productos WHERE id = $1`,
    [producto_id]
  );

  if (!producto) {
    return { error: true, status: 404, code: 'PRODUCTO_NOT_FOUND', message: 'Producto no encontrado' };
  }

  // Get recipe
  const { rows: receta } = await client.query(
    `SELECT r.insumo_id, r.cantidad, r.unidad AS receta_unidad,
            pr.descripcion AS insumo_nombre, pr.unidad, pr.costo_unitario
     FROM recetas r
     JOIN productos pr ON pr.id = r.insumo_id
     WHERE r.producto_id = $1
     ORDER BY pr.descripcion`,
    [producto_id]
  );

  if (receta.length === 0) {
    return {
      producto: producto.descripcion,
      porciones,
      ingredientes: [],
      message: 'Este producto no tiene receta',
    };
  }

  // Get current stock for each ingredient
  const insumoIds = receta.map(r => r.insumo_id);
  const { rows: stockRows } = await client.query(
    `SELECT producto_id, COALESCE(SUM(cantidad), 0)::numeric AS stock_total
     FROM existencias
     WHERE producto_id = ANY($1::uuid[])
     GROUP BY producto_id`,
    [insumoIds]
  );

  const stockMap = {};
  for (const s of stockRows) {
    stockMap[s.producto_id] = Number(s.stock_total);
  }

  // Calculate
  const ingredientes = receta.map(r => {
    const necesario = Number(r.cantidad) * porciones;
    const stockActual = stockMap[r.insumo_id] || 0;
    const faltante = Math.max(0, necesario - stockActual);
    const costoTotal = Math.round(necesario * r.costo_unitario);

    return {
      insumo_id: r.insumo_id,
      insumo: r.insumo_nombre,
      unidad: r.unidad,
      cantidad_por_porcion: Number(r.cantidad),
      cantidad_total: Math.round(necesario * 10000) / 10000,
      stock_actual: stockActual,
      faltante: Math.round(faltante * 10000) / 10000,
      costo_unitario: r.costo_unitario,
      costo_total: costoTotal,
      suficiente: faltante === 0,
    };
  });

  const costoTotalBatch = ingredientes.reduce((s, i) => s + i.costo_total, 0);
  const todosDisponibles = ingredientes.every(i => i.suficiente);

  return {
    producto: producto.descripcion,
    porciones,
    costo_total_batch: costoTotalBatch,
    costo_por_porcion: Math.round(costoTotalBatch / porciones),
    todos_disponibles: todosDisponibles,
    ingredientes,
  };
}

// ============================================================================
// 11. RECALCULAR COSTOS
// ============================================================================

/**
 * Recalculate costo_unitario for all products that have recipes.
 * costo_unitario = SUM(ingrediente.costo_unitario * ingrediente.cantidad_receta) / porciones
 *
 * Uses a single batch UPDATE instead of N+1 queries (previously 3 queries per product).
 */
export async function recalcularCostos(client) {
  // Single query: calculate cost per product and update in one shot
  const { rowCount: actualizados } = await client.query(
    `UPDATE productos p
     SET costo_unitario = sub.costo_por_porcion,
         updated_at = NOW()
     FROM (
       SELECT
         r.producto_id,
         ROUND(COALESCE(SUM(r.cantidad * pr.costo_unitario), 0) / GREATEST(p2.porciones, 1))::bigint AS costo_por_porcion
       FROM recetas r
       JOIN productos pr ON pr.id = r.insumo_id
       JOIN productos p2 ON p2.id = r.producto_id
       GROUP BY r.producto_id, p2.porciones
     ) sub
     WHERE p.id = sub.producto_id
       AND p.costo_unitario IS DISTINCT FROM sub.costo_por_porcion`
  );

  // Count total products with recipes for the report
  const { rows: [{ total }] } = await client.query(
    `SELECT COUNT(DISTINCT producto_id)::integer AS total FROM recetas`
  );

  logger.info('Costos recalculated', { actualizados });

  return {
    ok: true,
    productos_analizados: total,
    actualizados: actualizados || 0,
  };
}

// ============================================================================
// 12. AUDITORIA
// ============================================================================

/**
 * Get audit trail with filters.
 */
export async function getAuditoria(client, { page = 1, limit = 50, tabla, accion, usuario, desde, hasta } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (tabla) {
    conditions.push(`a.tabla = $${idx}`);
    params.push(tabla);
    idx++;
  }
  if (accion) {
    conditions.push(`a.accion = $${idx}`);
    params.push(accion);
    idx++;
  }
  if (usuario) {
    conditions.push(`a.usuario ILIKE $${idx}`);
    params.push(`%${usuario}%`);
    idx++;
  }
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

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM auditoria a ${whereClause}`,
    params
  );

  const { rows } = await client.query(
    `SELECT a.* FROM auditoria a
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: rows, total: countRow.total, page, limit };
}
