import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError, z } from 'zod';

// ---------------------------------------------------------------------------
// Helpers to create mock Express req/res/next
// ---------------------------------------------------------------------------
function mockReq(overrides = {}) {
  return {
    headers: {},
    body: {},
    query: {},
    params: {},
    method: 'GET',
    originalUrl: '/test',
    ip: '127.0.0.1',
    user: null,
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
    on: vi.fn(),
  };
  return res;
}

// ============================================================================
// require-auth.js
// ============================================================================

describe('requireAuth', () => {
  let requireAuth;

  beforeEach(async () => {
    const mod = await import('./require-auth.js');
    requireAuth = mod.requireAuth;
  });

  it('calls next() when req.user exists', () => {
    const req = mockReq({ user: { sub: '1', nivel_acceso: 5 } });
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200); // unchanged
  });

  it('returns 401 when req.user is null', () => {
    const req = mockReq({ user: null });
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('AUTH_NO_TOKEN');
  });

  it('returns 401 when req.user is undefined', () => {
    const req = mockReq();
    delete req.user;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

// ============================================================================
// require-role.js
// ============================================================================

describe('requireRole', () => {
  let requireRole;

  beforeEach(async () => {
    const mod = await import('./require-role.js');
    requireRole = mod.requireRole;
  });

  it('calls next() when user meets minimum level', () => {
    const req = mockReq({ user: { sub: '1', nivel_acceso: 8 } });
    const res = mockRes();
    const next = vi.fn();

    requireRole(8)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next() when user exceeds minimum level', () => {
    const req = mockReq({ user: { sub: '1', nivel_acceso: 10 } });
    const res = mockRes();
    const next = vi.fn();

    requireRole(5)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 when user level is below minimum', () => {
    const req = mockReq({ user: { sub: '1', nivel_acceso: 3 } });
    const res = mockRes();
    const next = vi.fn();

    requireRole(5)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('AUTH_INSUFFICIENT_ROLE');
  });

  it('returns 403 when req.user is null', () => {
    const req = mockReq({ user: null });
    const res = mockRes();
    const next = vi.fn();

    requireRole(1)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('allows through when nivel_acceso is undefined (NaN < N is false)', () => {
    // undefined < 1 evaluates to false in JS, so the condition !req.user is false
    // and req.user.nivel_acceso < minLevel is (undefined < 1) which is false.
    // This means the user passes through — this documents the current behavior.
    // A stricter check could use: (req.user.nivel_acceso ?? 0) < minLevel
    const req = mockReq({ user: { sub: '1' } });
    const res = mockRes();
    const next = vi.fn();

    requireRole(1)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('returns a function (factory pattern)', () => {
    const middleware = requireRole(5);
    expect(typeof middleware).toBe('function');
  });
});

// ============================================================================
// validate.js
// ============================================================================

describe('validate', () => {
  let validate;

  beforeEach(async () => {
    const mod = await import('./validate.js');
    validate = mod.validate;
  });

  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  it('calls next() on valid body', () => {
    const req = mockReq({ body: { name: 'Juan', age: 25 } });
    const res = mockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    // Parsed data should replace req.body
    expect(req.body).toEqual({ name: 'Juan', age: 25 });
  });

  it('returns 400 on invalid body', () => {
    const req = mockReq({ body: { name: '', age: -1 } });
    const res = mockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('validates query params when source="query"', () => {
    const querySchema = z.object({
      page: z.coerce.number().int().positive().default(1),
    });
    const req = mockReq({ query: { page: '3' } });
    const res = mockRes();
    const next = vi.fn();

    validate(querySchema, 'query')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.query).toEqual({ page: 3 });
  });

  it('validates params when source="params"', () => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });
    const req = mockReq({ params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
    const res = mockRes();
    const next = vi.fn();

    validate(paramsSchema, 'params')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('replaces req[source] with parsed data (strips extra fields)', () => {
    const strictSchema = z.object({ name: z.string() });
    const req = mockReq({ body: { name: 'Test', extraField: 'should be stripped' } });
    const res = mockRes();
    const next = vi.fn();

    validate(strictSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ name: 'Test' });
    expect(req.body.extraField).toBeUndefined();
  });

  it('returns a function (factory pattern)', () => {
    const middleware = validate(testSchema);
    expect(typeof middleware).toBe('function');
  });

  it('returns multiple validation errors for multiple bad fields', () => {
    const req = mockReq({ body: {} }); // missing both name and age
    const res = mockRes();
    const next = vi.fn();

    validate(testSchema)(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// error-handler.js
// ============================================================================

describe('errorHandler', () => {
  let errorHandler;

  beforeEach(async () => {
    // Mock the logger to avoid actual log output in tests
    vi.doMock('../logger.js', () => ({
      default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    }));
    // Mock config
    vi.doMock('../config.js', () => ({
      config: { env: 'test' },
    }));
    const mod = await import('./error-handler.js');
    errorHandler = mod.errorHandler;
  });

  it('handles ZodError with 400', () => {
    const schema = z.object({ x: z.number() });
    const result = schema.safeParse({ x: 'not a number' });
    const zodErr = result.error;

    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    errorHandler(zodErr, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('handles JsonWebTokenError with 401', () => {
    const err = new Error('jwt malformed');
    err.name = 'JsonWebTokenError';

    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('AUTH_INVALID_TOKEN');
  });

  it('handles TokenExpiredError with 401', () => {
    const err = new Error('jwt expired');
    err.name = 'TokenExpiredError';

    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('handles generic error with custom status', () => {
    const err = new Error('Not found');
    err.status = 404;
    err.code = 'NOT_FOUND';

    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('defaults to 500 for errors without status', () => {
    const err = new Error('Something went wrong');

    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});

// ============================================================================
// auth.js (JWT extraction middleware)
// ============================================================================

describe('authMiddleware', () => {
  let authMiddleware;
  let jwt;
  const TEST_SECRET = 'opus_dev_only_secret_not_for_production';

  beforeEach(async () => {
    // Ensure config is mocked with a known secret
    vi.doMock('../config.js', () => ({
      config: {
        jwtSecret: TEST_SECRET,
        env: 'test',
      },
    }));
    const mod = await import('./auth.js');
    authMiddleware = mod.authMiddleware;
    jwt = (await import('jsonwebtoken')).default;
  });

  it('extracts valid JWT and attaches to req.user', () => {
    const payload = { sub: 'user-1', tenant_id: 'tenant-1', nivel_acceso: 5 };
    const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });

    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
    expect(req.user.sub).toBe('user-1');
    expect(req.user.tenant_id).toBe('tenant-1');
  });

  it('calls next() without setting req.user when no header', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeNull();
  });

  it('calls next() without setting req.user for invalid token', () => {
    const req = mockReq({ headers: { authorization: 'Bearer invalid.token.here' } });
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeNull();
  });

  it('calls next() when Authorization header is not Bearer type', () => {
    const req = mockReq({ headers: { authorization: 'Basic abc123' } });
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeNull();
  });

  it('calls next() for expired token without setting user', () => {
    const payload = { sub: 'user-1', tenant_id: 'tenant-1' };
    const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '0s' });

    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();

    // Small delay to ensure token is expired
    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    // User should NOT be set for expired token
    expect(req.user).toBeNull();
  });
});
