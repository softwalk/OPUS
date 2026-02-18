import { Router } from 'express';
import { qrGenerateSchema } from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { query as poolQuery } from '../db/pool.js';
import {
  resolveQR,
  generateQR,
} from '../services/orders.service.js';

const router = Router();

// ============================================================================
//  GET /:token — Resolve QR token to mesa + tenant info
//  PUBLIC endpoint (no auth required)
//  Uses raw pool query (no RLS tenant context) because the token
//  must be resolved before we know which tenant it belongs to
// ============================================================================

router.get('/:token', async (req, res, next) => {
  try {
    const result = await resolveQR(poolQuery, req.params.token);

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
//  POST /generate — Generate a new QR token for a mesa
//  Requires admin level (nivel_acceso >= 5)
// ============================================================================

router.post(
  '/generate',
  requireAuth,
  requireRole(5),
  validate(qrGenerateSchema),
  async (req, res, next) => {
    try {
      const result = await generateQR(req.tenantClient, {
        mesaId: req.body.mesa_id,
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
  }
);

export default router;
