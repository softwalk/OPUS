import { ZodError } from 'zod';

/**
 * Zod Validation Middleware (factory).
 * Validates req[source] against the provided Zod schema.
 * On success, replaces req[source] with the parsed (cleaned) data.
 * On failure, returns 400 with structured error details.
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'query' | 'params'} [source='body'] - Request property to validate
 * @returns {import('express').RequestHandler}
 *
 * Usage:
 *   router.post('/products', validate(createProductSchema), handler);
 *   router.get('/search', validate(searchSchema, 'query'), handler);
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: result.error.issues,
        },
      });
    }

    // Replace with parsed/cleaned data
    req[source] = result.data;
    next();
  };
}

export default validate;
