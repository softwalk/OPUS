import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { loginSchema } from '@opus/shared/schemas';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import logger from '../logger.js';

const router = Router();

/**
 * Generate an access token (short-lived) and a refresh token (long-lived).
 * The refresh token contains a unique `jti` (JWT ID) for revocation tracking.
 * @param {object} payload - { sub, tenant_id, codigo, puesto, nivel_acceso }
 * @returns {{ accessToken: string, refreshToken: string }}
 */
function generateTokenPair(payload) {
  const accessToken = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

  const refreshToken = jwt.sign(
    { sub: payload.sub, tenant_id: payload.tenant_id, type: 'refresh', jti: crypto.randomUUID() },
    config.jwtSecret,
    { expiresIn: config.jwtRefreshExpiresIn }
  );

  return { accessToken, refreshToken };
}

/**
 * POST /api/auth/login
 * Body: { codigo, password, tenant_slug }
 * Public route — no auth middleware required.
 * Looks up tenant by slug, then user by codigo within that tenant.
 * Returns an access token (short-lived) and a refresh token (long-lived).
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

    // --- Generate token pair ---
    const payload = {
      sub: user.id,
      tenant_id: tenant.id,
      codigo: user.codigo,
      puesto: user.puesto,
      nivel_acceso: user.nivel_acceso,
    };

    const { accessToken, refreshToken } = generateTokenPair(payload);

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
    // `token` kept for backward compatibility; clients should migrate to `accessToken`
    res.json({
      token: accessToken,
      accessToken,
      refreshToken,
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
 * POST /api/auth/refresh
 * Body: { refreshToken }
 * Validates the refresh token and issues a new access + refresh token pair.
 * The old refresh token is implicitly invalidated (rotation pattern).
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: { code: 'REFRESH_TOKEN_REQUIRED', message: 'refreshToken es requerido' },
      });
    }

    // --- Verify the refresh token ---
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: { code: 'REFRESH_TOKEN_EXPIRED', message: 'Token de refresco expirado. Inicia sesión nuevamente.' },
        });
      }
      return res.status(401).json({
        error: { code: 'REFRESH_TOKEN_INVALID', message: 'Token de refresco invalido' },
      });
    }

    // --- Ensure it's a refresh token (not an access token) ---
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        error: { code: 'INVALID_TOKEN_TYPE', message: 'Token no es de tipo refresh' },
      });
    }

    // --- Look up user (ensure still active) ---
    const userResult = await query(
      'SELECT id, tenant_id, codigo, puesto, nivel_acceso FROM users WHERE id = $1 AND activo = true',
      [decoded.sub]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado o inactivo' },
      });
    }

    const user = userResult.rows[0];

    // --- Verify tenant is still active ---
    const tenantResult = await query(
      'SELECT id FROM tenants WHERE id = $1 AND activo = true',
      [decoded.tenant_id]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(401).json({
        error: { code: 'TENANT_INACTIVE', message: 'Restaurante inactivo' },
      });
    }

    // --- Issue new token pair (rotation) ---
    const payload = {
      sub: user.id,
      tenant_id: user.tenant_id,
      codigo: user.codigo,
      puesto: user.puesto,
      nivel_acceso: user.nivel_acceso,
    };

    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(payload);

    logger.debug('Token refreshed', { userId: user.id, tenantId: user.tenant_id });

    res.json({
      token: accessToken,
      accessToken,
      refreshToken: newRefreshToken,
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
