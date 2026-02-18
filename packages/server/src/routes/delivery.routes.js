import { Router } from 'express';
import { zonaEntregaCreateSchema, zonaEntregaUpdateSchema } from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, sendResult } from '../helpers/route.js';
import {
  listZonasEntrega,
  createZonaEntrega,
  updateZonaEntrega,
} from '../services/orders.service.js';

const router = Router();

// GET /zonas — List active delivery zones
router.get('/zonas', requireAuth, asyncHandler(async (req, res) => {
  const result = await listZonasEntrega(req.tenantClient);
  res.json(result);
}));

// POST /zonas — Create a new delivery zone (admin level >= 5)
router.post('/zonas', requireAuth, requireRole(5), validate(zonaEntregaCreateSchema), asyncHandler(async (req, res) => {
  const result = await createZonaEntrega(req.tenantClient, {
    nombre: req.body.nombre,
    costoEnvio: req.body.costo_envio,
    tiempoEstimadoMin: req.body.tiempo_estimado_min,
    descripcion: req.body.descripcion,
    tenantId: req.tenantId,
  });
  if (result.error) return sendResult(res, result);
  res.status(201).json(result);
}));

// PUT /zonas/:id — Update a delivery zone (admin level >= 5)
router.put('/zonas/:id', requireAuth, requireRole(5), validate(zonaEntregaUpdateSchema), asyncHandler(async (req, res) => {
  const result = await updateZonaEntrega(req.tenantClient, {
    zonaId: req.params.id,
    nombre: req.body.nombre,
    costoEnvio: req.body.costo_envio,
    tiempoEstimadoMin: req.body.tiempo_estimado_min,
    descripcion: req.body.descripcion,
    activa: req.body.activa,
  });
  sendResult(res, result);
}));

export default router;
