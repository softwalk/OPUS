import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { query as poolQuery } from '../db/pool.js';
import { getTenantClient } from '../db/tenant.js';
import {
  loginCliente,
  createOrden,
  createReservacion,
  checkDisponibilidadReservaciones,
  getCalificaciones,
  addCalificacion,
} from '../services/orders.service.js';
import { getClienteLoyalty } from '../services/loyalty.service.js';

const router = Router();

// ============================================================================
// HELPER — resolve tenant from slug (shared by public endpoints)
// ============================================================================

async function resolveTenant(slug) {
  const { rows: [tenant] } = await poolQuery(
    'SELECT id FROM tenants WHERE slug = $1 AND activo = true',
    [slug]
  );
  return tenant || null;
}

// ============================================================================
//  POST /login — Lightweight phone-based client authentication
//  PUBLIC endpoint — resolves tenant from body.tenant_slug
//  Also looks up the client in `clientes` table for loyalty data.
// ============================================================================

router.post('/login', async (req, res, next) => {
  try {
    const { telefono, nombre, tenant_slug } = req.body;

    if (!telefono) {
      return res.status(400).json({
        error: { code: 'TELEFONO_REQUIRED', message: 'Telefono es requerido' },
      });
    }

    if (!tenant_slug) {
      return res.status(400).json({
        error: { code: 'TENANT_REQUIRED', message: 'Slug del restaurante es requerido' },
      });
    }

    const tenant = await resolveTenant(tenant_slug);
    if (!tenant) {
      return res.status(404).json({
        error: { code: 'TENANT_NOT_FOUND', message: 'Restaurante no encontrado' },
      });
    }

    // Acquire a tenant-scoped client for the session operation
    const client = await getTenantClient(tenant.id);
    try {
      const result = await loginCliente(client, {
        telefono,
        nombre,
        tenantId: tenant.id,
      });

      if (result.error) {
        return res.status(result.status).json({
          error: { code: result.code, message: result.message },
        });
      }

      // Also look up the client in `clientes` table for loyalty info
      const { rows: [cliente] } = await client.query(
        `SELECT id, nombre, telefono, email, puntos_acumulados, nivel_fidelizacion
         FROM clientes WHERE telefono = $1`,
        [telefono]
      );

      if (cliente) {
        // Fetch full loyalty data
        let loyalty = null;
        try {
          loyalty = await getClienteLoyalty(client, cliente.id);
        } catch { /* non-critical */ }

        res.json({
          ...result,
          cliente: {
            id: cliente.id,
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            email: cliente.email,
            puntos_acumulados: cliente.puntos_acumulados,
            nivel_fidelizacion: cliente.nivel_fidelizacion,
          },
          loyalty: loyalty?.error ? null : loyalty,
        });
      } else {
        // No loyalty client found — return session info only
        res.json({
          ...result,
          cliente: null,
          loyalty: null,
        });
      }
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  GET /loyalty/:telefono — Public loyalty status lookup by phone
//  PUBLIC endpoint — requires tenant_slug as query param
// ============================================================================

router.get('/loyalty/:telefono', async (req, res, next) => {
  try {
    const { telefono } = req.params;
    const tenant_slug = req.query.tenant_slug;

    if (!tenant_slug) {
      return res.status(400).json({
        error: { code: 'TENANT_REQUIRED', message: 'Query param tenant_slug es requerido' },
      });
    }

    const tenant = await resolveTenant(tenant_slug);
    if (!tenant) {
      return res.status(404).json({
        error: { code: 'TENANT_NOT_FOUND', message: 'Restaurante no encontrado' },
      });
    }

    const client = await getTenantClient(tenant.id);
    try {
      const { rows: [cliente] } = await client.query(
        `SELECT id, nombre, telefono, email, puntos_acumulados, nivel_fidelizacion
         FROM clientes WHERE telefono = $1`,
        [telefono]
      );

      if (!cliente) {
        return res.status(404).json({
          error: { code: 'CLIENTE_NOT_FOUND', message: 'No se encontro cuenta de lealtad para este telefono' },
        });
      }

      const loyalty = await getClienteLoyalty(client, cliente.id);
      if (loyalty.error) {
        return res.status(loyalty.status).json({
          error: { code: loyalty.code, message: loyalty.message },
        });
      }

      res.json({ cliente, loyalty });
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  POST /pedir — PUBLIC: Create order from client-app (mesa or delivery)
//  Requires tenant_slug in body. No staff JWT needed.
// ============================================================================

router.post('/pedir', async (req, res, next) => {
  try {
    const {
      tenant_slug, tipo, mesa_id, mesa_numero,
      cliente_nombre, cliente_telefono, direccion_entrega,
      zona_entrega_id, items, notas, forma_pago,
    } = req.body;

    if (!tenant_slug) {
      return res.status(400).json({
        error: { code: 'TENANT_REQUIRED', message: 'Slug del restaurante es requerido' },
      });
    }

    if (!items?.length) {
      return res.status(400).json({
        error: { code: 'ITEMS_REQUIRED', message: 'Al menos un item es requerido' },
      });
    }

    if (!tipo || !['qr_mesa', 'delivery', 'para_llevar'].includes(tipo)) {
      return res.status(400).json({
        error: { code: 'TIPO_INVALID', message: 'Tipo debe ser qr_mesa, delivery o para_llevar' },
      });
    }

    const tenant = await resolveTenant(tenant_slug);
    if (!tenant) {
      return res.status(404).json({
        error: { code: 'TENANT_NOT_FOUND', message: 'Restaurante no encontrado' },
      });
    }

    // If tipo is qr_mesa and mesa_numero is provided, resolve mesa_id
    let resolvedMesaId = mesa_id || null;
    const client = await getTenantClient(tenant.id);
    try {
      if (tipo === 'qr_mesa' && !resolvedMesaId && mesa_numero) {
        const { rows: [mesa] } = await client.query(
          `SELECT id FROM mesas WHERE numero = $1`,
          [mesa_numero]
        );
        if (mesa) resolvedMesaId = mesa.id;
      }

      const result = await createOrden(client, {
        tipo,
        mesaId: resolvedMesaId,
        clienteNombre: cliente_nombre,
        clienteTelefono: cliente_telefono,
        direccionEntrega: direccion_entrega,
        zonaEntregaId: zona_entrega_id,
        items,
        notas,
        formaPago: forma_pago,
        tenantId: tenant.id,
        usuario: 'cliente-app',
        usuarioId: null,
        ip: req.ip,
      });

      if (result.error) {
        return res.status(result.status).json({
          error: { code: result.code, message: result.message },
        });
      }

      // Broadcast new order
      const broadcast = req.app.get('broadcast');
      if (broadcast) {
        broadcast(tenant.id, 'orden:nueva', {
          orden_id: result.id,
          tipo: result.tipo,
          estado: result.estado,
          total: result.total,
        });
      }

      res.status(201).json(result);
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  GET /reservar/disponibilidad — PUBLIC: Check reservation availability
//  Requires tenant_slug as query param
// ============================================================================

router.get('/reservar/disponibilidad', async (req, res, next) => {
  try {
    const tenant_slug = req.query.tenant_slug;
    if (!tenant_slug) {
      return res.status(400).json({
        error: { code: 'TENANT_REQUIRED', message: 'Query param tenant_slug es requerido' },
      });
    }

    const tenant = await resolveTenant(tenant_slug);
    if (!tenant) {
      return res.status(404).json({
        error: { code: 'TENANT_NOT_FOUND', message: 'Restaurante no encontrado' },
      });
    }

    const client = await getTenantClient(tenant.id);
    try {
      const result = await checkDisponibilidadReservaciones(client, {
        fecha: req.query.fecha || new Date().toISOString().slice(0, 10),
        personas: req.query.personas ? parseInt(req.query.personas, 10) : 2,
        tenantId: tenant.id,
      });
      res.json(result);
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  POST /reservar — PUBLIC: Create reservation from client-app
//  Requires tenant_slug in body. No staff JWT needed.
// ============================================================================

router.post('/reservar', async (req, res, next) => {
  try {
    const {
      tenant_slug, cliente_nombre, cliente_telefono, cliente_email,
      fecha, hora, personas, zona_preferida_id, notas,
    } = req.body;

    if (!tenant_slug) {
      return res.status(400).json({
        error: { code: 'TENANT_REQUIRED', message: 'Slug del restaurante es requerido' },
      });
    }

    if (!cliente_nombre || !fecha || !hora) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'Nombre, fecha y hora son requeridos' },
      });
    }

    const tenant = await resolveTenant(tenant_slug);
    if (!tenant) {
      return res.status(404).json({
        error: { code: 'TENANT_NOT_FOUND', message: 'Restaurante no encontrado' },
      });
    }

    const client = await getTenantClient(tenant.id);
    try {
      const result = await createReservacion(client, {
        clienteNombre: cliente_nombre,
        clienteTelefono: cliente_telefono,
        clienteEmail: cliente_email,
        fecha,
        hora,
        personas: personas || 2,
        zonaPreferidaId: zona_preferida_id,
        notas,
        tenantId: tenant.id,
      });

      if (result.error) {
        return res.status(result.status).json({
          error: { code: result.code, message: result.message },
          alternativas: result.alternativas || undefined,
        });
      }

      // Broadcast
      const broadcast = req.app.get('broadcast');
      if (broadcast) {
        broadcast(tenant.id, 'reservacion:nueva', {
          id: result.id,
          mesa_numero: result.mesa_numero,
          hora: result.hora,
          cliente_nombre: result.cliente_nombre,
        });
      }

      res.status(201).json(result);
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ============================================================================
//  GET /calificaciones — Get customer ratings
//  Requires authentication
// ============================================================================

router.get('/calificaciones', requireAuth, async (req, res, next) => {
  try {
    const result = await getCalificaciones(req.tenantClient, {
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
//  POST /calificaciones — Add a customer rating
//  Requires authentication
// ============================================================================

router.post('/calificaciones', requireAuth, async (req, res, next) => {
  try {
    const result = await addCalificacion(req.tenantClient, {
      ordenId: req.body.orden_id,
      puntuacion: req.body.puntuacion,
      comentario: req.body.comentario,
      clienteNombre: req.body.cliente_nombre,
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
});

export default router;
