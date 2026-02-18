import { ZodError } from 'zod';
import logger from '../logger.js';
import { config } from '../config.js';

/**
 * Global Error Handler Middleware.
 * Standard Express error handler — must have 4 parameters.
 * Handles Zod validation errors, JWT errors, and general errors.
 * In development, includes stack traces in the response.
 */
export function errorHandler(err, req, res, next) {
  // Log the error
  logger.error(err.message, {
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: err.issues,
      },
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: {
        code: 'AUTH_INVALID_TOKEN',
        message: 'Token inválido',
      },
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        code: 'AUTH_TOKEN_EXPIRED',
        message: 'Token expirado',
      },
    });
  }

  // General errors
  const status = err.status || err.statusCode || 500;
  const response = {
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Error interno del servidor',
    },
  };

  // Include stack trace in development
  if (config.env === 'development') {
    response.error.stack = err.stack;
  }

  res.status(status).json(response);
}

export default errorHandler;
