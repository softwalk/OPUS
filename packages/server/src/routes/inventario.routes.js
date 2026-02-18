import { Router } from 'express';
import { movimientoCreateSchema } from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import {
  listAlmacenes,
  createAlmacen,
  getExistencias,
  getExistenciaProducto,
  createMovimiento,
  listMovimientos,
  traspasoAlmacen,
  ajusteInventario,
  getKardex,
} from '../services/inventory.service.js';

const router = Router();

// ---------------------------------------------------------------------------
//  Almacenes (warehouses)
// ---------------------------------------------------------------------------

/**
 * GET /almacenes
 * List all active almacenes for the tenant.
 * Any authenticated user can view.
 */
router.get('/almacenes', requireAuth, async (req, res, next) => {
  try {
    const result = await listAlmacenes(req.tenantClient);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /almacenes
 * Create a new almacen.
 * Requires gerente level (nivel_acceso >= 5).
 */
router.post('/almacenes', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await createAlmacen(req.tenantClient, {
      nombre: req.body.nombre,
      numero: req.body.numero,
      descripcion: req.body.descripcion,
      tenantId: req.tenantId,
    });

    if (result.error) {
      return res.status(result.status).json({
        error: { code: result.code, message: result.message },
      });
    }

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
//  Existencias (stock levels)
// ---------------------------------------------------------------------------

/**
 * GET /existencias
 * List stock levels with optional filters.
 * Query params: almacen_id, producto_id, tipo, solo_con_stock, search
 * Any authenticated user can view.
 */
router.get('/existencias', requireAuth, async (req, res, next) => {
  try {
    const result = await getExistencias(req.tenantClient, {
      almacenId: req.query.almacen_id,
      productoId: req.query.producto_id,
      tipo: req.query.tipo,
      soloConStock: req.query.solo_con_stock === '1',
      search: req.query.search,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /existencias/:producto_id
 * Get stock of a specific product across all almacenes.
 * Any authenticated user can view.
 */
router.get('/existencias/:producto_id', requireAuth, async (req, res, next) => {
  try {
    const result = await getExistenciaProducto(req.tenantClient, req.params.producto_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
//  Movimientos (inventory movements)
// ---------------------------------------------------------------------------

/**
 * POST /movimientos
 * Create an inventory movement (entrada or salida).
 * Requires cajero level (nivel_acceso >= 2).
 * Validates body against movimientoCreateSchema.
 */
router.post(
  '/movimientos',
  requireAuth,
  requireRole(2),
  validate(movimientoCreateSchema),
  async (req, res, next) => {
    try {
      const result = await createMovimiento(req.tenantClient, {
        productoId: req.body.producto_id,
        almacenId: req.body.almacen_id,
        tipo: req.body.tipo,
        cantidad: req.body.cantidad,
        costoUnitario: req.body.costo_unitario,
        referencia: req.body.referencia,
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

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /movimientos
 * List inventory movements with pagination and filters.
 * Query params: producto_id, almacen_id, tipo, desde, hasta, page, limit
 * Any authenticated user can view.
 */
router.get('/movimientos', requireAuth, async (req, res, next) => {
  try {
    const result = await listMovimientos(req.tenantClient, {
      productoId: req.query.producto_id,
      almacenId: req.query.almacen_id,
      tipo: req.query.tipo,
      desde: req.query.desde,
      hasta: req.query.hasta,
      page: req.query.page ? parseInt(req.query.page, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
//  Traspaso (warehouse transfer)
// ---------------------------------------------------------------------------

/**
 * POST /traspaso
 * Transfer stock between almacenes.
 * Requires gerente level (nivel_acceso >= 5).
 */
router.post('/traspaso', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await traspasoAlmacen(req.tenantClient, {
      productoId: req.body.producto_id,
      deAlmacenId: req.body.de_almacen_id,
      aAlmacenId: req.body.a_almacen_id,
      cantidad: req.body.cantidad,
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

// ---------------------------------------------------------------------------
//  Ajuste (physical count adjustment)
// ---------------------------------------------------------------------------

/**
 * POST /ajuste
 * Adjust inventory based on physical count.
 * Requires gerente level (nivel_acceso >= 5).
 */
router.post('/ajuste', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await ajusteInventario(req.tenantClient, {
      productoId: req.body.producto_id,
      almacenId: req.body.almacen_id,
      cantidadReal: req.body.cantidad_real,
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

// ---------------------------------------------------------------------------
//  Kardex (product movement history)
// ---------------------------------------------------------------------------

/**
 * GET /kardex/:producto_id
 * Get chronological movement history for a product with running balance.
 * Query params: almacen_id, desde, hasta
 * Any authenticated user can view.
 */
router.get('/kardex/:producto_id', requireAuth, async (req, res, next) => {
  try {
    const result = await getKardex(req.tenantClient, {
      productoId: req.params.producto_id,
      almacenId: req.query.almacen_id,
      desde: req.query.desde,
      hasta: req.query.hasta,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
