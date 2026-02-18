/**
 * Route helper utilities — DRY extractors for repeated patterns.
 *
 * @module helpers/route
 */

// ============================================================================
// asyncHandler — Wraps async route handlers to forward errors to next()
// ============================================================================

/**
 * Wraps an async Express route handler so that any thrown/rejected error
 * is automatically forwarded to `next(err)`.
 *
 * Eliminates the need for try/catch blocks in every handler.
 *
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<void>} fn
 * @returns {import('express').RequestHandler}
 *
 * @example
 *   router.get('/items', asyncHandler(async (req, res) => {
 *     const data = await service.list(req.tenantClient);
 *     res.json(data);
 *   }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ============================================================================
// sendResult — Sends a service result or error response
// ============================================================================

/**
 * Sends a service layer result. If the result has `error: true`, sends an
 * error response with the appropriate status. Otherwise sends the result as JSON.
 *
 * @param {import('express').Response} res
 * @param {object} result - Service result (may have { error, status, code, message })
 * @param {number} [successStatus=200] - HTTP status for success
 * @returns {void}
 *
 * @example
 *   const result = await service.update(client, id, data);
 *   sendResult(res, result);
 *   // If result.error → 404 { error: { code, message } }
 *   // Else → 200 result
 */
export function sendResult(res, result, successStatus = 200) {
  if (result.error) {
    return res.status(result.status || 400).json({
      error: { code: result.code, message: result.message },
    });
  }
  return res.status(successStatus).json(result);
}

// ============================================================================
// auditCtx — Extracts audit context fields from the request
// ============================================================================

/**
 * Extract the standard audit context from an Express request.
 * Used when calling service functions that require audit trail metadata.
 *
 * @param {import('express').Request} req
 * @returns {{ tenantId: string, usuario: string, usuarioId: string, ip: string }}
 *
 * @example
 *   const result = await service.createItem(req.tenantClient, {
 *     ...req.body,
 *     ...auditCtx(req),
 *   });
 */
export function auditCtx(req) {
  return {
    tenantId: req.tenantId,
    usuario: req.user?.codigo || 'system',
    usuarioId: req.user?.sub || null,
    ip: req.ip,
  };
}

// ============================================================================
// emitEvent — Broadcast a WebSocket event to the tenant
// ============================================================================

/**
 * Broadcast a WebSocket event to all connections for the current tenant.
 * No-op if the broadcast function is not available (e.g. in tests).
 *
 * @param {import('express').Request} req
 * @param {string} event - Event name (e.g. 'cocina:nuevo', 'mesa:actualizada')
 * @param {object} [data] - Event payload
 *
 * @example
 *   emitEvent(req, 'cocina:nuevo', { mesaNumero: 5, items: [...] });
 */
export function emitEvent(req, event, data) {
  const broadcast = req.app.get('broadcast');
  if (broadcast && req.tenantId) {
    broadcast(req.tenantId, event, data);
  }
}
