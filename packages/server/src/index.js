import { config } from './config.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import morgan from 'morgan';
import { testConnection } from './db/pool.js';
import logger from './logger.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { errorHandler } from './middleware/error-handler.js';
import authRouter from './routes/auth.routes.js';
import posRouter from './routes/pos.routes.js';
import stockControlRouter from './routes/stock-control.routes.js';
import productosRouter from './routes/productos.routes.js';
import recetasRouter from './routes/recetas.routes.js';
import inventarioRouter from './routes/inventario.routes.js';
import cocinaRouter from './routes/cocina.routes.js';
import ordenesRouter from './routes/ordenes.routes.js';
import reservacionesRouter from './routes/reservaciones.routes.js';
import qrRouter from './routes/qr.routes.js';
import deliveryRouter from './routes/delivery.routes.js';
import clientesAuthRouter from './routes/clientes-auth.routes.js';
import fidelizacionRouter from './routes/fidelizacion.routes.js';
import finanzasRouter from './routes/finanzas.routes.js';
import reportesRouter from './routes/reportes.routes.js';
import costeoRouter from './routes/costeo.routes.js';
import { initWebSocket, broadcast } from './websocket/index.js';

const app = express();
const PORT = config.port;

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting — General API (L2 security layer)
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' } },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Rate limiting — Auth endpoints (stricter, relaxed in dev)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.env === 'development' ? 100 : 20,
  message: { error: { code: 'RATE_LIMITED', message: 'Demasiados intentos de login. Espera 15 minutos.' } },
});

// Rate limiting — Public endpoints (orders, reservations, client login)
const publicLimiter = rateLimit({
  windowMs: config.publicRateLimit.windowMs,
  max: config.publicRateLimit.max,
  message: { error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS (configured origins)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.corsOrigin.includes(origin)) {
      callback(null, true);
    } else if (config.env === 'development') {
      callback(null, true); // Allow all in dev
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Request logging
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) },
}));

app.use(express.json({ limit: '5mb' }));

// JWT Auth — extract user on every request (does not block)
app.use(authMiddleware);
// Tenant context — set RLS context for authenticated requests
app.use(tenantMiddleware);

// ==========================================
// HEALTH CHECK
// ==========================================
app.get('/api/health', async (req, res) => {
  const dbOk = await testConnection();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    version: '1.0.0-opus',
    sistema: 'OPUS — Restaurant POS SaaS',
    database: dbOk ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    env: config.env,
  });
});

// ==========================================
// API ROUTES — Auth
// ==========================================
app.use('/api/v1/auth', authLimiter, authRouter);

// Make broadcast available to routes
app.set('broadcast', broadcast);

// ==========================================
// API Routes — Phase 4: POS Core + Stock Control
// ==========================================
app.use('/api/v1/pos', posRouter);
app.use('/api/v1/stock-control', stockControlRouter);

// ==========================================
// API Routes — Phase 7: Digital Orders, QR, Delivery, Reservaciones
// ==========================================
app.use('/api/v1/ordenes', ordenesRouter);
app.use('/api/v1/reservaciones', reservacionesRouter);
app.use('/api/v1/qr', publicLimiter, qrRouter);
app.use('/api/v1/delivery', deliveryRouter);
// Public client endpoints (login, pedir, reservar) — stricter rate limit
app.use('/api/v1/clientes', publicLimiter, clientesAuthRouter);

// ==========================================
// API Routes — Phase 5: Catalog + Inventory
// ==========================================
app.use('/api/v1/productos', productosRouter);
app.use('/api/v1/recetas', recetasRouter);
app.use('/api/v1/inventario', inventarioRouter);

// ==========================================
// API Routes — Phase 6: Kitchen Display System
// ==========================================
app.use('/api/v1/cocina', cocinaRouter);

// ==========================================
// API Routes — Phase 8: Loyalty (Fidelización)
// ==========================================
app.use('/api/v1/fidelizacion', fidelizacionRouter);

// ==========================================
// API Routes — Phase 9: Finance (CxC, CxP, Compras, Personal)
// ==========================================
app.use('/api/v1/finanzas', finanzasRouter);

// ==========================================
// API Routes — Phase 10: Reportes + Costeo
// ==========================================
app.use('/api/v1/reportes', reportesRouter);
app.use('/api/v1/costeo', costeoRouter);

// ==========================================
// ERROR HANDLER
// ==========================================
app.use(errorHandler);

// ==========================================
// START SERVER
// ==========================================
const server = createServer(app);

initWebSocket(server);

server.listen(PORT, async () => {
  await testConnection();
  logger.info(`🍽️  OPUS Server v1.0.0 running on http://localhost:${PORT}`);
  logger.info(`📡 API available at http://localhost:${PORT}/api`);
  logger.info(`🔒 Security: Helmet ✓ | Rate Limit ✓ | CORS ✓`);
  logger.info(`🔌 WebSocket en ws://localhost:${PORT}/ws`);
  logger.info(`📦 Phase 1-3: Foundation + Auth ✓`);
  logger.info(`🍽️  Phase 4: POS Core + Stock Control ✓`);
  logger.info(`📋 Phase 5: Catalogo + Inventario ✓`);
  logger.info(`👨‍🍳 Phase 6: Kitchen Display System ✓`);
  logger.info(`📱 Phase 7: Digital Orders + QR + Delivery + Reservaciones ✓`);
  logger.info(`⭐ Phase 8: Programa de Fidelización ✓`);
  logger.info(`💰 Phase 9: Finanzas (CxC, CxP, Compras, Personal) ✓`);
  logger.info(`📊 Phase 10: Reportes + Costeo ✓`);
});

export { app, server };
