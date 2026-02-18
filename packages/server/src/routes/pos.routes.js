import { Router } from 'express';
import { abrirMesaSchema, consumoCreateSchema, cobrarSchema } from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import {
  listMesas,
  abrirMesa,
  getCuenta,
  listCuentas,
  addConsumo,
  cancelConsumo,
  cobrar,
  precuenta,
  corteCaja,
} from '../services/pos.service.js';

const router = Router();

// ---------------------------------------------------------------------------
//  Mesas
// ---------------------------------------------------------------------------

/**
 * GET /mesas
 * List all mesas with current status for the tenant.
 * Any authenticated user can view.
 */
router.get('/mesas', requireAuth, async (req, res, next) => {
  try {
    const result = await listMesas(req.tenantClient);
    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
    }
    next(err);
  }
});

/**
 * GET /zonas
 * List all zonas (zones / sections) for the tenant.
 * Any authenticated user can view.
 */
router.get('/zonas', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await req.tenantClient.query(
      'SELECT * FROM zonas ORDER BY nombre'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /formas-pago
 * List all payment methods for the tenant.
 * Any authenticated user can view.
 */
router.get('/formas-pago', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await req.tenantClient.query(
      'SELECT * FROM formas_pago ORDER BY nombre'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /mesas/:id/abrir
 * Open a mesa — creates a new cuenta linked to the mesa.
 * Any authenticated user can open a mesa.
 */
router.post(
  '/mesas/:id/abrir',
  requireAuth,
  validate(abrirMesaSchema),
  async (req, res, next) => {
    try {
      // Auto-resolve mesero_id from the logged-in user's codigo if not explicitly provided
      let meseroId = req.body.mesero_id || null;
      if (!meseroId && req.user.codigo) {
        const { rows: [personalMatch] } = await req.tenantClient.query(
          `SELECT id FROM personal WHERE codigo = $1 AND activo = true`,
          [req.user.codigo]
        );
        if (personalMatch) meseroId = personalMatch.id;
      }

      const result = await abrirMesa(req.tenantClient, {
        mesaId: req.params.id,
        personas: req.body.personas,
        meseroId,
        tenantId: req.tenantId,
        usuario: req.user.codigo,
        usuarioId: req.user.sub,
        ip: req.ip,
      });
      res.json(result);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          error: { code: err.code, message: err.message, details: err.details },
        });
      }
      next(err);
    }
  }
);

/**
 * POST /mesas/:id/cerrar
 * Manually close a mesa (e.g. cancel, admin override).
 * Requires cajero level (nivel_acceso >= 2) or higher.
 */
router.post(
  '/mesas/:id/cerrar',
  requireAuth,
  requireRole(2),
  async (req, res, next) => {
    try {
      // Delegate to the service — cerrar is handled as a status change
      const { rows } = await req.tenantClient.query(
        `UPDATE mesas SET estado = 'libre', mesero_id = NULL, personas = 0, abierta_en = NULL
         WHERE id = $1 RETURNING *`,
        [req.params.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          error: { code: 'MESA_NOT_FOUND', message: 'Mesa no encontrada' },
        });
      }

      // Broadcast mesa update via WebSocket
      const broadcast = req.app.get('broadcast');
      if (broadcast) {
        broadcast(req.tenantId, 'mesa:update', {
          mesa_id: req.params.id,
          estado: 'libre',
        });
      }

      res.json(rows[0]);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          error: { code: err.code, message: err.message, details: err.details },
        });
      }
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
//  Cuentas (checks / tabs)
// ---------------------------------------------------------------------------

/**
 * GET /cuentas
 * List cuentas with optional filters: mesa_id, estado.
 * Any authenticated user can view.
 */
router.get('/cuentas', requireAuth, async (req, res, next) => {
  try {
    const result = await listCuentas(req.tenantClient, {
      mesa_id: req.query.mesa_id,
      estado: req.query.estado,
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
    });
    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
    }
    next(err);
  }
});

/**
 * GET /cuentas/:id
 * Get cuenta detail including its consumos (line items).
 * Any authenticated user can view.
 */
router.get('/cuentas/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await getCuenta(req.tenantClient, req.params.id);
    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
//  Consumos (line items / order items)
// ---------------------------------------------------------------------------

/**
 * POST /consumos
 * Add a consumo (item) to an open cuenta.
 * Any authenticated user can add items.
 * The service may return { warning: true } for soft stock stops (200),
 * or throw 409 for hard stock blocks.
 */
router.post(
  '/consumos',
  requireAuth,
  validate(consumoCreateSchema),
  async (req, res, next) => {
    try {
      const result = await addConsumo(req.tenantClient, {
        cuentaId: req.body.cuenta_id,
        productoId: req.body.producto_id,
        cantidad: req.body.cantidad,
        notas: req.body.notas,
        gerenteClave: req.body.gerente_clave,
        tenantId: req.tenantId,
        usuario: req.user.codigo,
        usuarioId: req.user.sub,
        ip: req.ip,
      });
      // If stock warning (soft stop), still return 200 but include warning
      res.json(result);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          error: { code: err.code, message: err.message, details: err.details },
        });
      }
      next(err);
    }
  }
);

/**
 * DELETE /consumos/:id
 * Cancel (void) a consumo.
 * Requires cajero level (nivel_acceso >= 2) or higher.
 */
router.delete(
  '/consumos/:id',
  requireAuth,
  requireRole(2),
  async (req, res, next) => {
    try {
      const result = await cancelConsumo(req.tenantClient, {
        consumoId: req.params.id,
        tenantId: req.tenantId,
        usuario: req.user.codigo,
        usuarioId: req.user.sub,
        ip: req.ip,
      });
      res.json(result);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          error: { code: err.code, message: err.message, details: err.details },
        });
      }
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
//  Cobro & Precuenta (payment & pre-check)
// ---------------------------------------------------------------------------

/**
 * POST /cuentas/:id/cobrar
 * Charge a cuenta — close it and record the payment.
 * Requires cajero level (nivel_acceso >= 2) or higher.
 * Broadcasts mesa:update via WebSocket on success.
 */
router.post(
  '/cuentas/:id/cobrar',
  requireAuth,
  requireRole(2),
  validate(cobrarSchema),
  async (req, res, next) => {
    try {
      const result = await cobrar(req.tenantClient, {
        cuentaId: req.params.id,
        formaPagoId: req.body.forma_pago_id,
        propina: req.body.propina,
        clienteId: req.body.cliente_id,
        tenantId: req.tenantId,
        usuario: req.user.codigo,
        usuarioId: req.user.sub,
        ip: req.ip,
      });

      // Broadcast mesa update so all POS clients refresh the floor plan
      const broadcast = req.app.get('broadcast');
      if (broadcast && result.mesa_id) {
        broadcast(req.tenantId, 'mesa:update', {
          mesa_id: result.mesa_id,
          estado: 'libre',
        });
      }

      res.json(result);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          error: { code: err.code, message: err.message, details: err.details },
        });
      }
      next(err);
    }
  }
);

/**
 * POST /cuentas/:id/precuenta
 * Generate precuenta (pre-check / bill preview) for a cuenta.
 * Any authenticated user can request a precuenta.
 */
router.post(
  '/cuentas/:id/precuenta',
  requireAuth,
  async (req, res, next) => {
    try {
      const result = await precuenta(req.tenantClient, req.params.id);
      res.json(result);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          error: { code: err.code, message: err.message, details: err.details },
        });
      }
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
//  Corte de caja (cash register close / Z-report)
// ---------------------------------------------------------------------------

/**
 * POST /corte-caja
 * Perform a cash register cut (end-of-shift report).
 * Requires cajero level (nivel_acceso >= 2) or higher.
 */
router.post(
  '/corte-caja',
  requireAuth,
  requireRole(2),
  async (req, res, next) => {
    try {
      const result = await corteCaja(req.tenantClient, {
        tenantId: req.tenantId,
        usuario: req.user.codigo,
        usuarioId: req.user.sub,
        ip: req.ip,
      });
      res.json(result);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          error: { code: err.code, message: err.message, details: err.details },
        });
      }
      next(err);
    }
  }
);

export default router;
