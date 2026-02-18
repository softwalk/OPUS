import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loginSchema } from '@opus/shared/schemas';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import logger from '../logger.js';

const router = Router();

/**
 * POST /api/auth/login
 * Body: { codigo, password, tenant_slug }
 * Public route — no auth middleware required.
 * Looks up tenant by slug, then user by codigo within that tenant.
 */
router.post('/login', async (req, res, next) => {
  try {
    // --- Validate input ---
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de login invalidos',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { codigo, password, tenant_slug } = parsed.data;

    // --- Look up tenant by slug (no RLS needed) ---
    const tenantResult = await query(
      'SELECT * FROM tenants WHERE slug = $1 AND activo = true',
      [tenant_slug]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(401).json({
        error: { code: 'TENANT_NOT_FOUND', message: 'Restaurante no encontrado' },
      });
    }

    const tenant = tenantResult.rows[0];

    // --- Look up user by codigo within tenant ---
    const userResult = await query(
      'SELECT * FROM users WHERE tenant_id = $1 AND codigo = $2 AND activo = true',
      [tenant.id, codigo]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales invalidas' },
      });
    }

    const user = userResult.rows[0];

    // --- Compare password with bcrypt ---
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales invalidas' },
      });
    }

    // --- Generate JWT ---
    const payload = {
      sub: user.id,
      tenant_id: tenant.id,
      codigo: user.codigo,
      puesto: user.puesto,
      nivel_acceso: user.nivel_acceso,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });

    // --- Update last_login_at ---
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    logger.info('User logged in', {
      userId: user.id,
      codigo: user.codigo,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    });

    // --- Return response ---
    res.json({
      token,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        codigo: user.codigo,
        nombre: user.nombre,
        puesto: user.puesto,
        nivel_acceso: user.nivel_acceso,
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        nombre: tenant.nombre,
        plan: tenant.plan,
        config: tenant.config,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Requires auth middleware (req.user must be set).
 * Returns current user info + tenant info from database.
 */
router.get('/me', async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
      });
    }

    // Fetch fresh user data from database
    const userResult = await query(
      'SELECT id, tenant_id, codigo, nombre, email, puesto, nivel_acceso, last_login_at, created_at FROM users WHERE id = $1 AND activo = true',
      [req.user.sub]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado o inactivo' },
      });
    }

    const user = userResult.rows[0];

    // Fetch tenant info
    const tenantResult = await query(
      'SELECT id, slug, nombre, plan, config FROM tenants WHERE id = $1 AND activo = true',
      [req.user.tenant_id]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(401).json({
        error: { code: 'TENANT_NOT_FOUND', message: 'Restaurante no encontrado o inactivo' },
      });
    }

    const tenant = tenantResult.rows[0];

    res.json({ user, tenant });
  } catch (err) {
    next(err);
  }
});

export default router;
