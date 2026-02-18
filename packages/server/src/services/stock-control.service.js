import { createAuditEntry } from './audit.service.js';
import logger from '../logger.js';

// ==========================================
// DISPONIBILIDAD — Optimized CTE (no N+1)
// ==========================================

/**
 * Calculate stock availability for all finished products using a single
 * optimized CTE query instead of the old N+1 approach.
 *
 * @param {import('pg').PoolClient} client - Tenant-scoped DB client
 * @param {object} params
 * @param {string}  [params.grupoId]       - Filter by group UUID
 * @param {boolean} [params.soloAgotados]  - Only return non-available items
 * @returns {Promise<{ productos: object[], resumen: object }>}
 */
export async function getDisponibilidad(client, { grupoId, soloAgotados } = {}) {
  const params = [];
  let grupoFilter = '';

  if (grupoId) {
    params.push(grupoId);
    grupoFilter = `AND p.grupo_id = $${params.length}`;
  }

  const sql = `
    WITH recipe_stock AS (
      SELECT
        r.producto_id,
        r.insumo_id,
        r.cantidad AS cantidad_receta,
        p2.descripcion AS insumo_nombre,
        p2.unidad AS insumo_unidad,
        COALESCE(SUM(e.cantidad), 0) AS stock_actual
      FROM recetas r
      JOIN productos p2 ON r.insumo_id = p2.id
      LEFT JOIN existencias e ON e.producto_id = r.insumo_id
      GROUP BY r.producto_id, r.insumo_id, r.cantidad, p2.descripcion, p2.unidad
    ),
    porciones AS (
      SELECT
        producto_id,
        MIN(
          CASE
            WHEN cantidad_receta > 0 THEN FLOOR(stock_actual / cantidad_receta)
            ELSE 999999
          END
        ) AS porciones_disponibles,
        (ARRAY_AGG(
          jsonb_build_object(
            'nombre', insumo_nombre,
            'stock', stock_actual,
            'necesario_por_porcion', cantidad_receta,
            'unidad', insumo_unidad
          )
          ORDER BY
            CASE
              WHEN cantidad_receta > 0 THEN stock_actual / cantidad_receta
              ELSE 999999
            END ASC
        ))[1] AS ingrediente_limitante,
        COUNT(*) AS num_ingredientes
      FROM recipe_stock
      GROUP BY producto_id
    )
    SELECT
      p.id, p.clave, p.descripcion, p.tipo, p.precio_venta,
      p.suspendido_86, p.suspendido_86_motivo, p.suspendido_86_por,
      p.nivel_minimo_critico, p.bloquear_sin_stock, p.porciones,
      g.nombre AS grupo_nombre,
      COALESCE(pc.porciones_disponibles, NULL) AS porciones_disponibles,
      pc.ingrediente_limitante,
      COALESCE(pc.num_ingredientes, 0)::int AS num_ingredientes,
      CASE
        WHEN p.suspendido_86 = true THEN '86'
        WHEN pc.porciones_disponibles IS NULL THEN 'sin_receta'
        WHEN pc.porciones_disponibles = 0 THEN 'agotado'
        WHEN pc.porciones_disponibles <= COALESCE(p.nivel_minimo_critico, 5) THEN 'critico'
        ELSE 'disponible'
      END AS estado_stock
    FROM productos p
    LEFT JOIN grupos g ON p.grupo_id = g.id
    LEFT JOIN porciones pc ON pc.producto_id = p.id
    WHERE p.activo = true AND p.tipo = 'terminado'
    ${grupoFilter}
    ORDER BY p.descripcion
  `;

  const { rows: productos } = await client.query(sql, params);

  // Apply solo_agotados filter in-app (simpler than wrapping the CTE)
  const filtered = soloAgotados
    ? productos.filter((p) => p.estado_stock !== 'disponible')
    : productos;

  // Build summary
  const resumen = {
    total: productos.length,
    disponibles: productos.filter((p) => p.estado_stock === 'disponible').length,
    criticos: productos.filter((p) => p.estado_stock === 'critico').length,
    agotados: productos.filter((p) => p.estado_stock === 'agotado').length,
    suspendidos_86: productos.filter((p) => p.estado_stock === '86').length,
    sin_receta: productos.filter((p) => p.estado_stock === 'sin_receta').length,
  };

  return { productos: filtered, resumen };
}

// ==========================================
// VERIFICAR STOCK — Pre-sale check
// ==========================================

/**
 * Pre-check whether a product can be sold based on current stock levels.
 * Returns a result object indicating if the sale can proceed, and if not,
 * what the limiting factors are.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string}  params.productoId   - UUID of the finished product
 * @param {number}  [params.cantidad=1] - Quantity requested
 * @param {string}  [params.gerenteClave] - Manager code for override authorization
 * @param {string}  params.tenantId     - Tenant UUID (for audit/inserts)
 * @returns {Promise<object>}
 */
export async function verificarStock(client, { productoId, cantidad = 1, gerenteClave, tenantId }) {
  // Fetch the product
  const { rows: [producto] } = await client.query(
    'SELECT * FROM productos WHERE id = $1 AND activo = true',
    [productoId],
  );

  if (!producto) {
    return { puede_vender: false, motivo: 'no_encontrado', mensaje: 'Producto no encontrado' };
  }

  // 86 check
  if (producto.suspendido_86) {
    // Record lost sale
    await client.query(
      `INSERT INTO ventas_perdidas (tenant_id, producto_id, cantidad, motivo, precio_perdido)
       VALUES ($1, $2, $3, 'suspendido_86', $4)`,
      [tenantId, productoId, cantidad, producto.precio_venta * cantidad],
    );

    return {
      puede_vender: false,
      motivo: 'suspendido_86',
      mensaje: `${producto.descripcion} esta marcado como 86 (agotado): ${producto.suspendido_86_motivo || 'Sin motivo'}`,
    };
  }

  // Non-finished products always pass
  if (producto.tipo !== 'terminado') {
    return { puede_vender: true };
  }

  // Get recipe
  const { rows: receta } = await client.query(
    'SELECT r.insumo_id, r.cantidad, p2.descripcion AS insumo_nombre, p2.unidad FROM recetas r JOIN productos p2 ON r.insumo_id = p2.id WHERE r.producto_id = $1',
    [productoId],
  );

  if (receta.length === 0) {
    return { puede_vender: true, sin_receta: true };
  }

  // Check stock for each ingredient
  const faltantes = [];
  for (const ing of receta) {
    const { rows: [stockRow] } = await client.query(
      'SELECT COALESCE(SUM(cantidad), 0) AS stock FROM existencias WHERE producto_id = $1',
      [ing.insumo_id],
    );

    const necesario = parseFloat(ing.cantidad) * cantidad;
    const stockActual = parseFloat(stockRow.stock);

    if (stockActual < necesario) {
      faltantes.push({
        insumo: ing.insumo_nombre,
        stock_actual: stockActual,
        necesario,
        faltante: +(necesario - stockActual).toFixed(4),
        unidad: ing.unidad,
      });
    }
  }

  if (faltantes.length > 0) {
    // Manager override?
    if (gerenteClave) {
      const { rows: [gerente] } = await client.query(
        `SELECT * FROM personal
         WHERE codigo = $1 AND activo = true
           AND (puesto = 'gerente' OR nivel_acceso >= 3)`,
        [gerenteClave],
      );

      if (gerente) {
        // Record authorized override
        await client.query(
          `INSERT INTO sobregiros_autorizados (tenant_id, producto_id, cantidad, autorizado_por, gerente_id, motivo)
           VALUES ($1, $2, $3, $4, $5, 'sobregiro_venta')`,
          [tenantId, productoId, cantidad, gerente.nombre, gerente.id],
        );

        return {
          puede_vender: true,
          sobregiro: true,
          autorizado_por: gerente.nombre,
          faltantes,
        };
      }

      return {
        puede_vender: false,
        motivo: 'clave_invalida',
        mensaje: 'Clave de gerente no valida',
      };
    }

    // Record lost sale
    await client.query(
      `INSERT INTO ventas_perdidas (tenant_id, producto_id, cantidad, motivo, precio_perdido)
       VALUES ($1, $2, $3, 'sin_stock', $4)`,
      [tenantId, productoId, cantidad, producto.precio_venta * cantidad],
    );

    // Hard stop if bloquear_sin_stock is enabled
    if (producto.bloquear_sin_stock) {
      return {
        puede_vender: false,
        motivo: 'sin_stock',
        mensaje: `Stock insuficiente para ${producto.descripcion}`,
        faltantes,
        requiere_autorizacion: true,
      };
    }

    // Soft warning — allow but flag
    return {
      puede_vender: true,
      warning: true,
      mensaje: `Stock bajo para ${producto.descripcion}`,
      faltantes,
    };
  }

  return { puede_vender: true };
}

// ==========================================
// MARCAR 86 — Suspend product
// ==========================================

/**
 * Mark a product as 86 (out of stock / unavailable).
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string} params.productoId  - Product UUID
 * @param {string} [params.motivo]    - Reason for 86
 * @param {string} [params.responsable] - Who marked it
 * @param {string} params.tenantId
 * @param {string} [params.usuario]
 * @param {string} [params.usuarioId]
 * @param {string} [params.ip]
 * @returns {Promise<object>}
 */
export async function marcar86(client, { productoId, motivo, responsable, tenantId, usuario, usuarioId, ip }) {
  const motivoFinal = motivo || 'Agotado';
  const responsableFinal = responsable || 'Sistema';

  // Update the product
  await client.query(
    `UPDATE productos
     SET suspendido_86 = true,
         suspendido_86_motivo = $1,
         suspendido_86_por = $2,
         suspendido_86_en = NOW(),
         updated_at = NOW()
     WHERE id = $3`,
    [motivoFinal, responsableFinal, productoId],
  );

  // Fetch product info for notifications
  const { rows: [producto] } = await client.query(
    'SELECT id, clave, descripcion, grupo_id, precio_venta FROM productos WHERE id = $1',
    [productoId],
  );

  if (!producto) {
    const err = new Error('Producto no encontrado');
    err.status = 404;
    err.code = 'PRODUCT_NOT_FOUND';
    throw err;
  }

  // Insert stock alert — need a default almacen for the required almacen_id
  const { rows: [almacen] } = await client.query(
    'SELECT id FROM almacenes WHERE activo = true ORDER BY numero ASC LIMIT 1',
  );

  if (almacen) {
    await client.query(
      `INSERT INTO alertas_stock (tenant_id, producto_id, almacen_id, tipo, cantidad_actual, nivel_minimo)
       VALUES ($1, $2, $3, 'agotado', 0, 0)`,
      [tenantId, productoId, almacen.id],
    );
  }

  // Create notification for kitchen
  await client.query(
    `INSERT INTO notificaciones (tenant_id, destinatario_tipo, titulo, mensaje, tipo)
     VALUES ($1, 'cocina', $2, $3, 'alerta')`,
    [tenantId, `PLATO 86: ${producto.descripcion}`, motivoFinal],
  );

  // Audit entry
  await createAuditEntry(client, {
    tenantId,
    tipo: '86',
    entidad: 'producto',
    entidadId: productoId,
    descripcion: `Producto marcado 86: ${motivoFinal}`,
    datos: { motivo: motivoFinal, responsable: responsableFinal },
    usuario,
    usuarioId,
    ip,
  });

  logger.info('Product marked as 86', { productoId, descripcion: producto.descripcion, motivo: motivoFinal });

  return {
    ok: true,
    mensaje: `${producto.descripcion} marcado como 86`,
    producto,
  };
}

// ==========================================
// DESMARCAR 86 — Restore product
// ==========================================

/**
 * Remove the 86 suspension from a product.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string} params.productoId
 * @param {string} params.tenantId
 * @param {string} [params.usuario]
 * @param {string} [params.usuarioId]
 * @param {string} [params.ip]
 * @returns {Promise<object>}
 */
export async function desmarcar86(client, { productoId, tenantId, usuario, usuarioId, ip }) {
  await client.query(
    `UPDATE productos
     SET suspendido_86 = false,
         suspendido_86_motivo = NULL,
         suspendido_86_por = NULL,
         suspendido_86_en = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [productoId],
  );

  const { rows: [producto] } = await client.query(
    'SELECT id, clave, descripcion FROM productos WHERE id = $1',
    [productoId],
  );

  // Audit entry
  await createAuditEntry(client, {
    tenantId,
    tipo: '86_restaurado',
    entidad: 'producto',
    entidadId: productoId,
    descripcion: `Producto restaurado de 86`,
    usuario,
    usuarioId,
    ip,
  });

  logger.info('Product restored from 86', { productoId, descripcion: producto?.descripcion });

  return {
    ok: true,
    mensaje: `${producto?.descripcion || productoId} restaurado a disponible`,
    producto,
  };
}

// ==========================================
// LISTAR 86 — Current 86 products
// ==========================================

/**
 * List all products currently marked as 86.
 *
 * @param {import('pg').PoolClient} client
 * @returns {Promise<object[]>}
 */
export async function listar86(client) {
  const { rows } = await client.query(`
    SELECT
      p.id, p.clave, p.descripcion, p.grupo_id,
      g.nombre AS grupo_nombre,
      p.suspendido_86_motivo, p.suspendido_86_por, p.suspendido_86_en
    FROM productos p
    LEFT JOIN grupos g ON p.grupo_id = g.id
    WHERE p.suspendido_86 = true AND p.activo = true
    ORDER BY p.suspendido_86_en DESC
  `);

  return rows;
}

// ==========================================
// VENTAS PERDIDAS — Lost sales analytics
// ==========================================

/**
 * Get lost sales with grouping by product and revenue impact calculation.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string} [params.desde] - Start date (YYYY-MM-DD), defaults to today
 * @param {string} [params.hasta] - End date (YYYY-MM-DD), defaults to today
 * @param {number} [params.limit=100]
 * @returns {Promise<object>}
 */
export async function getVentasPerdidas(client, { desde, hasta, limit = 100 } = {}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const fechaDesde = desde || hoy;
  const fechaHasta = hasta || hoy;

  const { rows: detalle } = await client.query(
    `SELECT
       vp.id, vp.producto_id, vp.cantidad, vp.motivo,
       vp.precio_perdido, vp.mesa_numero, vp.notas, vp.created_at,
       p.descripcion AS producto_nombre, p.clave, p.precio_venta
     FROM ventas_perdidas vp
     JOIN productos p ON vp.producto_id = p.id
     WHERE vp.created_at::date BETWEEN $1::date AND $2::date
     ORDER BY vp.created_at DESC
     LIMIT $3`,
    [fechaDesde, fechaHasta, limit],
  );

  // Ranking grouped by product (done in SQL would be cleaner, but keeping
  // the grouping flexible for the response shape the frontend expects)
  const porProducto = {};
  for (const vp of detalle) {
    if (!porProducto[vp.producto_id]) {
      porProducto[vp.producto_id] = {
        producto_id: vp.producto_id,
        producto: vp.producto_nombre,
        clave: vp.clave,
        intentos: 0,
        cantidad_total: 0,
        ingreso_perdido: 0,
      };
    }
    porProducto[vp.producto_id].intentos++;
    porProducto[vp.producto_id].cantidad_total += parseFloat(vp.cantidad);
    porProducto[vp.producto_id].ingreso_perdido += vp.precio_perdido;
  }

  const ranking = Object.values(porProducto).sort((a, b) => b.ingreso_perdido - a.ingreso_perdido);
  const totalPerdido = detalle.reduce((sum, vp) => sum + (vp.precio_perdido || 0), 0);

  return {
    detalle,
    ranking,
    totales: {
      total_intentos: detalle.length,
      ingreso_total_perdido: totalPerdido,
      productos_afectados: ranking.length,
    },
  };
}

// ==========================================
// ALERTAS — Stock alerts
// ==========================================

/**
 * Get stock alerts with product info.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {boolean} [params.soloPendientes] - Only unresolved alerts
 * @returns {Promise<object[]>}
 */
export async function getAlertas(client, { soloPendientes } = {}) {
  let sql = `
    SELECT
      a.id, a.producto_id, a.almacen_id, a.tipo,
      a.cantidad_actual, a.nivel_minimo, a.atendida, a.created_at,
      p.descripcion AS producto_nombre, p.clave,
      al.nombre AS almacen_nombre
    FROM alertas_stock a
    JOIN productos p ON a.producto_id = p.id
    LEFT JOIN almacenes al ON a.almacen_id = al.id
  `;

  if (soloPendientes) {
    sql += ' WHERE a.atendida = false';
  }

  sql += ' ORDER BY a.created_at DESC LIMIT 100';

  const { rows } = await client.query(sql);
  return rows;
}

// ==========================================
// SCAN ALERTAS — Automatic stock level scan
// ==========================================

/**
 * Scan all finished products, check stock levels vs nivel_minimo_critico,
 * and create alerts for products below threshold.
 * Uses the optimized CTE approach (no N+1).
 * Only creates alerts if no recent alert exists (last 2 hours).
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string} params.tenantId
 * @returns {Promise<{ ok: boolean, alertas_generadas: number }>}
 */
export async function scanAlertas(client, { tenantId }) {
  // Get default almacen for alert inserts
  const { rows: [almacen] } = await client.query(
    'SELECT id FROM almacenes WHERE activo = true ORDER BY numero ASC LIMIT 1',
  );

  if (!almacen) {
    logger.warn('scanAlertas: No active almacen found', { tenantId });
    return { ok: true, alertas_generadas: 0 };
  }

  // CTE-based approach: calculate portions for all finished products at once
  const { rows: productos } = await client.query(`
    WITH recipe_stock AS (
      SELECT
        r.producto_id,
        r.insumo_id,
        r.cantidad AS cantidad_receta,
        COALESCE(SUM(e.cantidad), 0) AS stock_actual
      FROM recetas r
      LEFT JOIN existencias e ON e.producto_id = r.insumo_id
      GROUP BY r.producto_id, r.insumo_id, r.cantidad
    ),
    porciones AS (
      SELECT
        producto_id,
        MIN(
          CASE
            WHEN cantidad_receta > 0 THEN FLOOR(stock_actual / cantidad_receta)
            ELSE 999999
          END
        ) AS porciones_disponibles
      FROM recipe_stock
      GROUP BY producto_id
    )
    SELECT
      p.id, p.descripcion, p.clave,
      p.nivel_minimo_critico,
      pc.porciones_disponibles
    FROM productos p
    JOIN porciones pc ON pc.producto_id = p.id
    WHERE p.activo = true
      AND p.tipo = 'terminado'
      AND pc.porciones_disponibles IS NOT NULL
      AND pc.porciones_disponibles <= COALESCE(p.nivel_minimo_critico, 5)
  `);

  let alertasGeneradas = 0;

  for (const prod of productos) {
    // Check if a recent unresolved alert already exists (last 2 hours)
    const { rows: existing } = await client.query(
      `SELECT 1 FROM alertas_stock
       WHERE producto_id = $1 AND atendida = false
         AND created_at > NOW() - INTERVAL '2 hours'
       LIMIT 1`,
      [prod.id],
    );

    if (existing.length > 0) continue;

    const tipo = parseFloat(prod.porciones_disponibles) === 0 ? 'agotado' : 'bajo_minimo';

    // Create alert
    await client.query(
      `INSERT INTO alertas_stock (tenant_id, producto_id, almacen_id, tipo, cantidad_actual, nivel_minimo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tenantId,
        prod.id,
        almacen.id,
        tipo,
        prod.porciones_disponibles,
        prod.nivel_minimo_critico || 5,
      ],
    );

    // Create notification for kitchen
    await client.query(
      `INSERT INTO notificaciones (tenant_id, destinatario_tipo, titulo, mensaje, tipo)
       VALUES ($1, 'cocina', $2, $3, 'alerta')`,
      [
        tenantId,
        `Stock bajo: ${prod.descripcion}`,
        `Quedan ${prod.porciones_disponibles} porciones`,
      ],
    );

    alertasGeneradas++;
  }

  logger.info('Stock alert scan completed', { tenantId, alertasGeneradas });

  return { ok: true, alertas_generadas: alertasGeneradas };
}

// ==========================================
// MENU DISPONIBLE — Dynamic menu (public)
// ==========================================

/**
 * Dynamic menu for client-app. Only shows available items.
 * Uses CTE to check stock in one query instead of N+1.
 * Groups results by grupo_nombre.
 *
 * @param {import('pg').PoolClient} client
 * @returns {Promise<{ menu: object, total_disponibles: number, total_catalogo: number }>}
 */
export async function getMenuDisponible(client) {
  const { rows } = await client.query(`
    WITH recipe_stock AS (
      SELECT
        r.producto_id,
        r.insumo_id,
        r.cantidad AS cantidad_receta,
        COALESCE(SUM(e.cantidad), 0) AS stock_actual
      FROM recetas r
      LEFT JOIN existencias e ON e.producto_id = r.insumo_id
      GROUP BY r.producto_id, r.insumo_id, r.cantidad
    ),
    porciones AS (
      SELECT
        producto_id,
        MIN(
          CASE
            WHEN cantidad_receta > 0 THEN FLOOR(stock_actual / cantidad_receta)
            ELSE 999999
          END
        ) AS porciones_disponibles,
        COUNT(*) AS num_ingredientes
      FROM recipe_stock
      GROUP BY producto_id
    )
    SELECT
      p.id, p.clave, p.descripcion, p.precio_venta,
      p.grupo_id, g.nombre AS grupo_nombre,
      p.area_produccion,
      COALESCE(pc.porciones_disponibles, NULL) AS porciones_disponibles,
      COALESCE(pc.num_ingredientes, 0)::int AS num_ingredientes
    FROM productos p
    LEFT JOIN grupos g ON p.grupo_id = g.id
    LEFT JOIN porciones pc ON pc.producto_id = p.id
    WHERE p.activo = true
      AND p.tipo = 'terminado'
      AND p.suspendido_86 = false
    ORDER BY g.nombre, p.descripcion
  `);

  // Total catalog count (before filtering by availability)
  const totalCatalogo = rows.length;

  // Filter: keep products that either have no recipe (always available)
  // or have at least 1 portion available
  const disponibles = rows.filter((p) => {
    // No recipe → available
    if (p.num_ingredientes === 0) return true;
    // Has recipe → needs at least 1 portion
    return p.porciones_disponibles !== null && parseFloat(p.porciones_disponibles) > 0;
  });

  // Group by grupo_nombre
  const menu = {};
  for (const p of disponibles) {
    const grupo = p.grupo_nombre || 'Otros';
    if (!menu[grupo]) menu[grupo] = [];
    menu[grupo].push({
      id: p.id,
      clave: p.clave,
      nombre: p.descripcion,
      precio: p.precio_venta,
      area_produccion: p.area_produccion,
    });
  }

  return {
    menu,
    total_disponibles: disponibles.length,
    total_catalogo: totalCatalogo,
  };
}

// ==========================================
// SOBREGIROS — Override history
// ==========================================

/**
 * Get override history for a date range.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {string} [params.desde] - Start date (YYYY-MM-DD), defaults to today
 * @param {string} [params.hasta] - End date (YYYY-MM-DD), defaults to today
 * @returns {Promise<object[]>}
 */
export async function getSobregiros(client, { desde, hasta } = {}) {
  const hoy = new Date().toISOString().slice(0, 10);

  const { rows } = await client.query(
    `SELECT
       s.id, s.producto_id, s.cuenta_id, s.cantidad,
       s.autorizado_por, s.gerente_id, s.motivo, s.created_at,
       p.descripcion AS producto_nombre, p.clave
     FROM sobregiros_autorizados s
     JOIN productos p ON s.producto_id = p.id
     WHERE s.created_at::date BETWEEN $1::date AND $2::date
     ORDER BY s.created_at DESC`,
    [desde || hoy, hasta || hoy],
  );

  return rows;
}
