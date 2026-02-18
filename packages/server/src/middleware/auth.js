import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/**
 * JWT Authentication Middleware (non-blocking).
 * Extracts and verifies the JWT from the Authorization header.
 * If valid, attaches decoded payload to req.user:
 *   { sub, tenant_id, codigo, puesto, nivel_acceso }
 * If invalid or missing, simply calls next() so public routes still work.
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = decoded;
    } catch (err) {
      // Token invalid or expired — continue without user
    }
  }

  next();
}

export default authMiddleware;
