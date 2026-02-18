import { getTenantClient } from '../db/tenant.js';
import logger from '../logger.js';

/**
 * Tenant Context Middleware.
 * If the request has an authenticated user with a tenant_id,
 * acquires a PostgreSQL client with RLS tenant context set
 * and attaches it to req.tenantClient.
 *
 * The client is automatically released when the response finishes.
 */
export async function tenantMiddleware(req, res, next) {
  if (req.user && req.user.tenant_id) {
    try {
      const client = await getTenantClient(req.user.tenant_id);
      req.tenantClient = client;
      req.tenantId = req.user.tenant_id;

      // Release the client when the response finishes (guard against double release)
      let released = false;
      const releaseClient = () => {
        if (!released) {
          released = true;
          client.release();
          logger.debug('Tenant client released', { tenantId: req.tenantId });
        }
      };
      res.on('finish', releaseClient);
      res.on('close', releaseClient);
    } catch (err) {
      logger.error('Failed to acquire tenant client', {
        tenantId: req.user.tenant_id,
        error: err.message,
      });
      return next(err);
    }
  }

  next();
}

export default tenantMiddleware;
