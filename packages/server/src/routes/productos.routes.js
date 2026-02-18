import { Router } from 'express';
import { productoCreateSchema, productoUpdateSchema, grupoCreateSchema, grupoUpdateSchema, paginationSchema } from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import {
  listProductos,
  getProducto,
  createProducto,
  updateProducto,
  deleteProducto,
  listGrupos,
  createGrupo,
  updateGrupo,
  deleteGrupo,
} from '../services/catalog.service.js';

const router = Router();

// ---------------------------------------------------------------------------
//  Productos CRUD
// ---------------------------------------------------------------------------

/**
 * GET /
 * Paginated list of products with optional filters.
 * Any authenticated user can view.
 */
router.get('/', requireAuth, validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const result = await listProductos(req.tenantClient, {
      grupoId: req.query.grupo_id,
      tipo: req.query.tipo,
      activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
//  Grupos CRUD  (MUST be before /:id to avoid route conflict)
// ---------------------------------------------------------------------------

/**
 * GET /grupos/all
 * List all product groups.
 * Any authenticated user can view.
 */
router.get('/grupos/all', requireAuth, async (req, res, next) => {
  try {
    const result = await listGrupos(req.tenantClient);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /grupos
 * Create a product group.
 * Requires gerente level (nivel_acceso >= 5).
 */
router.post('/grupos', requireAuth, requireRole(5), validate(grupoCreateSchema), async (req, res, next) => {
  try {
    const result = await createGrupo(req.tenantClient, {
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
      tenantId: req.tenantId,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /grupos/:id
 * Update a product group.
 * Requires gerente level (nivel_acceso >= 5).
 */
router.put('/grupos/:id', requireAuth, requireRole(5), validate(grupoUpdateSchema), async (req, res, next) => {
  try {
    const result = await updateGrupo(req.tenantClient, {
      grupoId: req.params.id,
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
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
 * DELETE /grupos/:id
 * Delete a product group (hard delete).
 * Requires gerente level (nivel_acceso >= 5).
 */
router.delete('/grupos/:id', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await deleteGrupo(req.tenantClient, req.params.id);
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
//  Single Product  (after /grupos/* to avoid route conflict)
// ---------------------------------------------------------------------------

/**
 * GET /:id
 * Get a single product with grupo name and recipe (if terminado).
 * Any authenticated user can view.
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await getProducto(req.tenantClient, req.params.id);
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
 * POST /
 * Create a new product.
 * Requires gerente level (nivel_acceso >= 5).
 */
router.post(
  '/',
  requireAuth,
  requireRole(5),
  validate(productoCreateSchema),
  async (req, res, next) => {
    try {
      const result = await createProducto(req.tenantClient, {
        ...req.body,
        tenantId: req.tenantId,
        usuario: req.user.codigo,
        usuarioId: req.user.sub,
        ip: req.ip,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /:id
 * Update a product. Only provided fields are changed.
 * Requires gerente level (nivel_acceso >= 5).
 */
router.put(
  '/:id',
  requireAuth,
  requireRole(5),
  validate(productoUpdateSchema),
  async (req, res, next) => {
    try {
      const result = await updateProducto(req.tenantClient, {
        productoId: req.params.id,
        ...req.body,
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

/**
 * DELETE /:id
 * Soft-delete a product (sets activo = false).
 * Requires gerente level (nivel_acceso >= 5).
 */
router.delete('/:id', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await deleteProducto(req.tenantClient, {
      productoId: req.params.id,
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
});

export default router;
