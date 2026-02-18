import { Router } from 'express';
import { dateRangeSchema, paginationSchema } from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import {
  ventasDia,
  ventasPeriodo,
  ventasMesero,
  ventasProducto,
  ventasHora,
  comparativo,
  dashboardResumen,
  getAuditoria,
} from '../services/reports.service.js';

const router = Router();

// ============================================================================
//  DASHBOARD
// ============================================================================

/**
 * GET /dashboard
 * General dashboard KPIs. Nivel >= 5 (subgerente+).
 */
router.get('/dashboard', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await dashboardResumen(req.tenantClient);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /dashboard-mesero
 * Limited dashboard for waiters — only mesas, KDS, ordenes.
 * No financial data exposed.
 */
router.get('/dashboard-mesero', requireAuth, async (req, res, next) => {
  try {
    const { rows: [mesasOcupadas] } = await req.tenantClient.query(
      `SELECT
         COUNT(CASE WHEN estado = 'ocupada' THEN 1 END)::integer AS ocupadas,
         COUNT(CASE WHEN estado = 'reservada' THEN 1 END)::integer AS reservadas,
         COUNT(CASE WHEN estado = 'libre' THEN 1 END)::integer AS libres,
         COUNT(*)::integer AS total
       FROM mesas`
    );
    const { rows: [kdsPendientes] } = await req.tenantClient.query(
      `SELECT COUNT(*)::integer AS total
       FROM cocina_queue
       WHERE estado IN ('pendiente', 'en_preparacion')`
    );
    const { rows: [cuentasAbiertas] } = await req.tenantClient.query(
      `SELECT COUNT(*)::integer AS total FROM cuentas WHERE estado = 'abierta'`
    );
    res.json({
      mesas: mesasOcupadas,
      kds_pendientes: kdsPendientes.total,
      cuentas_abiertas: cuentasAbiertas.total,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  VENTAS
// ============================================================================

/**
 * GET /ventas-dia
 * Sales summary for a single day. Defaults to today.
 * Nivel >= 5 (subgerente+).
 */
router.get('/ventas-dia', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await ventasDia(req.tenantClient, { fecha: req.query.fecha });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /ventas-periodo
 * Sales summary for a date range, grouped by day.
 * Nivel >= 5.
 */
router.get('/ventas-periodo', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const { desde, hasta } = dateRangeSchema.parse(req.query);
    const result = await ventasPeriodo(req.tenantClient, { desde, hasta });
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

/**
 * GET /ventas-mesero
 * Sales by mesero for a date range.
 * Nivel >= 5.
 */
router.get('/ventas-mesero', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const { desde, hasta } = dateRangeSchema.parse(req.query);
    const result = await ventasMesero(req.tenantClient, { desde, hasta });
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /ventas-producto
 * Sales by product for a date range.
 * Nivel >= 5.
 */
router.get('/ventas-producto', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const { desde, hasta } = dateRangeSchema.parse(req.query);
    const result = await ventasProducto(req.tenantClient, { desde, hasta });
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /ventas-hora
 * Sales by hour for a date range.
 * Nivel >= 5.
 */
router.get('/ventas-hora', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const { desde, hasta } = dateRangeSchema.parse(req.query);
    const result = await ventasHora(req.tenantClient, { desde, hasta });
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /comparativo
 * Compare two date ranges. Query params: p1_desde, p1_hasta, p2_desde, p2_hasta.
 * Nivel >= 5.
 */
router.get('/comparativo', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await comparativo(req.tenantClient, {
      periodo1_desde: req.query.p1_desde,
      periodo1_hasta: req.query.p1_hasta,
      periodo2_desde: req.query.p2_desde,
      periodo2_hasta: req.query.p2_hasta,
    });
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  AUDITORIA
// ============================================================================

/**
 * GET /auditoria
 * Audit trail with filters. Gerente only (nivel 9).
 */
router.get('/auditoria', requireAuth, requireRole(9), async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const { desde, hasta } = dateRangeSchema.parse(req.query);
    const result = await getAuditoria(req.tenantClient, {
      page,
      limit,
      tabla: req.query.tabla,
      accion: req.query.accion,
      usuario: req.query.usuario,
      desde,
      hasta,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
