import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the route module
// ---------------------------------------------------------------------------
const mockQuery = vi.fn();

vi.mock('../db/pool.js', () => ({
  query: (...args) => mockQuery(...args),
  testConnection: vi.fn().mockResolvedValue(true),
  pool: {},
}));

vi.mock('../logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../config.js', () => ({
  config: {
    jwtSecret: 'test-secret-key-for-auth-tests-only',
    jwtExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
    env: 'test',
  },
}));

// ---------------------------------------------------------------------------
// We'll import and use the router through a lightweight Express-like approach.
// Since the routes are Express handlers, we'll test them with mock req/res.
// ---------------------------------------------------------------------------
const JWT_SECRET = 'test-secret-key-for-auth-tests-only';

const MOCK_TENANT = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  slug: 'la-xola',
  nombre: 'La Xola',
  plan: 'premium',
  config: {},
  activo: true,
};

const MOCK_USER = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  tenant_id: MOCK_TENANT.id,
  codigo: 'ADMIN01',
  nombre: 'Admin User',
  email: 'admin@test.com',
  puesto: 'gerente',
  nivel_acceso: 8,
  password_hash: '$2a$10$dummyhash', // will be matched by mocked bcrypt
  activo: true,
};

/** Simple helper to create a mock Express req/res and run a route handler */
function mockReq(overrides = {}) {
  return {
    headers: {},
    body: {},
    query: {},
    params: {},
    method: 'POST',
    originalUrl: '/api/v1/auth/login',
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
  };
  return res;
}

// ---------------------------------------------------------------------------
// Since we can't easily extract individual route handlers from Express Router,
// we'll import the module and test generateTokenPair indirectly through the
// login and refresh endpoints. We'll use supertest-like approach with mocks.
// ---------------------------------------------------------------------------

describe('Auth Routes — generateTokenPair (via login)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset bcrypt mock for each test
    vi.doMock('bcryptjs', () => ({
      default: { compare: vi.fn().mockResolvedValue(true) },
      compare: vi.fn().mockResolvedValue(true),
    }));
  });

  it('login returns accessToken and refreshToken with correct structure', async () => {
    // Mock tenant lookup
    mockQuery.mockResolvedValueOnce({ rows: [MOCK_TENANT] });
    // Mock user lookup
    mockQuery.mockResolvedValueOnce({ rows: [MOCK_USER] });
    // Mock update last_login_at
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // We need to test through the router. Let's import dynamically
    const mod = await import('./auth.routes.js');
    const router = mod.default;

    // Get the login handler (POST /login is the first route)
    const loginLayer = router.stack.find(
      (l) => l.route && l.route.path === '/login' && l.route.methods.post
    );
    expect(loginLayer).toBeDefined();

    const handler = loginLayer.route.stack[0].handle;

    const req = mockReq({
      body: { codigo: 'ADMIN01', password: 'secret123', tenant_slug: 'la-xola' },
    });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    // Should return 200 with tokens
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.token).toBe(res.body.accessToken); // backward compat

    // Verify the access token is a valid JWT
    const decoded = jwt.verify(res.body.accessToken, JWT_SECRET);
    expect(decoded.sub).toBe(MOCK_USER.id);
    expect(decoded.tenant_id).toBe(MOCK_TENANT.id);
    expect(decoded.codigo).toBe('ADMIN01');

    // Verify the refresh token
    const refreshDecoded = jwt.verify(res.body.refreshToken, JWT_SECRET);
    expect(refreshDecoded.type).toBe('refresh');
    expect(refreshDecoded.jti).toBeDefined(); // unique ID for revocation
    expect(refreshDecoded.sub).toBe(MOCK_USER.id);

    // Verify user and tenant in response
    expect(res.body.user.id).toBe(MOCK_USER.id);
    expect(res.body.user.codigo).toBe('ADMIN01');
    expect(res.body.tenant.slug).toBe('la-xola');
    // Should NOT include password_hash
    expect(res.body.user.password_hash).toBeUndefined();
  });
});

describe('Auth Routes — login validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for empty body', async () => {
    const mod = await import('./auth.routes.js');
    const router = mod.default;
    const loginLayer = router.stack.find(
      (l) => l.route && l.route.path === '/login' && l.route.methods.post
    );
    const handler = loginLayer.route.stack[0].handle;

    const req = mockReq({ body: {} });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for missing password', async () => {
    const mod = await import('./auth.routes.js');
    const router = mod.default;
    const loginLayer = router.stack.find(
      (l) => l.route && l.route.path === '/login' && l.route.methods.post
    );
    const handler = loginLayer.route.stack[0].handle;

    const req = mockReq({ body: { codigo: 'ADMIN01', tenant_slug: 'x' } });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 for unknown tenant', async () => {
    // Empty tenant result
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const mod = await import('./auth.routes.js');
    const router = mod.default;
    const loginLayer = router.stack.find(
      (l) => l.route && l.route.path === '/login' && l.route.methods.post
    );
    const handler = loginLayer.route.stack[0].handle;

    const req = mockReq({
      body: { codigo: 'ADMIN01', password: 'secret', tenant_slug: 'nonexistent' },
    });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('TENANT_NOT_FOUND');
  });

  it('returns 401 for unknown user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [MOCK_TENANT] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no user found

    const mod = await import('./auth.routes.js');
    const router = mod.default;
    const loginLayer = router.stack.find(
      (l) => l.route && l.route.path === '/login' && l.route.methods.post
    );
    const handler = loginLayer.route.stack[0].handle;

    const req = mockReq({
      body: { codigo: 'UNKNOWN', password: 'secret', tenant_slug: 'la-xola' },
    });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('Auth Routes — refresh endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when no refreshToken provided', async () => {
    const mod = await import('./auth.routes.js');
    const router = mod.default;
    const refreshLayer = router.stack.find(
      (l) => l.route && l.route.path === '/refresh' && l.route.methods.post
    );
    expect(refreshLayer).toBeDefined();
    const handler = refreshLayer.route.stack[0].handle;

    const req = mockReq({ body: {} });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('REFRESH_TOKEN_REQUIRED');
  });

  it('returns 401 for invalid refresh token', async () => {
    const mod = await import('./auth.routes.js');
    const router = mod.default;
    const refreshLayer = router.stack.find(
      (l) => l.route && l.route.path === '/refresh' && l.route.methods.post
    );
    const handler = refreshLayer.route.stack[0].handle;

    const req = mockReq({ body: { refreshToken: 'invalid.token.here' } });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_TOKEN_INVALID');
  });

  it('returns 401 when using access token as refresh token', async () => {
    // Generate an access token (type is NOT 'refresh')
    const accessToken = jwt.sign(
      { sub: MOCK_USER.id, tenant_id: MOCK_TENANT.id, codigo: 'ADMIN01' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const mod = await import('./auth.routes.js');
    const router = mod.default;
    const refreshLayer = router.stack.find(
      (l) => l.route && l.route.path === '/refresh' && l.route.methods.post
    );
    const handler = refreshLayer.route.stack[0].handle;

    const req = mockReq({ body: { refreshToken: accessToken } });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN_TYPE');
  });

  it('returns new token pair for valid refresh token', async () => {
    // Generate a valid refresh token
    const validRefreshToken = jwt.sign(
      { sub: MOCK_USER.id, tenant_id: MOCK_TENANT.id, type: 'refresh', jti: 'test-jti' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Mock user lookup
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: MOCK_USER.id, tenant_id: MOCK_TENANT.id, codigo: 'ADMIN01', puesto: 'gerente', nivel_acceso: 8 }],
    });
    // Mock tenant lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ id: MOCK_TENANT.id }] });

    const mod = await import('./auth.routes.js');
    const router = mod.default;
    const refreshLayer = router.stack.find(
      (l) => l.route && l.route.path === '/refresh' && l.route.methods.post
    );
    const handler = refreshLayer.route.stack[0].handle;

    const req = mockReq({ body: { refreshToken: validRefreshToken } });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    // New refresh token should be different from old one
    expect(res.body.refreshToken).not.toBe(validRefreshToken);
  });

  it('returns 401 when user is inactive', async () => {
    const validRefreshToken = jwt.sign(
      { sub: MOCK_USER.id, tenant_id: MOCK_TENANT.id, type: 'refresh', jti: 'test-jti-2' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // User not found (inactive)
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const mod = await import('./auth.routes.js');
    const router = mod.default;
    const refreshLayer = router.stack.find(
      (l) => l.route && l.route.path === '/refresh' && l.route.methods.post
    );
    const handler = refreshLayer.route.stack[0].handle;

    const req = mockReq({ body: { refreshToken: validRefreshToken } });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('returns 401 when tenant is inactive', async () => {
    const validRefreshToken = jwt.sign(
      { sub: MOCK_USER.id, tenant_id: MOCK_TENANT.id, type: 'refresh', jti: 'test-jti-3' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // User found
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: MOCK_USER.id, tenant_id: MOCK_TENANT.id, codigo: 'ADMIN01', puesto: 'gerente', nivel_acceso: 8 }],
    });
    // Tenant not found (inactive)
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const mod = await import('./auth.routes.js');
    const router = mod.default;
    const refreshLayer = router.stack.find(
      (l) => l.route && l.route.path === '/refresh' && l.route.methods.post
    );
    const handler = refreshLayer.route.stack[0].handle;

    const req = mockReq({ body: { refreshToken: validRefreshToken } });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('TENANT_INACTIVE');
  });
});

describe('Auth Routes — /me endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    const mod = await import('./auth.routes.js');
    const router = mod.default;
    const meLayer = router.stack.find(
      (l) => l.route && l.route.path === '/me' && l.route.methods.get
    );
    expect(meLayer).toBeDefined();
    const handler = meLayer.route.stack[0].handle;

    const req = mockReq({ user: null });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns user and tenant data when authenticated', async () => {
    // Mock user query
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: MOCK_USER.id,
        tenant_id: MOCK_TENANT.id,
        codigo: 'ADMIN01',
        nombre: 'Admin User',
        email: 'admin@test.com',
        puesto: 'gerente',
        nivel_acceso: 8,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }],
    });
    // Mock tenant query
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: MOCK_TENANT.id,
        slug: 'la-xola',
        nombre: 'La Xola',
        plan: 'premium',
        config: {},
      }],
    });

    const mod = await import('./auth.routes.js');
    const router = mod.default;
    const meLayer = router.stack.find(
      (l) => l.route && l.route.path === '/me' && l.route.methods.get
    );
    const handler = meLayer.route.stack[0].handle;

    const req = mockReq({ user: { sub: MOCK_USER.id, tenant_id: MOCK_TENANT.id } });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.codigo).toBe('ADMIN01');
    expect(res.body.tenant).toBeDefined();
    expect(res.body.tenant.slug).toBe('la-xola');
  });

  it('returns 401 when user no longer exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // user not found

    const mod = await import('./auth.routes.js');
    const router = mod.default;
    const meLayer = router.stack.find(
      (l) => l.route && l.route.path === '/me' && l.route.methods.get
    );
    const handler = meLayer.route.stack[0].handle;

    const req = mockReq({ user: { sub: 'deleted-user', tenant_id: MOCK_TENANT.id } });
    const res = mockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});
