import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  env: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://opus:opus_dev_2026@localhost:5432/opus',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'opus_jwt_secret_change_in_production_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

  // CORS
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:5175').split(','),

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};
