import { createAuditEntry } from './audit.service.js';
import logger from '../logger.js';

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Recalculate costo_integrado for a product based on its recipe lines.
 * Updates the product row directly.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} productoId - UUID
 * @returns {Promise<number>} The new costo_integrado (integer centavos)
 */
async function recalcularCostoIntegrado(client, productoId) {
  const { rows: [row] } = await client.query(
    `SELECT COALESCE(SUM(r.cantidad * p.costo_unitario), 0)::integer AS costo
     FROM recetas r
     JOIN productos p ON r.insumo_id = p.id
     WHERE r.producto_id = $1`,
    [productoId]
  );

  const costo = row.costo;

  await client.query(
    `UPDATE productos SET costo_integrado = $1, updated_at = NOW() WHERE id = $2`,
    [costo, productoId]
  );

  return costo;
}

// ============================================================================
// 1. listProductos
// ============================================================================

/**
 * Paginated list of products with grupo name.
 * Supports filters by grupo_id, tipo, activo, and text search (ILIKE).
 *
 * @param {import('pg').PoolClient} client
 * @param {object}  params
 * @param {string}  [params.grupoId]  - Filter by grupo UUID
 * @param {string}  [params.tipo]     - Filter by tipo (insumo|subproducto|terminado)
 * @param {boolean} [params.activo]   - Filter by activo flag
 * @param {string}  [params.search]   - ILIKE search on clave or descripcion
 * @param {number}  [params.page=1]
 * @param {number}  [params.limit=50]
 * @returns {Promise<{ productos: object[], total: number, page: number, pages: number }>}
 */
export async function listProductos(client, { grupoId, tipo, activo, search, page = 1, limit = 50 } = {}) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (grupoId) {
    conditions.push(`p.grupo_id = $${paramIdx++}`);
    params.push(grupoId);
  }

  if (tipo) {
    conditions.push(`p.tipo = $${paramIdx++}`);
    params.push(tipo);
  }

  if (activo !== undefined && activo !== null) {
    conditions.push(`p.activo = $${paramIdx++}`);
    params.push(activo);
  }

  if (search) {
    conditions.push(`(p.clave ILIKE $${paramIdx} OR p.descripcion ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(*)::integer AS total FROM productos p ${whereClause}`,
    params
  );

  const total = countRow.total;
  const pages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;

  // Fetch page
  const { rows: productos } = await client.query(
    `SELECT p.*, g.nombre AS grupo_nombre
     FROM productos p
     LEFT JOIN grupos g ON p.grupo_id = g.id
     ${whereClause}
     ORDER BY p.descripcion
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  return { productos, total, page, pages };
}

// ============================================================================
// 2. getProducto
// ============================================================================

/**
 * Get a single product with grupo name. If the product is tipo='terminado',
 * also includes its recipe lines.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} productoId - UUID
 * @returns {Promise<object>}
 */
export async function getProducto(client, productoId) {
  const { rows: [producto] } = await client.query(
    `SELECT p.*, g.nombre AS grupo_nombre
     FROM productos p
     LEFT JOIN grupos g ON p.grupo_id = g.id
     WHERE p.id = $1`,
    [productoId]
  );

  if (!producto) {
    return { error: true, status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Producto no encontrado' };
  }

  // Include recipe if terminado
  if (producto.tipo === 'terminado') {
    const { rows: receta } = await client.query(
      `SELECT r.*, p.descripcion AS insumo_nombre, p.clave AS insumo_clave, p.unidad, p.costo_unitario
       FROM recetas r
       JOIN productos p ON r.insumo_id = p.id
       WHERE r.producto_id = $1
       ORDER BY r.id`,
      [productoId]
    );
    producto.receta = receta;
  }

  return producto;
}

// ============================================================================
// 3. createProducto
// ============================================================================

/**
 * Create a new product. Auto-generates clave if not provided.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function createProducto(client, {
  clave,
  descripcion,
  grupo_id = null,
  tipo = 'insumo',
  unidad = 'pza',
  precio_venta = 0,
  costo_unitario = 0,
  punto_reorden = 0,
  area_produccion = null,
  porciones = 1,
  bloquear_sin_stock = false,
  nivel_minimo_critico = 5,
  tenantId,
  usuario,
  usuarioId,
  ip,
}) {
  // Auto-generate clave if not provided
  const claveReal = clave || `${tipo.substring(0, 3).toUpperCase()}-${Date.now().toString(36)}`;

  const { rows: [producto] } = await client.query(
    `INSERT INTO productos
       (tenant_id, clave, descripcion, grupo_id, tipo, unidad,
        precio_venta, costo_unitario, punto_reorden,
        area_produccion, porciones, bloquear_sin_stock, nivel_minimo_critico)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      tenantId, claveReal, descripcion, grupo_id, tipo, unidad,
      precio_venta, costo_unitario, punto_reorden,
      area_produccion, porciones, bloquear_sin_stock, nivel_minimo_critico,
    ]
  );

  await createAuditEntry(client, {
    tenantId,
    tipo: 'crear_producto',
    entidad: 'producto',
    entidadId: producto.id,
    descripcion: `Producto creado: ${claveReal} — ${descripcion}`,
    datos: { tipo, precio_venta, costo_unitario },
    usuario,
    usuarioId,
    ip,
  });

  logger.info('Producto creado', { tenantId, productoId: producto.id, clave: claveReal });

  return producto;
}

// ============================================================================
// 4. updateProducto
// ============================================================================

/**
 * Update a product. Only provided fields are updated.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function updateProducto(client, {
  productoId,
  tenantId,
  usuario,
  usuarioId,
  ip,
  ...data
}) {
  // Build dynamic SET clause from provided fields
  const allowedFields = [
    'clave', 'descripcion', 'grupo_id', 'tipo', 'unidad',
    'precio_venta', 'costo_unitario', 'punto_reorden',
    'area_produccion', 'porciones', 'bloquear_sin_stock', 'nivel_minimo_critico',
  ];

  const setClauses = [];
  const params = [];
  let paramIdx = 1;

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      setClauses.push(`${field} = $${paramIdx++}`);
      params.push(data[field]);
    }
  }

  if (setClauses.length === 0) {
    return { error: true, status: 400, code: 'NO_FIELDS', message: 'No hay campos para actualizar' };
  }

  setClauses.push('updated_at = NOW()');
  params.push(productoId);

  const { rows: [producto] } = await client.query(
    `UPDATE productos SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params
  );

  if (!producto) {
    return { error: true, status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Producto no encontrado' };
  }

  await createAuditEntry(client, {
    tenantId,
    tipo: 'actualizar_producto',
    entidad: 'producto',
    entidadId: productoId,
    descripcion: `Producto actualizado: ${producto.clave}`,
    datos: data,
    usuario,
    usuarioId,
    ip,
  });

  logger.info('Producto actualizado', { tenantId, productoId, clave: producto.clave });

  return producto;
}

// ============================================================================
// 5. deleteProducto (soft delete)
// ============================================================================

/**
 * Soft-delete a product by setting activo = false.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function deleteProducto(client, {
  productoId,
  tenantId,
  usuario,
  usuarioId,
  ip,
}) {
  const { rows: [producto] } = await client.query(
    `UPDATE productos SET activo = false, updated_at = NOW() WHERE id = $1 RETURNING id, clave, descripcion`,
    [productoId]
  );

  if (!producto) {
    return { error: true, status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Producto no encontrado' };
  }

  await createAuditEntry(client, {
    tenantId,
    tipo: 'eliminar_producto',
    entidad: 'producto',
    entidadId: productoId,
    descripcion: `Producto desactivado: ${producto.clave} — ${producto.descripcion}`,
    usuario,
    usuarioId,
    ip,
  });

  logger.info('Producto desactivado', { tenantId, productoId, clave: producto.clave });

  return { ok: true, producto_id: productoId };
}

// ============================================================================
// 6. listGrupos
// ============================================================================

/**
 * List all product groups ordered by nombre.
 *
 * @param {import('pg').PoolClient} client
 * @returns {Promise<object[]>}
 */
export async function listGrupos(client) {
  const { rows } = await client.query(
    `SELECT * FROM grupos ORDER BY nombre`
  );
  return rows;
}

// ============================================================================
// 7. createGrupo
// ============================================================================

/**
 * Create a new product group.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function createGrupo(client, { nombre, descripcion = null, tenantId }) {
  const { rows: [grupo] } = await client.query(
    `INSERT INTO grupos (tenant_id, nombre, descripcion) VALUES ($1, $2, $3) RETURNING *`,
    [tenantId, nombre, descripcion]
  );

  logger.info('Grupo creado', { tenantId, grupoId: grupo.id, nombre });

  return grupo;
}

// ============================================================================
// 8. updateGrupo
// ============================================================================

/**
 * Update a product group.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function updateGrupo(client, { grupoId, nombre, descripcion }) {
  const setClauses = [];
  const params = [];
  let paramIdx = 1;

  if (nombre !== undefined) {
    setClauses.push(`nombre = $${paramIdx++}`);
    params.push(nombre);
  }

  if (descripcion !== undefined) {
    setClauses.push(`descripcion = $${paramIdx++}`);
    params.push(descripcion);
  }

  if (setClauses.length === 0) {
    return { error: true, status: 400, code: 'NO_FIELDS', message: 'No hay campos para actualizar' };
  }

  params.push(grupoId);

  const { rows: [grupo] } = await client.query(
    `UPDATE grupos SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params
  );

  if (!grupo) {
    return { error: true, status: 404, code: 'GRUPO_NOT_FOUND', message: 'Grupo no encontrado' };
  }

  return grupo;
}

// ============================================================================
// 9. deleteGrupo
// ============================================================================

/**
 * Delete a product group (hard delete — it's just a category).
 *
 * @param {import('pg').PoolClient} client
 * @param {string} grupoId - UUID
 * @returns {Promise<object>}
 */
export async function deleteGrupo(client, grupoId) {
  const { rowCount } = await client.query(
    `DELETE FROM grupos WHERE id = $1`,
    [grupoId]
  );

  if (rowCount === 0) {
    return { error: true, status: 404, code: 'GRUPO_NOT_FOUND', message: 'Grupo no encontrado' };
  }

  return { ok: true, grupo_id: grupoId };
}

// ============================================================================
// 9b. listRecetas — Products that have recipes (for admin Recetas page)
// ============================================================================

/**
 * List products that have at least one recipe line, with their
 * costo_integrado and ingredient count. Supports pagination.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @returns {Promise<{ recetas: object[], total: number, page: number, pages: number }>}
 */
export async function listRecetas(client, { page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;

  // Count products that have recipes
  const { rows: [countRow] } = await client.query(
    `SELECT COUNT(DISTINCT r.producto_id)::integer AS total
     FROM recetas r`
  );

  // Get products with recipe summary
  const { rows } = await client.query(
    `SELECT p.id, p.clave, p.descripcion, p.porciones, p.costo_unitario, p.precio_venta,
            COUNT(r.id)::integer AS ingredientes_count,
            p.tipo
     FROM productos p
     INNER JOIN recetas r ON r.producto_id = p.id
     GROUP BY p.id
     ORDER BY p.descripcion
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return {
    recetas: rows,
    total: countRow.total,
    page,
    pages: Math.ceil(countRow.total / limit),
  };
}

// ============================================================================
// 10. getReceta
// ============================================================================

/**
 * Get recipe lines for a product with ingredient details and calculated
 * costo_integrado.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} productoId - UUID
 * @returns {Promise<{ lineas: object[], costo_integrado: number }>}
 */
export async function getReceta(client, productoId) {
  const { rows: lineas } = await client.query(
    `SELECT r.*, p.descripcion AS insumo_nombre, p.clave AS insumo_clave, p.unidad, p.costo_unitario
     FROM recetas r
     JOIN productos p ON r.insumo_id = p.id
     WHERE r.producto_id = $1
     ORDER BY r.id`,
    [productoId]
  );

  // Calculate costo_integrado
  const costoIntegrado = lineas.reduce((sum, linea) => {
    return sum + Math.round(parseFloat(linea.cantidad) * linea.costo_unitario);
  }, 0);

  return { lineas, costo_integrado: costoIntegrado };
}

// ============================================================================
// 11. addRecetaLinea
// ============================================================================

/**
 * Add a recipe line (ingredient) to a product's recipe.
 * Recalculates costo_integrado on the parent product.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function addRecetaLinea(client, { productoId, insumoId, cantidad, unidad = null, tenantId }) {
  const { rows: [linea] } = await client.query(
    `INSERT INTO recetas (tenant_id, producto_id, insumo_id, cantidad, unidad)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tenantId, productoId, insumoId, cantidad, unidad]
  );

  const costoIntegrado = await recalcularCostoIntegrado(client, productoId);

  logger.info('Receta linea agregada', { productoId, insumoId, cantidad, costoIntegrado });

  return { linea, costo_integrado: costoIntegrado };
}

// ============================================================================
// 12. updateRecetaLinea
// ============================================================================

/**
 * Update a recipe line's quantity and/or unit.
 * Recalculates costo_integrado on the parent product.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function updateRecetaLinea(client, { lineaId, cantidad, unidad }) {
  const setClauses = [];
  const params = [];
  let paramIdx = 1;

  if (cantidad !== undefined) {
    setClauses.push(`cantidad = $${paramIdx++}`);
    params.push(cantidad);
  }

  if (unidad !== undefined) {
    setClauses.push(`unidad = $${paramIdx++}`);
    params.push(unidad);
  }

  if (setClauses.length === 0) {
    return { error: true, status: 400, code: 'NO_FIELDS', message: 'No hay campos para actualizar' };
  }

  params.push(lineaId);

  const { rows: [linea] } = await client.query(
    `UPDATE recetas SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params
  );

  if (!linea) {
    return { error: true, status: 404, code: 'LINEA_NOT_FOUND', message: 'Linea de receta no encontrada' };
  }

  const costoIntegrado = await recalcularCostoIntegrado(client, linea.producto_id);

  logger.info('Receta linea actualizada', { lineaId, productoId: linea.producto_id, costoIntegrado });

  return { linea, costo_integrado: costoIntegrado };
}

// ============================================================================
// 13. deleteRecetaLinea
// ============================================================================

/**
 * Delete a recipe line. Recalculates costo_integrado on the parent product.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function deleteRecetaLinea(client, { lineaId, productoId, tenantId }) {
  const { rowCount } = await client.query(
    `DELETE FROM recetas WHERE id = $1`,
    [lineaId]
  );

  if (rowCount === 0) {
    return { error: true, status: 404, code: 'LINEA_NOT_FOUND', message: 'Linea de receta no encontrada' };
  }

  const costoIntegrado = await recalcularCostoIntegrado(client, productoId);

  logger.info('Receta linea eliminada', { lineaId, productoId, costoIntegrado });

  return { ok: true, linea_id: lineaId, costo_integrado: costoIntegrado };
}

// ============================================================================
// 15. elaborar — Production batch
// ============================================================================

/**
 * Execute a production batch: deduct ingredients from inventory and add
 * finished product portions to stock.
 *
 * Ingredient outgoing movements use tipo='salida_ajuste' with a descriptive
 * referencia. Finished product incoming uses tipo='entrada_produccion'.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function elaborar(client, {
  productoId,
  porciones = 1,
  almacenId = null,
  tenantId,
  usuario,
  usuarioId,
  ip,
}) {
  // --- 1. Get the product ---------------------------------------------------
  const { rows: [producto] } = await client.query(
    `SELECT id, clave, descripcion, tipo FROM productos WHERE id = $1 AND activo = true`,
    [productoId]
  );

  if (!producto) {
    return { error: true, status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Producto no encontrado o inactivo' };
  }

  if (producto.tipo !== 'terminado' && producto.tipo !== 'subproducto') {
    return {
      error: true,
      status: 400,
      code: 'NOT_ELABORABLE',
      message: 'Solo productos terminados o subproductos pueden elaborarse',
    };
  }

  // --- 2. Get recipe --------------------------------------------------------
  const { rows: receta } = await client.query(
    `SELECT r.insumo_id, r.cantidad, p.clave AS insumo_clave, p.descripcion AS insumo_nombre
     FROM recetas r
     JOIN productos p ON r.insumo_id = p.id
     WHERE r.producto_id = $1`,
    [productoId]
  );

  if (receta.length === 0) {
    return { error: true, status: 400, code: 'NO_RECIPE', message: 'El producto no tiene receta definida' };
  }

  // --- 3. Resolve almacen ---------------------------------------------------
  let almacenReal = almacenId;
  if (!almacenReal) {
    const { rows: [alm] } = await client.query(
      `SELECT id FROM almacenes WHERE tenant_id = $1 AND activo = true ORDER BY numero LIMIT 1`,
      [tenantId]
    );
    if (!alm) {
      return { error: true, status: 400, code: 'NO_ALMACEN', message: 'No hay almacen disponible' };
    }
    almacenReal = alm.id;
  }

  // --- 4. Transaction -------------------------------------------------------
  await client.query('BEGIN');
  try {
    const referencia = `Produccion: ${producto.descripcion} x ${porciones}`;

    // --- 4a. Deduct ingredients ---------------------------------------------
    for (const ing of receta) {
      const cantDescontar = parseFloat(ing.cantidad) * porciones;

      // SECURITY: Lock row with FOR UPDATE to prevent concurrent race conditions
      const { rows: [stockRow] } = await client.query(
        `SELECT cantidad FROM existencias
         WHERE producto_id = $1 AND almacen_id = $2
         FOR UPDATE`,
        [ing.insumo_id, almacenReal]
      );

      // Validate stock before deducting (prevent negative inventory)
      const currentStock = stockRow ? parseFloat(stockRow.cantidad) : 0;
      if (currentStock < cantDescontar) {
        throw Object.assign(new Error(
          `Stock insuficiente de ${ing.insumo_nombre || ing.insumo_id}: disponible ${currentStock}, requerido ${cantDescontar}`
        ), { status: 409, code: 'STOCK_INSUFFICIENT' });
      }

      // Deduct from existencias
      await client.query(
        `UPDATE existencias
         SET cantidad   = cantidad - $1,
             updated_at = NOW()
         WHERE producto_id = $2 AND almacen_id = $3`,
        [cantDescontar, ing.insumo_id, almacenReal]
      );

      // Log inventory movement (salida_ajuste for production ingredients)
      await client.query(
        `INSERT INTO movimientos_inventario
           (tenant_id, producto_id, almacen_id, tipo, cantidad, referencia, usuario)
         VALUES ($1, $2, $3, 'salida_ajuste', $4, $5, $6)`,
        [tenantId, ing.insumo_id, almacenReal, cantDescontar, referencia, usuario]
      );
    }

    // --- 4b. Add finished product to stock ----------------------------------
    // Upsert existencias for the finished product
    await client.query(
      `INSERT INTO existencias (tenant_id, producto_id, almacen_id, cantidad)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, producto_id, almacen_id)
       DO UPDATE SET cantidad = existencias.cantidad + EXCLUDED.cantidad, updated_at = NOW()`,
      [tenantId, productoId, almacenReal, porciones]
    );

    // Log inventory movement (entrada_produccion for finished product)
    await client.query(
      `INSERT INTO movimientos_inventario
         (tenant_id, producto_id, almacen_id, tipo, cantidad, referencia, usuario)
       VALUES ($1, $2, $3, 'entrada_produccion', $4, $5, $6)`,
      [tenantId, productoId, almacenReal, porciones, referencia, usuario]
    );

    // --- 5. Audit -----------------------------------------------------------
    await createAuditEntry(client, {
      tenantId,
      tipo: 'elaboracion',
      entidad: 'producto',
      entidadId: productoId,
      descripcion: referencia,
      datos: {
        porciones,
        almacen_id: almacenReal,
        ingredientes: receta.map(ing => ({
          insumo_id: ing.insumo_id,
          clave: ing.insumo_clave,
          cantidad_descontada: parseFloat(ing.cantidad) * porciones,
        })),
      },
      usuario,
      usuarioId,
      ip,
    });

    await client.query('COMMIT');

    logger.info('Elaboracion completada', {
      tenantId,
      productoId,
      producto: producto.descripcion,
      porciones,
      ingredientes: receta.length,
    });

    return {
      ok: true,
      producto_id: productoId,
      producto: producto.descripcion,
      porciones,
      almacen_id: almacenReal,
      ingredientes_descontados: receta.length,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error en elaboracion', { productoId, porciones, error: err.message });
    throw err;
  }
}

// ============================================================================
// 16. listModificadores
// ============================================================================

/**
 * List modificadores for a product.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} productoId - UUID
 * @returns {Promise<object[]>}
 */
export async function listModificadores(client, productoId) {
  const { rows } = await client.query(
    `SELECT * FROM modificadores_producto WHERE producto_id = $1 ORDER BY nombre`,
    [productoId]
  );
  return rows;
}

// ============================================================================
// 17. addModificador
// ============================================================================

/**
 * Add a modificador (modifier option) to a product.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function addModificador(client, { productoId, nombre, precio_extra = 0, tenantId }) {
  const { rows: [modificador] } = await client.query(
    `INSERT INTO modificadores_producto (tenant_id, producto_id, nombre, precio_extra)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tenantId, productoId, nombre, precio_extra]
  );

  logger.info('Modificador agregado', { productoId, nombre });

  return modificador;
}

// ============================================================================
// 18. deleteModificador
// ============================================================================

/**
 * Delete a modificador.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} modificadorId - UUID
 * @returns {Promise<object>}
 */
export async function deleteModificador(client, modificadorId) {
  const { rowCount } = await client.query(
    `DELETE FROM modificadores_producto WHERE id = $1`,
    [modificadorId]
  );

  if (rowCount === 0) {
    return { error: true, status: 404, code: 'MODIFICADOR_NOT_FOUND', message: 'Modificador no encontrado' };
  }

  return { ok: true, modificador_id: modificadorId };
}
