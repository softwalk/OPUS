import { Router } from 'express';
import { dateRangeSchema, explosionBOMSchema } from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import {
  foodCost,
  desviaciones,
  explosionBOM,
  recalcularCostos,
} from '../services/reports.service.js';

const router = Router();

// ============================================================================
//  FOOD COST
// ============================================================================

/**
 * GET /food-cost
 * Food cost analysis by product for a date range.
 * Nivel >= 5 (subgerente+).
 */
router.get('/food-cost', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const { desde, hasta } = dateRangeSchema.parse(req.query);
    const result = await foodCost(req.tenantClient, { desde, hasta });
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Parámetros de fecha inválidos', details: err.issues },
      });
    }
    next(err);
  }
});

// ============================================================================
//  DESVIACIONES (Theoretical vs Real)
// ============================================================================

/**
 * GET /desviaciones
 * Compare theoretical vs real ingredient consumption.
 * Nivel >= 5.
 */
router.get('/desviaciones', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const { desde, hasta } = dateRangeSchema.parse(req.query);
    const result = await desviaciones(req.tenantClient, { desde, hasta });
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  EXPLOSION BOM
// ============================================================================

/**
 * POST /explosion
 * Calculate total raw materials for a product batch.
 * Nivel >= 2 (cajero+).
 */
router.post('/explosion', requireAuth, requireRole(2), validate(explosionBOMSchema), async (req, res, next) => {
  try {
    const result = await explosionBOM(req.tenantClient, {
      producto_id: req.body.producto_id,
      porciones: req.body.porciones,
    });
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  RECALCULAR COSTOS
// ============================================================================

/**
 * POST /recalcular
 * Recalculate costo_unitario for all products with recipes.
 * Nivel >= 5 (subgerente+).
 */
router.post('/recalcular', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await recalcularCostos(req.tenantClient);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
