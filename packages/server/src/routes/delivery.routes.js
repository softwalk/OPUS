import { Router } from 'express';
import { zonaEntregaCreateSchema, zonaEntregaUpdateSchema } from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import {
  listZonasEntrega,
  createZonaEntrega,
  updateZonaEntrega,
} from '../services/orders.service.js';

const router = Router();

// ============================================================================
//  GET /zonas — List active delivery zones
// ============================================================================

router.get('/zonas', requireAuth, async (req, res, next) => {
  try {
    const result = await listZonasEntrega(req.tenantClient);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  POST /zonas — Create a new delivery zone
//  Requires admin level (nivel_acceso >= 5)
// ============================================================================

router.post(
  '/zonas',
  requireAuth,
  requireRole(5),
  validate(zonaEntregaCreateSchema),
  async (req, res, next) => {
    try {
      const result = await createZonaEntrega(req.tenantClient, {
        nombre: req.body.nombre,
        costoEnvio: req.body.costo_envio,
        tiempoEstimadoMin: req.body.tiempo_estimado_min,
        descripcion: req.body.descripcion,
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

// ============================================================================
//  PUT /zonas/:id — Update a delivery zone
//  Requires admin level (nivel_acceso >= 5)
// ============================================================================

router.put(
  '/zonas/:id',
  requireAuth,
  requireRole(5),
  validate(zonaEntregaUpdateSchema),
  async (req, res, next) => {
    try {
      const result = await updateZonaEntrega(req.tenantClient, {
        zonaId: req.params.id,
        nombre: req.body.nombre,
        costoEnvio: req.body.costo_envio,
        tiempoEstimadoMin: req.body.tiempo_estimado_min,
        descripcion: req.body.descripcion,
        activa: req.body.activa,
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

export default router;
