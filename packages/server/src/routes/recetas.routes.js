import { Router } from 'express';
import { recetaCreateSchema, elaborarSchema } from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import {
  listRecetas,
  getReceta,
  addRecetaLinea,
  updateRecetaLinea,
  deleteRecetaLinea,
  elaborar,
  listModificadores,
  addModificador,
  deleteModificador,
} from '../services/catalog.service.js';

const router = Router();

// ---------------------------------------------------------------------------
//  List all products with recipes (paginated)
// ---------------------------------------------------------------------------

/**
 * GET /
 * List all products that have recipes, with summary info.
 * Any authenticated user can view.
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await listRecetas(req.tenantClient, {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
//  Recetas (BOM / Recipes)
// ---------------------------------------------------------------------------

/**
 * GET /:producto_id
 * Get recipe lines for a product with ingredient details and costo_integrado.
 * Any authenticated user can view.
 */
router.get('/:producto_id', requireAuth, async (req, res, next) => {
  try {
    const result = await getReceta(req.tenantClient, req.params.producto_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /:producto_id/lineas
 * Add an ingredient line to a product's recipe.
 * Requires gerente level (nivel_acceso >= 5).
 */
router.post(
  '/:producto_id/lineas',
  requireAuth,
  requireRole(5),
  validate(recetaCreateSchema),
  async (req, res, next) => {
    try {
      const result = await addRecetaLinea(req.tenantClient, {
        productoId: req.params.producto_id,
        insumoId: req.body.insumo_id,
        cantidad: req.body.cantidad,
        unidad: req.body.unidad,
        tenantId: req.tenantId,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /lineas/:id
 * Update a recipe line's quantity and/or unit.
 * Requires gerente level (nivel_acceso >= 5).
 */
router.put('/lineas/:id', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await updateRecetaLinea(req.tenantClient, {
      lineaId: req.params.id,
      cantidad: req.body.cantidad,
      unidad: req.body.unidad,
    });
    if (result.error) {
      return res.status(result.status).json({
        error: { code: result.code, message: result.message },
      });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /lineas/:id
 * Delete a recipe line.
 * Requires gerente level (nivel_acceso >= 5).
 */
router.delete('/lineas/:id', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    // We need producto_id to recalculate cost; get it from the linea first
    const { rows: [linea] } = await req.tenantClient.query(
      `SELECT producto_id FROM recetas WHERE id = $1`,
      [req.params.id]
    );

    if (!linea) {
      return res.status(404).json({
        error: { code: 'LINEA_NOT_FOUND', message: 'Linea de receta no encontrada' },
      });
    }

    const result = await deleteRecetaLinea(req.tenantClient, {
      lineaId: req.params.id,
      productoId: linea.producto_id,
      tenantId: req.tenantId,
    });
    if (result.error) {
      return res.status(result.status).json({
        error: { code: result.code, message: result.message },
      });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
//  Elaborar (Production batch)
// ---------------------------------------------------------------------------

/**
 * POST /:producto_id/elaborar
 * Execute a production batch: deduct ingredients, add finished product.
 * Requires subgerente level (nivel_acceso >= 3).
 */
router.post(
  '/:producto_id/elaborar',
  requireAuth,
  requireRole(3),
  validate(elaborarSchema),
  async (req, res, next) => {
    try {
      const result = await elaborar(req.tenantClient, {
        productoId: req.params.producto_id,
        porciones: req.body.porciones,
        almacenId: req.body.almacen_id,
        tenantId: req.tenantId,
        usuario: req.user.codigo,
        usuarioId: req.user.sub,
        ip: req.ip,
      });
      if (result.error) {
        return res.status(result.status).json({
          error: { code: result.code, message: result.message },
        });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
//  Modificadores
// ---------------------------------------------------------------------------

/**
 * GET /:producto_id/modificadores
 * List all modificadores for a product.
 * Any authenticated user can view.
 */
router.get('/:producto_id/modificadores', requireAuth, async (req, res, next) => {
  try {
    const result = await listModificadores(req.tenantClient, req.params.producto_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /:producto_id/modificadores
 * Add a modificador to a product.
 * Requires gerente level (nivel_acceso >= 5).
 */
router.post(
  '/:producto_id/modificadores',
  requireAuth,
  requireRole(5),
  async (req, res, next) => {
    try {
      const { nombre, precio_extra } = req.body;
      if (!nombre) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Nombre requerido' },
        });
      }
      const result = await addModificador(req.tenantClient, {
        productoId: req.params.producto_id,
        nombre,
        precio_extra,
        tenantId: req.tenantId,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /modificadores/:id
 * Delete a modificador.
 * Requires gerente level (nivel_acceso >= 5).
 */
router.delete('/modificadores/:id', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await deleteModificador(req.tenantClient, req.params.id);
    if (result.error) {
      return res.status(result.status).json({
        error: { code: result.code, message: result.message },
      });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
