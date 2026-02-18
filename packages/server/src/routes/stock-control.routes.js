import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { verificarStockSchema, marcar86Schema } from '@opus/shared/schemas';
import { query } from '../db/pool.js';
import { getTenantClient } from '../db/tenant.js';
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

// ==========================================
// DISPONIBILIDAD — stock real con porciones
// ==========================================

router.get('/disponibilidad', requireAuth, async (req, res, next) => {
  try {
    const result = await getDisponibilidad(req.tenantClient, {
      grupoId: req.query.grupo_id,
      soloAgotados: req.query.solo_agotados === '1',
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ==========================================
// VERIFICAR STOCK — pre-sale check
// ==========================================

router.post('/verificar', requireAuth, validate(verificarStockSchema), async (req, res, next) => {
  try {
    const result = await verificarStock(req.tenantClient, {
      productoId: req.body.producto_id,
      cantidad: req.body.cantidad,
      gerenteClave: req.body.gerente_clave,
      tenantId: req.tenantId,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ==========================================
// MARCAR 86 — mark product as unavailable
// ==========================================

router.post('/86', requireAuth, requireRole(3), validate(marcar86Schema), async (req, res, next) => {
  try {
    const result = await marcar86(req.tenantClient, {
      productoId: req.body.producto_id,
      motivo: req.body.motivo,
      responsable: req.body.responsable,
      tenantId: req.tenantId,
      usuario: req.user.codigo,
      usuarioId: req.user.sub,
      ip: req.ip,
    });

    // Broadcast stock:86 event to all connected clients
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast(req.tenantId, 'stock:86', {
        producto_id: req.body.producto_id,
        producto: result.producto,
      });
    }

    res.json(result);
  } catch (err) { next(err); }
});

// ==========================================
// DESMARCAR 86 — restore product
// ==========================================

router.delete('/86/:producto_id', requireAuth, requireRole(3), async (req, res, next) => {
  try {
    const result = await desmarcar86(req.tenantClient, {
      productoId: req.params.producto_id,
      tenantId: req.tenantId,
      usuario: req.user.codigo,
      usuarioId: req.user.sub,
      ip: req.ip,
    });

    // Broadcast stock:update event to all connected clients
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast(req.tenantId, 'stock:update', {
        producto_id: req.params.producto_id,
        producto: result.producto,
      });
    }

    res.json(result);
  } catch (err) { next(err); }
});

// ==========================================
// LISTAR 86 — current 86 products
// ==========================================

router.get('/86', requireAuth, async (req, res, next) => {
  try {
    const result = await listar86(req.tenantClient);
    res.json(result);
  } catch (err) { next(err); }
});

// ==========================================
// VENTAS PERDIDAS — lost sales analysis
// ==========================================

router.get('/ventas-perdidas', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await getVentasPerdidas(req.tenantClient, {
      desde: req.query.desde,
      hasta: req.query.hasta,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ==========================================
// ALERTAS — stock alerts
// ==========================================

router.get('/alertas', requireAuth, async (req, res, next) => {
  try {
    const result = await getAlertas(req.tenantClient, {
      soloPendientes: req.query.solo_pendientes === '1',
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ==========================================
// SCAN ALERTAS — automatic stock scan
// ==========================================

router.post('/scan-alertas', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await scanAlertas(req.tenantClient, {
      tenantId: req.tenantId,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ==========================================
// MENU DISPONIBLE — public endpoint for client-app
// Requires tenant slug via query param (no auth)
// ==========================================

router.get('/menu-disponible', async (req, res, next) => {
  try {
    const slug = req.query.tenant;

    if (!slug) {
      return res.status(400).json({
        error: {
          code: 'TENANT_REQUIRED',
          message: 'Parametro tenant requerido',
        },
      });
    }

    // Resolve tenant from slug (no RLS needed for this lookup)
    const { rows: [tenant] } = await query(
      'SELECT id FROM tenants WHERE slug = $1 AND activo = true',
      [slug],
    );

    if (!tenant) {
      return res.status(404).json({
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'Restaurante no encontrado',
        },
      });
    }

    // Acquire a tenant-scoped client for the menu query
    const client = await getTenantClient(tenant.id);
    try {
      const result = await getMenuDisponible(client);
      res.json(result);
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// ==========================================
// SOBREGIROS — override history
// ==========================================

router.get('/sobregiros', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await getSobregiros(req.tenantClient, {
      desde: req.query.desde,
      hasta: req.query.hasta,
    });
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
