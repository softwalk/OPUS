import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// DB Helpers
// ============================================================================

describe('withTransaction', () => {
  let withTransaction;

  beforeEach(async () => {
    const mod = await import('./db.js');
    withTransaction = mod.withTransaction;
  });

  it('calls BEGIN, executes fn, then COMMIT', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const fn = vi.fn().mockResolvedValue({ ok: true });

    const result = await withTransaction(client, fn);

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(fn).toHaveBeenCalledWith(client);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(result).toEqual({ ok: true });
  });

  it('calls ROLLBACK when fn throws and re-throws', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const fn = vi.fn().mockRejectedValue(new Error('DB failure'));

    await expect(withTransaction(client, fn)).rejects.toThrow('DB failure');

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
  });
});

describe('paginatedQuery', () => {
  let paginatedQuery;

  beforeEach(async () => {
    const mod = await import('./db.js');
    paginatedQuery = mod.paginatedQuery;
  });

  it('returns paginated result with correct structure', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ total: 50 }] }) // count query
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] }), // data query
    };

    const result = await paginatedQuery(client, {
      baseTable: 'productos',
      selectColumns: 'id, nombre',
      page: 2,
      limit: 10,
    });

    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      total: 50,
      page: 2,
      limit: 10,
      pages: 5,
    });
  });

  it('applies WHERE conditions and params', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ total: 3 }] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await paginatedQuery(client, {
      baseTable: 'productos p',
      selectColumns: 'p.*',
      conditions: ['p.activo = $1', 'p.tipo = $2'],
      params: [true, 'terminado'],
      page: 1,
      limit: 20,
    });

    // Count query should include WHERE
    const countCall = client.query.mock.calls[0];
    expect(countCall[0]).toContain('WHERE p.activo = $1 AND p.tipo = $2');
    expect(countCall[1]).toEqual([true, 'terminado']);

    // Data query should include WHERE + LIMIT/OFFSET
    const dataCall = client.query.mock.calls[1];
    expect(dataCall[0]).toContain('WHERE p.activo = $1 AND p.tipo = $2');
    expect(dataCall[0]).toContain('LIMIT $3 OFFSET $4');
    expect(dataCall[1]).toEqual([true, 'terminado', 20, 0]);
  });

  it('defaults to page 1, limit 20', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    const result = await paginatedQuery(client, {
      baseTable: 'tabla',
      selectColumns: '*',
    });

    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.pages).toBe(1); // min 1 page
  });

  it('calculates correct offset for page > 1', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ total: 100 }] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await paginatedQuery(client, {
      baseTable: 'tabla',
      selectColumns: '*',
      page: 3,
      limit: 25,
    });

    // offset = (3 - 1) * 25 = 50
    const dataCall = client.query.mock.calls[1];
    expect(dataCall[1]).toContain(50); // offset
    expect(dataCall[1]).toContain(25); // limit
  });
});

describe('buildDynamicUpdate', () => {
  let buildDynamicUpdate;

  beforeEach(async () => {
    const mod = await import('./db.js');
    buildDynamicUpdate = mod.buildDynamicUpdate;
  });

  it('builds SET clauses from matching fields', () => {
    const data = { nombre: 'Juan', telefono: '555-1234', extra: 'ignored' };
    const result = buildDynamicUpdate(data, ['nombre', 'telefono', 'email']);

    expect(result).toEqual({
      setClauses: ['nombre = $1', 'telefono = $2'],
      params: ['Juan', '555-1234'],
      nextIdx: 3,
    });
  });

  it('returns null when no fields match', () => {
    const data = { extra: 'ignored' };
    const result = buildDynamicUpdate(data, ['nombre', 'telefono']);

    expect(result).toBeNull();
  });

  it('respects startIdx parameter', () => {
    const data = { nombre: 'Test' };
    const result = buildDynamicUpdate(data, ['nombre'], 3);

    expect(result.setClauses).toEqual(['nombre = $3']);
    expect(result.nextIdx).toBe(4);
  });

  it('includes fields with falsy values (0, empty string, false)', () => {
    const data = { activo: false, precio: 0, nota: '' };
    const result = buildDynamicUpdate(data, ['activo', 'precio', 'nota']);

    expect(result.params).toEqual([false, 0, '']);
    expect(result.setClauses.length).toBe(3);
  });

  it('skips fields that are undefined', () => {
    const data = { nombre: 'Test', telefono: undefined };
    const result = buildDynamicUpdate(data, ['nombre', 'telefono']);

    expect(result.setClauses).toEqual(['nombre = $1']);
    expect(result.params).toEqual(['Test']);
  });
});

describe('findOneOr404', () => {
  let findOneOr404;

  beforeEach(async () => {
    const mod = await import('./db.js');
    findOneOr404 = mod.findOneOr404;
  });

  it('returns row when found', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: '1', nombre: 'Test' }] }),
    };

    const result = await findOneOr404(client, 'productos', '1');

    expect(result).toEqual({ row: { id: '1', nombre: 'Test' } });
  });

  it('returns error when not found', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    const result = await findOneOr404(client, 'productos', 'nonexistent');

    expect(result.error).toBe(true);
    expect(result.status).toBe(404);
    expect(result.code).toBe('PRODUCTOS_NOT_FOUND');
  });

  it('uses custom entity name and error code', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    const result = await findOneOr404(client, 'productos', '1', {
      entityName: 'Producto',
      errorCode: 'PRODUCT_NOT_FOUND',
    });

    expect(result.code).toBe('PRODUCT_NOT_FOUND');
    expect(result.message).toBe('Producto no encontrado');
  });
});

// ============================================================================
// Route Helpers
// ============================================================================

describe('asyncHandler', () => {
  let asyncHandler;

  beforeEach(async () => {
    const mod = await import('./route.js');
    asyncHandler = mod.asyncHandler;
  });

  it('calls the wrapped function with req, res, next', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const req = {}, res = {}, next = vi.fn();

    await asyncHandler(fn)(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards errors to next()', async () => {
    const error = new Error('boom');
    const fn = vi.fn().mockRejectedValue(error);
    const req = {}, res = {}, next = vi.fn();

    await asyncHandler(fn)(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('sendResult', () => {
  let sendResult;

  beforeEach(async () => {
    const mod = await import('./route.js');
    sendResult = mod.sendResult;
  });

  function mockRes() {
    const res = { statusCode: 200, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
  }

  it('sends success result as JSON with 200', () => {
    const res = mockRes();
    sendResult(res, { data: [1, 2, 3], total: 3 });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: [1, 2, 3], total: 3 });
  });

  it('sends success result with custom status', () => {
    const res = mockRes();
    sendResult(res, { id: '123' }, 201);

    expect(res.statusCode).toBe(201);
  });

  it('sends error result with error status and format', () => {
    const res = mockRes();
    sendResult(res, {
      error: true,
      status: 404,
      code: 'NOT_FOUND',
      message: 'No encontrado',
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'No encontrado' },
    });
  });

  it('defaults error status to 400', () => {
    const res = mockRes();
    sendResult(res, { error: true, code: 'BAD', message: 'malo' });

    expect(res.statusCode).toBe(400);
  });
});

describe('auditCtx', () => {
  let auditCtx;

  beforeEach(async () => {
    const mod = await import('./route.js');
    auditCtx = mod.auditCtx;
  });

  it('extracts audit fields from req', () => {
    const req = {
      tenantId: 'tenant-1',
      user: { codigo: 'ADMIN01', sub: 'user-1' },
      ip: '192.168.1.1',
    };

    expect(auditCtx(req)).toEqual({
      tenantId: 'tenant-1',
      usuario: 'ADMIN01',
      usuarioId: 'user-1',
      ip: '192.168.1.1',
    });
  });

  it('defaults to system when no user', () => {
    const req = { tenantId: 't1', user: null, ip: '::1' };

    const ctx = auditCtx(req);
    expect(ctx.usuario).toBe('system');
    expect(ctx.usuarioId).toBeNull();
  });
});

describe('emitEvent', () => {
  let emitEvent;

  beforeEach(async () => {
    const mod = await import('./route.js');
    emitEvent = mod.emitEvent;
  });

  it('calls broadcast with tenant, event, and data', () => {
    const broadcast = vi.fn();
    const req = {
      tenantId: 'tenant-1',
      app: { get: vi.fn().mockReturnValue(broadcast) },
    };

    emitEvent(req, 'mesa:update', { mesaId: 5 });

    expect(broadcast).toHaveBeenCalledWith('tenant-1', 'mesa:update', { mesaId: 5 });
  });

  it('does nothing when broadcast is not available', () => {
    const req = {
      tenantId: 'tenant-1',
      app: { get: vi.fn().mockReturnValue(null) },
    };

    // Should not throw
    expect(() => emitEvent(req, 'test', {})).not.toThrow();
  });

  it('does nothing when tenantId is missing', () => {
    const broadcast = vi.fn();
    const req = {
      tenantId: null,
      app: { get: vi.fn().mockReturnValue(broadcast) },
    };

    emitEvent(req, 'test', {});
    expect(broadcast).not.toHaveBeenCalled();
  });
});
