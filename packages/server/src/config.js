import 'dotenv/config';

// ============================================================================
// SECURITY: Validate required environment variables in production
// ============================================================================
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ FATAL: Missing required environment variables: ${missing.join(', ')}`);
    console.error('   These variables MUST be set in production. Refusing to start.');
    process.exit(1);
  }
  // Reject obviously insecure JWT secrets
  const insecureSecrets = ['opus_jwt_secret_change_in_production_2026', 'cambiar-en-produccion', 'secret', 'jwt_secret'];
  if (insecureSecrets.includes(process.env.JWT_SECRET)) {
    console.error('❌ FATAL: JWT_SECRET is set to a known insecure value. Generate a strong random secret.');
    process.exit(1);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  env: process.env.NODE_ENV || 'development',

  // Database — NO fallback in production
  databaseUrl: process.env.DATABASE_URL || (isProduction ? undefined : 'postgresql://opus:opus_dev_2026@localhost:5432/opus'),

  // JWT — NO fallback in production
  jwtSecret: process.env.JWT_SECRET || (isProduction ? undefined : 'opus_dev_only_secret_not_for_production'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

  // CORS
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:5175').split(',').map(s => s.trim()),

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
  },

  // Public endpoints rate limiting (stricter)
  publicRateLimit: {
    windowMs: parseInt(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.PUBLIC_RATE_LIMIT_MAX || '30', 10),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};
