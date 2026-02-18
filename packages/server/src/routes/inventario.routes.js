import { Router } from 'express';
import { movimientoCreateSchema, traspasoSchema, ajusteSchema } from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, sendResult, auditCtx } from '../helpers/route.js';
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

router.get('/almacenes', requireAuth, asyncHandler(async (req, res) => {
  res.json(await listAlmacenes(req.tenantClient));
}));

router.post('/almacenes', requireAuth, requireRole(5), asyncHandler(async (req, res) => {
  const result = await createAlmacen(req.tenantClient, {
    nombre: req.body.nombre,
    numero: req.body.numero,
    descripcion: req.body.descripcion,
    tenantId: req.tenantId,
  });
  if (result.error) return sendResult(res, result);
  res.status(201).json(result);
}));

// ---------------------------------------------------------------------------
//  Existencias (stock levels)
// ---------------------------------------------------------------------------

router.get('/existencias', requireAuth, asyncHandler(async (req, res) => {
  res.json(await getExistencias(req.tenantClient, {
    almacenId: req.query.almacen_id,
    productoId: req.query.producto_id,
    tipo: req.query.tipo,
    soloConStock: req.query.solo_con_stock === '1',
    search: req.query.search,
  }));
}));

router.get('/existencias/:producto_id', requireAuth, asyncHandler(async (req, res) => {
  res.json(await getExistenciaProducto(req.tenantClient, req.params.producto_id));
}));

// ---------------------------------------------------------------------------
//  Movimientos (inventory movements)
// ---------------------------------------------------------------------------

router.post('/movimientos', requireAuth, requireRole(2), validate(movimientoCreateSchema), asyncHandler(async (req, res) => {
  const result = await createMovimiento(req.tenantClient, {
    productoId: req.body.producto_id,
    almacenId: req.body.almacen_id,
    tipo: req.body.tipo,
    cantidad: req.body.cantidad,
    costoUnitario: req.body.costo_unitario,
    referencia: req.body.referencia,
    ...auditCtx(req),
  });
  if (result.error) return sendResult(res, result);
  res.status(201).json(result);
}));

router.get('/movimientos', requireAuth, asyncHandler(async (req, res) => {
  res.json(await listMovimientos(req.tenantClient, {
    productoId: req.query.producto_id,
    almacenId: req.query.almacen_id,
    tipo: req.query.tipo,
    desde: req.query.desde,
    hasta: req.query.hasta,
    page: req.query.page ? parseInt(req.query.page, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
  }));
}));

// ---------------------------------------------------------------------------
//  Traspaso (warehouse transfer)
// ---------------------------------------------------------------------------

router.post('/traspaso', requireAuth, requireRole(5), validate(traspasoSchema), asyncHandler(async (req, res) => {
  const result = await traspasoAlmacen(req.tenantClient, {
    productoId: req.body.producto_id,
    deAlmacenId: req.body.de_almacen_id,
    aAlmacenId: req.body.a_almacen_id,
    cantidad: req.body.cantidad,
    ...auditCtx(req),
  });
  sendResult(res, result);
}));

// ---------------------------------------------------------------------------
//  Ajuste (physical count adjustment)
// ---------------------------------------------------------------------------

router.post('/ajuste', requireAuth, requireRole(5), validate(ajusteSchema), asyncHandler(async (req, res) => {
  const result = await ajusteInventario(req.tenantClient, {
    productoId: req.body.producto_id,
    almacenId: req.body.almacen_id,
    cantidadReal: req.body.cantidad_real,
    ...auditCtx(req),
  });
  sendResult(res, result);
}));

// ---------------------------------------------------------------------------
//  Kardex (product movement history)
// ---------------------------------------------------------------------------

router.get('/kardex/:producto_id', requireAuth, asyncHandler(async (req, res) => {
  res.json(await getKardex(req.tenantClient, {
    productoId: req.params.producto_id,
    almacenId: req.query.almacen_id,
    desde: req.query.desde,
    hasta: req.query.hasta,
  }));
}));

export default router;
