import { Router } from 'express';
import { ordenCreateSchema, ordenEstadoSchema } from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import {
  createOrden,
  getOrden,
  listOrdenes,
  updateEstadoOrden,
} from '../services/orders.service.js';

const router = Router();

// ============================================================================
//  POST / — Create a new digital order
//  Broadcasts 'orden:nueva' to all connected clients for the tenant
// ============================================================================

router.post(
  '/',
  requireAuth,
  validate(ordenCreateSchema),
  async (req, res, next) => {
    try {
      const result = await createOrden(req.tenantClient, {
        tipo: req.body.tipo,
        mesaId: req.body.mesa_id,
        clienteNombre: req.body.cliente_nombre,
        clienteTelefono: req.body.cliente_telefono,
        direccionEntrega: req.body.direccion_entrega,
        zonaEntregaId: req.body.zona_entrega_id,
        items: req.body.items,
        notas: req.body.notas,
        formaPago: req.body.forma_pago,
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

      // Broadcast new order to all connected clients
      const broadcast = req.app.get('broadcast');
      if (broadcast) {
        broadcast(req.tenantId, 'orden:nueva', {
          orden_id: result.id,
          tipo: result.tipo,
          estado: result.estado,
          total: result.total,
        });
      }

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
//  GET / — List digital orders with pagination and filters
// ============================================================================

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await listOrdenes(req.tenantClient, {
      tipo: req.query.tipo,
      estado: req.query.estado,
      desde: req.query.desde,
      hasta: req.query.hasta,
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  GET /:id — Get a single digital order with items
// ============================================================================

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await getOrden(req.tenantClient, req.params.id);

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
//  PUT /:id/estado — Update digital order status
//  Requires cajero level (nivel_acceso >= 2)
//  Broadcasts 'orden:update' to all connected clients for the tenant
// ============================================================================

router.put(
  '/:id/estado',
  requireAuth,
  requireRole(2),
  validate(ordenEstadoSchema),
  async (req, res, next) => {
    try {
      const result = await updateEstadoOrden(req.tenantClient, {
        ordenId: req.params.id,
        estado: req.body.estado,
        motivo: req.body.motivo,
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

      // Broadcast order update to all connected clients
      const broadcast = req.app.get('broadcast');
      if (broadcast) {
        broadcast(req.tenantId, 'orden:update', {
          orden_id: result.id,
          estado: result.estado,
        });
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
