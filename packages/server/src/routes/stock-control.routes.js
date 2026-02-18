import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { verificarStockSchema, marcar86Schema } from '@opus/shared/schemas';
import { query } from '../db/pool.js';
import { getTenantClient } from '../db/tenant.js';
import { asyncHandler, auditCtx, emitEvent } from '../helpers/route.js';
import {
  getDisponibilidad,
  verificarStock,
  marcar86,
  desmarcar86,
  listar86,
  getVentasPerdidas,
  getAlertas,
  scanAlertas,
  getMenuDisponible,
  getSobregiros,
} from '../services/stock-control.service.js';

const router = Router();

// DISPONIBILIDAD — stock real con porciones
router.get('/disponibilidad', requireAuth, asyncHandler(async (req, res) => {
  res.json(await getDisponibilidad(req.tenantClient, {
    grupoId: req.query.grupo_id,
    soloAgotados: req.query.solo_agotados === '1',
  }));
}));

// VERIFICAR STOCK — pre-sale check
router.post('/verificar', requireAuth, validate(verificarStockSchema), asyncHandler(async (req, res) => {
  res.json(await verificarStock(req.tenantClient, {
    productoId: req.body.producto_id,
    cantidad: req.body.cantidad,
    gerenteClave: req.body.gerente_clave,
    tenantId: req.tenantId,
  }));
}));

// MARCAR 86 — mark product as unavailable
router.post('/86', requireAuth, requireRole(3), validate(marcar86Schema), asyncHandler(async (req, res) => {
  const result = await marcar86(req.tenantClient, {
    productoId: req.body.producto_id,
    motivo: req.body.motivo,
    responsable: req.body.responsable,
    ...auditCtx(req),
  });

  emitEvent(req, 'stock:86', { producto_id: req.body.producto_id, producto: result.producto });
  res.json(result);
}));

// DESMARCAR 86 — restore product
router.delete('/86/:producto_id', requireAuth, requireRole(3), asyncHandler(async (req, res) => {
  const result = await desmarcar86(req.tenantClient, {
    productoId: req.params.producto_id,
    ...auditCtx(req),
  });

  emitEvent(req, 'stock:update', { producto_id: req.params.producto_id, producto: result.producto });
  res.json(result);
}));

// LISTAR 86 — current 86 products
router.get('/86', requireAuth, asyncHandler(async (req, res) => {
  res.json(await listar86(req.tenantClient));
}));

// VENTAS PERDIDAS — lost sales analysis
router.get('/ventas-perdidas', requireAuth, requireRole(5), asyncHandler(async (req, res) => {
  res.json(await getVentasPerdidas(req.tenantClient, {
    desde: req.query.desde,
    hasta: req.query.hasta,
    limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
  }));
}));

// ALERTAS — stock alerts
router.get('/alertas', requireAuth, asyncHandler(async (req, res) => {
  res.json(await getAlertas(req.tenantClient, {
    soloPendientes: req.query.solo_pendientes === '1',
  }));
}));

// SCAN ALERTAS — automatic stock scan
router.post('/scan-alertas', requireAuth, requireRole(5), asyncHandler(async (req, res) => {
  res.json(await scanAlertas(req.tenantClient, { tenantId: req.tenantId }));
}));

// MENU DISPONIBLE — public endpoint for client-app (no auth)
router.get('/menu-disponible', asyncHandler(async (req, res) => {
  const slug = req.query.tenant;
  if (!slug) {
    return res.status(400).json({
      error: { code: 'TENANT_REQUIRED', message: 'Parametro tenant requerido' },
    });
  }

  const { rows: [tenant] } = await query(
    'SELECT id FROM tenants WHERE slug = $1 AND activo = true',
    [slug],
  );
  if (!tenant) {
    return res.status(404).json({
      error: { code: 'TENANT_NOT_FOUND', message: 'Restaurante no encontrado' },
    });
  }

  const client = await getTenantClient(tenant.id);
  try {
    res.json(await getMenuDisponible(client));
  } finally {
    client.release();
  }
}));

// SOBREGIROS — override history
router.get('/sobregiros', requireAuth, requireRole(5), asyncHandler(async (req, res) => {
  res.json(await getSobregiros(req.tenantClient, {
    desde: req.query.desde,
    hasta: req.query.hasta,
  }));
}));

export default router;
