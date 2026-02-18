import { Router } from 'express';
import {
  clienteCreateSchema,
  clienteUpdateSchema,
  proveedorCreateSchema,
  proveedorUpdateSchema,
  compraCreateSchema,
  abonarSchema,
  polizaCreateSchema,
  personalCreateSchema,
  personalUpdateSchema,
  facturaCreateSchema,
  asistenciaSchema,
  paginationSchema,
  dateRangeSchema,
} from '@opus/shared/schemas';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import {
  listClientes,
  getCliente,
  createCliente,
  updateCliente,
  listProveedores,
  getProveedor,
  createProveedor,
  updateProveedor,
  listCompras,
  getCompra,
  createCompra,
  recibirCompra,
  cancelarCompra,
  listCxC,
  createCxC,
  abonarCxC,
  listCxP,
  abonarCxP,
  listFacturas,
  createFactura,
  listPolizas,
  createPoliza,
  listPersonal,
  getPersonal,
  createPersonal,
  updatePersonal,
  registrarAsistencia,
  getAsistencia,
  getDashboardFinanciero,
} from '../services/finance.service.js';

const router = Router();

// ============================================================================
//  CLIENTES
// ============================================================================

router.get('/clientes', requireAuth, async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await listClientes(req.tenantClient, { page, limit, search: req.query.search });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/clientes/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await getCliente(req.tenantClient, req.params.id);
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/clientes', requireAuth, requireRole(5), validate(clienteCreateSchema), async (req, res, next) => {
  try {
    const result = await createCliente(req.tenantClient, { ...req.body, tenantId: req.tenantId });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/clientes/:id', requireAuth, requireRole(5), validate(clienteUpdateSchema), async (req, res, next) => {
  try {
    const result = await updateCliente(req.tenantClient, req.params.id, req.body);
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  PROVEEDORES
// ============================================================================

router.get('/proveedores', requireAuth, async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await listProveedores(req.tenantClient, { page, limit, search: req.query.search });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/proveedores/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await getProveedor(req.tenantClient, req.params.id);
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/proveedores', requireAuth, requireRole(5), validate(proveedorCreateSchema), async (req, res, next) => {
  try {
    const result = await createProveedor(req.tenantClient, { ...req.body, tenantId: req.tenantId });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/proveedores/:id', requireAuth, requireRole(5), validate(proveedorUpdateSchema), async (req, res, next) => {
  try {
    const result = await updateProveedor(req.tenantClient, req.params.id, req.body);
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  ORDENES DE COMPRA
// ============================================================================

router.get('/compras', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await listCompras(req.tenantClient, { page, limit, estado: req.query.estado });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/compras/:id', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await getCompra(req.tenantClient, req.params.id);
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/compras', requireAuth, requireRole(5), validate(compraCreateSchema), async (req, res, next) => {
  try {
    const result = await createCompra(req.tenantClient, { ...req.body, tenantId: req.tenantId });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/compras/:id/recibir', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await recibirCompra(req.tenantClient, req.params.id, {
      almacen_id: req.body.almacen_id,
      tenantId: req.tenantId,
      usuario: req.user.codigo,
      usuarioId: req.user.sub,
      ip: req.ip,
    });
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/compras/:id/cancelar', requireAuth, requireRole(9), async (req, res, next) => {
  try {
    const result = await cancelarCompra(req.tenantClient, req.params.id);
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  CUENTAS POR COBRAR (CxC)
// ============================================================================

router.get('/cxc', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await listCxC(req.tenantClient, { page, limit, estado: req.query.estado });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/cxc/:id/abonar', requireAuth, requireRole(2), validate(abonarSchema), async (req, res, next) => {
  try {
    const result = await abonarCxC(req.tenantClient, req.params.id, {
      monto: req.body.monto,
      tenantId: req.tenantId,
      usuario: req.user.codigo,
      ip: req.ip,
    });
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  CUENTAS POR PAGAR (CxP)
// ============================================================================

router.get('/cxp', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await listCxP(req.tenantClient, { page, limit, estado: req.query.estado });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/cxp/:id/abonar', requireAuth, requireRole(5), validate(abonarSchema), async (req, res, next) => {
  try {
    const result = await abonarCxP(req.tenantClient, req.params.id, {
      monto: req.body.monto,
      tenantId: req.tenantId,
      usuario: req.user.codigo,
      ip: req.ip,
    });
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  FACTURACION
// ============================================================================

router.get('/facturas', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const { desde, hasta } = dateRangeSchema.parse(req.query);
    const result = await listFacturas(req.tenantClient, { page, limit, desde, hasta });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/facturas', requireAuth, requireRole(2), validate(facturaCreateSchema), async (req, res, next) => {
  try {
    const result = await createFactura(req.tenantClient, { ...req.body, tenantId: req.tenantId });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  POLIZAS
// ============================================================================

router.get('/polizas', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const { desde, hasta } = dateRangeSchema.parse(req.query);
    const result = await listPolizas(req.tenantClient, { page, limit, tipo: req.query.tipo, desde, hasta });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/polizas', requireAuth, requireRole(9), validate(polizaCreateSchema), async (req, res, next) => {
  try {
    const result = await createPoliza(req.tenantClient, { ...req.body, tenantId: req.tenantId });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  PERSONAL
// ============================================================================

router.get('/personal', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await listPersonal(req.tenantClient, { page, limit, puesto: req.query.puesto });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/personal/:id', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await getPersonal(req.tenantClient, req.params.id);
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/personal', requireAuth, requireRole(9), validate(personalCreateSchema), async (req, res, next) => {
  try {
    const result = await createPersonal(req.tenantClient, { ...req.body, tenantId: req.tenantId });
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/personal/:id', requireAuth, requireRole(9), validate(personalUpdateSchema), async (req, res, next) => {
  try {
    const result = await updatePersonal(req.tenantClient, req.params.id, req.body);
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  ASISTENCIA
// ============================================================================

router.post('/asistencia', requireAuth, validate(asistenciaSchema), async (req, res, next) => {
  try {
    const result = await registrarAsistencia(req.tenantClient, { personal_id: req.body.personal_id, tipo: req.body.tipo, tenantId: req.tenantId });
    if (result.error) return res.status(result.status).json({ error: { code: result.code, message: result.message } });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/asistencia/:personal_id', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const { desde, hasta } = dateRangeSchema.parse(req.query);
    const result = await getAsistencia(req.tenantClient, {
      personal_id: req.params.personal_id,
      desde,
      hasta,
      page,
      limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  DASHBOARD FINANCIERO
// ============================================================================

router.get('/dashboard', requireAuth, requireRole(5), async (req, res, next) => {
  try {
    const result = await getDashboardFinanciero(req.tenantClient);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
