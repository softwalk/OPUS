import { Router } from 'express';
import {
  acumularPuntosSchema,
  canjearPuntosSchema,
  fidelizacionConfigSchema,
  paginationSchema,
  dateRangeSchema,
} from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import {
  getConfig,
  updateConfig,
  acumular,
  canjear,
  getHistorial,
  getRanking,
  getClienteLoyalty,
} from '../services/loyalty.service.js';

const router = Router();

// ---------------------------------------------------------------------------
//  Loyalty Config
// ---------------------------------------------------------------------------

/**
 * GET /config
 * Retrieve the loyalty configuration for the current tenant.
 * Nivel >= 5 (subgerente/gerente).
 */
router.get('/config', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await getConfig(req.tenantClient, req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /config
 * Update the loyalty configuration. Gerente only (nivel 9).
 */
router.put(
  '/config',
  requireAuth,
  requireRole(9),
  validate(fidelizacionConfigSchema),
  async (req, res, next) => {
    try {
      const result = await updateConfig(req.tenantClient, {
        tenantId: req.tenantId,
        ...req.body,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
//  Acumular / Canjear
// ---------------------------------------------------------------------------

/**
 * POST /acumular
 * Accumulate loyalty points for a client.
 * Nivel >= 2 (cajero+).
 */
router.post(
  '/acumular',
  requireAuth,
  requireRole(2),
  validate(acumularPuntosSchema),
  async (req, res, next) => {
    try {
      const result = await acumular(req.tenantClient, {
        clienteId: req.body.cliente_id,
        monto: req.body.monto,
        cuentaId: req.body.cuenta_id,
        tenantId: req.tenantId,
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
 * POST /canjear
 * Redeem loyalty points for a client.
 * Nivel >= 2 (cajero+).
 */
router.post(
  '/canjear',
  requireAuth,
  requireRole(2),
  validate(canjearPuntosSchema),
  async (req, res, next) => {
    try {
      const result = await canjear(req.tenantClient, {
        clienteId: req.body.cliente_id,
        puntos: req.body.puntos,
        tenantId: req.tenantId,
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

// ---------------------------------------------------------------------------
//  Historial / Ranking / Cliente
// ---------------------------------------------------------------------------

/**
 * GET /historial/:cliente_id
 * Retrieve point transaction history for a specific client.
 * Any authenticated user.
 */
router.get('/historial/:cliente_id', requireAuth, async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const { desde, hasta } = dateRangeSchema.parse(req.query);

    const result = await getHistorial(req.tenantClient, {
      clienteId: req.params.cliente_id,
      desde,
      hasta,
      page,
      limit,
    });
    res.json(result);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parámetros de consulta inválidos',
          details: err.issues,
        },
      });
    }
    next(err);
  }
});

/**
 * GET /ranking
 * Get top clients by accumulated loyalty points.
 * Nivel >= 5 (subgerente/gerente).
 */
router.get('/ranking', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const result = await getRanking(req.tenantClient, { limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /cliente/:id
 * Get a single client's loyalty status (points, tier, summary).
 * Any authenticated user.
 */
router.get('/cliente/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await getClienteLoyalty(req.tenantClient, req.params.id);
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
