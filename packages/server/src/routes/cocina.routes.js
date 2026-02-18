import { Router } from 'express';
import { cocinaCreateSchema, cocinaEstadoSchema } from '@opus/shared/schemas';
import { COCINA_ESTADOS, WS_EVENTS } from '@opus/shared/constants';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, sendResult, auditCtx, emitEvent } from '../helpers/route.js';
import {
  getQueue,
  createQueueItem,
  updateEstado,
  getEstadisticas,
  getHistorial,
} from '../services/kitchen.service.js';

const router = Router();

// ---------------------------------------------------------------------------
//  Queue — KDS live queue
// ---------------------------------------------------------------------------

/**
 * GET /queue
 * Get the KDS queue with real-time urgency calculation.
 */
router.get('/queue', requireAuth, asyncHandler(async (req, res) => {
  const result = await getQueue(req.tenantClient, {
    area: req.query.area,
    estado: req.query.estado,
    tenantId: req.tenantId,
  });
  res.json(result);
}));

/**
 * POST /queue
 * Create a new KDS queue item (send order to kitchen).
 * Broadcasts kds:new event via WebSocket.
 */
router.post('/queue', requireAuth, validate(cocinaCreateSchema), asyncHandler(async (req, res) => {
  const result = await createQueueItem(req.tenantClient, {
    cuentaId: req.body.cuenta_id,
    mesaNumero: req.body.mesa_numero,
    items: req.body.items,
    meseroNombre: req.body.mesero_nombre,
    prioridad: req.body.prioridad,
    area: req.body.area,
    tenantId: req.tenantId,
  });

  emitEvent(req, WS_EVENTS.KDS_NEW, { id: result.id, mesa: result.mesa_numero, items: result.items_json });
  res.status(201).json(result);
}));

// ---------------------------------------------------------------------------
//  Estado — state transitions
// ---------------------------------------------------------------------------

/**
 * PUT /:id/estado
 * Transition the state of a KDS queue item.
 * Requires cocinero level (nivel_acceso >= 3) or higher.
 */
router.put('/:id/estado', requireAuth, requireRole(3), validate(cocinaEstadoSchema), asyncHandler(async (req, res) => {
  const result = await updateEstado(req.tenantClient, {
    queueId: req.params.id,
    estado: req.body.estado,
    ...auditCtx(req),
  });

  if (result.error) return sendResult(res, result);

  emitEvent(req, WS_EVENTS.KDS_UPDATE, { id: req.params.id, estado: req.body.estado });

  if (req.body.estado === COCINA_ESTADOS.LISTO) {
    emitEvent(req, WS_EVENTS.NOTIFICACION_MESERO, {
      tipo: 'orden_lista',
      mesa: result.mesa_numero,
      mensaje: `Orden de mesa ${result.mesa_numero} lista`,
    });
  }

  res.json(result);
}));

// ---------------------------------------------------------------------------
//  Estadisticas — KDS analytics
// ---------------------------------------------------------------------------

/**
 * GET /estadisticas
 * Get KDS performance analytics for a date range.
 * Requires gerente level (nivel_acceso >= 5).
 */
router.get('/estadisticas', requireAuth, requireRole(5), asyncHandler(async (req, res) => {
  const result = await getEstadisticas(req.tenantClient, {
    desde: req.query.desde,
    hasta: req.query.hasta,
    tenantId: req.tenantId,
  });
  res.json(result);
}));

// ---------------------------------------------------------------------------
//  Historial — completed orders history
// ---------------------------------------------------------------------------

/**
 * GET /historial
 * Paginated history of completed (entregado) orders.
 */
router.get('/historial', requireAuth, asyncHandler(async (req, res) => {
  const result = await getHistorial(req.tenantClient, {
    desde: req.query.desde,
    hasta: req.query.hasta,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json(result);
}));

export default router;
