import { Router } from 'express';
import { reservacionCreateSchema, reservacionEstadoSchema } from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import {
  createReservacion,
  listReservaciones,
  getReservacion,
  updateReservacionEstado,
  checkDisponibilidadReservaciones,
  processNoShows,
  releaseExpiredReservations,
  getMesasConReservaciones,
  getReservacionesByMesa,
} from '../services/orders.service.js';

const router = Router();

// ============================================================================
//  GET /disponibilidad — Check available time slots for a date
//  Requires at least mesero level
// ============================================================================

router.get('/disponibilidad', requireAuth, async (req, res, next) => {
  try {
    const result = await checkDisponibilidadReservaciones(req.tenantClient, {
      fecha: req.query.fecha || new Date().toISOString().slice(0, 10),
      personas: req.query.personas ? parseInt(req.query.personas, 10) : 2,
      tenantId: req.tenantId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  GET /mesas-timeline — Get all mesas with their reservations for a date
//  Requires at least mesero level
// ============================================================================

router.get('/mesas-timeline', requireAuth, async (req, res, next) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
    const result = await getMesasConReservaciones(req.tenantClient, fecha);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  GET /mesa/:mesaId — Get upcoming reservations for a specific mesa
// ============================================================================

router.get('/mesa/:mesaId', requireAuth, async (req, res, next) => {
  try {
    const result = await getReservacionesByMesa(req.tenantClient, req.params.mesaId);
    res.json({ reservaciones: result });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  POST /process-no-shows — Manually trigger no-show processing
//  Requires cajero level (nivel >= 2)
// ============================================================================

router.post('/process-no-shows', requireAuth, requireRole(2), async (req, res, next) => {
  try {
    const noShows = await processNoShows(req.tenantClient, req.tenantId);
    const expired = await releaseExpiredReservations(req.tenantClient, req.tenantId);
    res.json({ no_shows: noShows, expired });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  POST / — Create a new reservation
// ============================================================================

router.post(
  '/',
  requireAuth,
  validate(reservacionCreateSchema),
  async (req, res, next) => {
    try {
      const result = await createReservacion(req.tenantClient, {
        clienteNombre: req.body.cliente_nombre,
        clienteTelefono: req.body.cliente_telefono,
        clienteEmail: req.body.cliente_email,
        fecha: req.body.fecha,
        hora: req.body.hora,
        personas: req.body.personas,
        zonaPreferidaId: req.body.zona_preferida_id,
        notas: req.body.notas,
        tenantId: req.tenantId,
      });

      if (result.error) {
        return res.status(result.status).json({
          error: { code: result.code, message: result.message },
          alternativas: result.alternativas || undefined,
        });
      }

      // Broadcast reservation event
      const broadcast = req.app.get('broadcast');
      if (broadcast) {
        broadcast(req.tenantId, 'reservacion:nueva', {
          id: result.id,
          mesa_numero: result.mesa_numero,
          hora: result.hora,
          cliente_nombre: result.cliente_nombre,
        });
      }

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
//  GET / — List reservations with filters (default: today)
// ============================================================================

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await listReservaciones(req.tenantClient, {
      fecha: req.query.fecha,
      estado: req.query.estado,
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  GET /:id — Get a single reservation detail
// ============================================================================

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await getReservacion(req.tenantClient, req.params.id);

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

// ============================================================================
//  PUT /:id/estado — Update reservation status
//  Requires cajero level (nivel_acceso >= 2)
// ============================================================================

router.put(
  '/:id/estado',
  requireAuth,
  requireRole(2),
  validate(reservacionEstadoSchema),
  async (req, res, next) => {
    try {
      const result = await updateReservacionEstado(req.tenantClient, {
        reservacionId: req.params.id,
        estado: req.body.estado,
        mesaId: req.body.mesa_id,
        personas: req.body.personas,
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

      // Broadcast reservation state change
      const broadcast = req.app.get('broadcast');
      if (broadcast) {
        broadcast(req.tenantId, 'reservacion:update', {
          id: result.id,
          estado: result.estado,
          mesa_id: result.mesa_id,
          cuenta_id: result.cuenta?.id || null,
        });
        // Also broadcast mesa update
        if (result.mesa_id) {
          broadcast(req.tenantId, 'mesa:update', { mesa_id: result.mesa_id });
        }
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
