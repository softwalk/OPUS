import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import logger from '../logger.js';

/** @type {WebSocketServer | null} */
let wss = null;

/**
 * Initialize the WebSocket server on an existing HTTP server.
 * Authenticates connections via JWT token in the URL query string:
 *   ws://host/ws?token=<jwt>
 *
 * Each connection stores `ws.tenantId` and `ws.userId` for
 * tenant-scoped broadcasting.
 *
 * @param {import('http').Server} server
 * @returns {WebSocketServer}
 */
export function initWebSocket(server) {
  wss = new WebSocketServer({ noServer: true });

  // --- Handle HTTP upgrade requests ---
  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

      // Only handle /ws path
      if (url.pathname !== '/ws') {
        socket.destroy();
        return;
      }

      // SECURITY: Prefer token from Sec-WebSocket-Protocol header
      // Fallback: URL query param (legacy — less secure, visible in server logs)
      const protocols = request.headers['sec-websocket-protocol'];
      let token = null;

      if (protocols) {
        // Token sent as subprotocol: "access_token, <jwt>"
        const parts = protocols.split(',').map(s => s.trim());
        const tokenIdx = parts.indexOf('access_token');
        if (tokenIdx !== -1 && parts[tokenIdx + 1]) {
          token = parts[tokenIdx + 1];
        }
      }

      if (!token) {
        token = url.searchParams.get('token');
        if (token) {
          logger.warn('WebSocket: token via URL query param (deprecated). Use Sec-WebSocket-Protocol header.');
        }
      }

      if (!token) {
        logger.warn('WebSocket connection rejected: no token');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Verify JWT
      let decoded;
      try {
        decoded = jwt.verify(token, config.jwtSecret);
      } catch (err) {
        logger.warn('WebSocket connection rejected: invalid token', {
          error: err.message,
        });
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Complete the WebSocket handshake
      wss.handleUpgrade(request, socket, head, (ws) => {
        // Store tenant and user info on the connection
        ws.tenantId = decoded.tenant_id;
        ws.userId = decoded.sub;
        ws.codigo = decoded.codigo;
        ws.puesto = decoded.puesto;
        ws.isAlive = true;

        wss.emit('connection', ws, request);
      });
    } catch (err) {
      logger.error('WebSocket upgrade error', { error: err.message });
      socket.destroy();
    }
  });

  // --- Handle new connections ---
  wss.on('connection', (ws) => {
    logger.info('WebSocket client connected', {
      tenantId: ws.tenantId,
      userId: ws.userId,
      codigo: ws.codigo,
    });

    // Respond to pong (heartbeat)
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle incoming messages
    ws.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());

        // Handle ping/pong at application level
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          return;
        }

        logger.debug('WebSocket message received', {
          tenantId: ws.tenantId,
          userId: ws.userId,
          type: message.type,
        });
      } catch (err) {
        logger.warn('Invalid WebSocket message', {
          tenantId: ws.tenantId,
          userId: ws.userId,
          error: err.message,
        });
      }
    });

    // Handle close
    ws.on('close', (code, reason) => {
      logger.info('WebSocket client disconnected', {
        tenantId: ws.tenantId,
        userId: ws.userId,
        code,
        reason: reason?.toString(),
      });
    });

    // Handle errors
    ws.on('error', (err) => {
      logger.error('WebSocket client error', {
        tenantId: ws.tenantId,
        userId: ws.userId,
        error: err.message,
      });
    });

    // Send welcome message (SECURITY: don't leak tenantId to client)
    ws.send(JSON.stringify({
      type: 'connected',
      ts: Date.now(),
    }));
  });

  // --- Heartbeat interval (detect dead connections) ---
  const heartbeatInterval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        logger.debug('Terminating stale WebSocket', {
          tenantId: ws.tenantId,
          userId: ws.userId,
        });
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  logger.info('WebSocket server initialized on /ws');

  return wss;
}

/**
 * Broadcast an event to ALL connected clients for a given tenant.
 *
 * @param {string} tenantId - UUID of the tenant to broadcast to
 * @param {string} event    - Event name (e.g. 'orden:nueva', 'cuenta:actualizada')
 * @param {object} [data]   - Event payload
 */
export function broadcast(tenantId, event, data = {}) {
  if (!wss) {
    logger.warn('broadcast() called before WebSocket server initialized');
    return;
  }

  const message = JSON.stringify({ type: event, data, ts: Date.now() });
  let count = 0;

  wss.clients.forEach((ws) => {
    if (ws.tenantId === tenantId && ws.readyState === ws.OPEN) {
      ws.send(message);
      count++;
    }
  });

  logger.debug('WebSocket broadcast', { tenantId, event, clientCount: count });
}

/**
 * Send an event to a specific user within a tenant.
 *
 * @param {string} tenantId - UUID of the tenant
 * @param {string} userId   - UUID of the target user
 * @param {string} event    - Event name
 * @param {object} [data]   - Event payload
 */
export function sendToUser(tenantId, userId, event, data = {}) {
  if (!wss) {
    logger.warn('sendToUser() called before WebSocket server initialized');
    return;
  }

  const message = JSON.stringify({ type: event, data, ts: Date.now() });
  let sent = false;

  wss.clients.forEach((ws) => {
    if (
      ws.tenantId === tenantId &&
      ws.userId === userId &&
      ws.readyState === ws.OPEN
    ) {
      ws.send(message);
      sent = true;
    }
  });

  if (!sent) {
    logger.debug('sendToUser: user not connected', { tenantId, userId, event });
  }
}

/**
 * Get the number of connected clients for a tenant (useful for health checks).
 *
 * @param {string} tenantId
 * @returns {number}
 */
export function getClientCount(tenantId) {
  if (!wss) return 0;
  let count = 0;
  wss.clients.forEach((ws) => {
    if (ws.tenantId === tenantId && ws.readyState === ws.OPEN) {
      count++;
    }
  });
  return count;
}
