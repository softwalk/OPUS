/**
 * Require Role Middleware (factory).
 * Enforces a minimum access level for the authenticated user.
 * Must be used AFTER authMiddleware and requireAuth in the middleware chain.
 *
 * @param {number} minLevel - Minimum nivel_acceso required
 * @returns {import('express').RequestHandler}
 *
 * Usage:
 *   router.post('/admin-action', requireAuth, requireRole(8), handler);
 */
export function requireRole(minLevel) {
  return (req, res, next) => {
    if (!req.user || req.user.nivel_acceso < minLevel) {
      return res.status(403).json({
        error: {
          code: 'AUTH_INSUFFICIENT_ROLE',
          message: 'Permisos insuficientes',
        },
      });
    }
    next();
  };
}

export default requireRole;
