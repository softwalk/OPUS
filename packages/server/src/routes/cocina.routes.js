import { Router } from 'express';
import { cocinaCreateSchema, cocinaEstadoSchema } from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
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
 * Optional query filters: area (area_produccion), estado.
 * Any authenticated user can view the queue.
 */
router.get('/queue', requireAuth, async (req, res, next) => {
  try {
    const result = await getQueue(req.tenantClient, {
      area: req.query.area,
      estado: req.query.estado,
      tenantId: req.tenantId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /queue
 * Create a new KDS queue item (send order to kitchen).
 * Any authenticated user can create queue items.
 * Broadcasts kds:new event via WebSocket.
 */
router.post(
  '/queue',
  requireAuth,
  validate(cocinaCreateSchema),
  async (req, res, next) => {
    try {
      const result = await createQueueItem(req.tenantClient, {
        cuentaId: req.body.cuenta_id,
        mesaNumero: req.body.mesa_numero,
        items: req.body.items,
        meseroNombre: req.body.mesero_nombre,
        prioridad: req.body.prioridad,
        area: req.body.area,
        tenantId: req.tenantId,
      });

      // Broadcast new queue item to all KDS screens
      const broadcast = req.app.get('broadcast');
      if (broadcast) {
        broadcast(req.tenantId, 'kds:new', {
          id: result.id,
          mesa: result.mesa_numero,
          items: result.items_json,
        });
      }

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
//  Estado — state transitions
// ---------------------------------------------------------------------------

/**
 * PUT /:id/estado
 * Transition the state of a KDS queue item.
 * Requires cocinero level (nivel_acceso >= 3) or higher.
 * Broadcasts kds:update event via WebSocket.
 * When marking as 'listo', also sends notificacion:mesero.
 */
router.put(
  '/:id/estado',
  requireAuth,
  requireRole(3),
  validate(cocinaEstadoSchema),
  async (req, res, next) => {
    try {
      const result = await updateEstado(req.tenantClient, {
        queueId: req.params.id,
        estado: req.body.estado,
        tenantId: req.tenantId,
        usuario: req.user.codigo,
        usuarioId: req.user.sub,
        ip: req.ip,
      });

      // Handle service-level errors (returned as objects with error: true)
      if (result.error) {
        return res.status(result.status).json({
          error: { code: result.code, message: result.message },
        });
      }

      // Broadcast state change to all KDS screens
      const broadcast = req.app.get('broadcast');
      if (broadcast) {
        broadcast(req.tenantId, 'kds:update', {
          id: req.params.id,
          estado: req.body.estado,
        });

        // If marked as 'listo', also notify the waiter
        if (req.body.estado === 'listo') {
          broadcast(req.tenantId, 'notificacion:mesero', {
            tipo: 'orden_lista',
            mesa: result.mesa_numero,
            mensaje: `Orden de mesa ${result.mesa_numero} lista`,
          });
        }
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
//  Estadisticas — KDS analytics
// ---------------------------------------------------------------------------

/**
 * GET /estadisticas
 * Get KDS performance analytics for a date range.
 * Requires gerente level (nivel_acceso >= 5) or higher.
 * Query params: desde, hasta (ISO date strings).
 */
router.get(
  '/estadisticas',
  requireAuth,
  requireRole(5),
  async (req, res, next) => {
    try {
      const result = await getEstadisticas(req.tenantClient, {
        desde: req.query.desde,
        hasta: req.query.hasta,
        tenantId: req.tenantId,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
//  Historial — completed orders history
// ---------------------------------------------------------------------------

/**
 * GET /historial
 * Paginated history of completed (entregado) orders.
 * Any authenticated user can view history.
 * Query params: desde, hasta, page, limit.
 */
router.get('/historial', requireAuth, async (req, res, next) => {
  try {
    const result = await getHistorial(req.tenantClient, {
      desde: req.query.desde,
      hasta: req.query.hasta,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
