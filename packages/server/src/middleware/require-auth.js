/**
 * Require Authentication Middleware.
 * Blocks unauthenticated requests by checking for req.user.
 * Must be used AFTER authMiddleware in the middleware chain.
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: {
        code: 'AUTH_NO_TOKEN',
        message: 'Autenticación requerida',
      },
    });
  }
  next();
}

export default requireAuth;
