import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  abrirMesaSchema,
  consumoCreateSchema,
  cobrarSchema,
  productoCreateSchema,
  productoUpdateSchema,
  recetaCreateSchema,
  elaborarSchema,
  movimientoCreateSchema,
  ordenCreateSchema,
  reservacionCreateSchema,
  abonarSchema,
  compraCreateSchema,
  personalCreateSchema,
  paginationSchema,
  dateRangeSchema,
  clienteLoginSchema,
  clientePedirSchema,
  calificacionSchema,
  traspasoSchema,
  ajusteSchema,
  facturaCreateSchema,
  zonaEntregaCreateSchema,
  grupoCreateSchema,
  ordenEstadoSchema,
  reservacionEstadoSchema,
  explosionBOMSchema,
  qrGenerateSchema,
  modificadorCreateSchema,
} from './index.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

// ============================================================================
// Auth
// ============================================================================

describe('loginSchema', () => {
  it('validates correct login data', () => {
    const result = loginSchema.safeParse({
      codigo: 'ADMIN01',
      password: 'secret123',
      tenant_slug: 'la-xola',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty fields', () => {
    expect(loginSchema.safeParse({ codigo: '', password: 'x', tenant_slug: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ codigo: 'x', password: '', tenant_slug: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ codigo: 'x', password: 'x', tenant_slug: '' }).success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ codigo: 'x' }).success).toBe(false);
  });
});

// ============================================================================
// POS
// ============================================================================

describe('abrirMesaSchema', () => {
  it('accepts minimal data with defaults', () => {
    const result = abrirMesaSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.personas).toBe(1);
  });

  it('accepts mesero_id as UUID', () => {
    const result = abrirMesaSchema.safeParse({ personas: 4, mesero_id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('rejects invalid mesero_id', () => {
    expect(abrirMesaSchema.safeParse({ mesero_id: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects personas < 1', () => {
    expect(abrirMesaSchema.safeParse({ personas: 0 }).success).toBe(false);
    expect(abrirMesaSchema.safeParse({ personas: -1 }).success).toBe(false);
  });
});

describe('consumoCreateSchema', () => {
  it('validates a valid consumo', () => {
    const result = consumoCreateSchema.safeParse({
      cuenta_id: VALID_UUID,
      producto_id: VALID_UUID,
      cantidad: 2,
    });
    expect(result.success).toBe(true);
  });

  it('defaults cantidad to 1', () => {
    const result = consumoCreateSchema.safeParse({
      cuenta_id: VALID_UUID,
      producto_id: VALID_UUID,
    });
    expect(result.success).toBe(true);
    expect(result.data.cantidad).toBe(1);
  });

  it('rejects negative cantidad', () => {
    expect(consumoCreateSchema.safeParse({
      cuenta_id: VALID_UUID,
      producto_id: VALID_UUID,
      cantidad: -1,
    }).success).toBe(false);
  });
});

describe('cobrarSchema', () => {
  it('validates a valid cobro', () => {
    const result = cobrarSchema.safeParse({
      forma_pago_id: VALID_UUID,
      propina: 500,
    });
    expect(result.success).toBe(true);
  });

  it('defaults propina to 0', () => {
    const result = cobrarSchema.safeParse({ forma_pago_id: VALID_UUID });
    expect(result.success).toBe(true);
    expect(result.data.propina).toBe(0);
  });

  it('rejects negative propina', () => {
    expect(cobrarSchema.safeParse({
      forma_pago_id: VALID_UUID,
      propina: -100,
    }).success).toBe(false);
  });
});

// ============================================================================
// Catalog
// ============================================================================

describe('productoCreateSchema', () => {
  it('validates minimal product', () => {
    const result = productoCreateSchema.safeParse({
      clave: 'PROD01',
      descripcion: 'Test product',
    });
    expect(result.success).toBe(true);
    expect(result.data.tipo).toBe('insumo');
    expect(result.data.unidad).toBe('pza');
  });

  it('rejects description < 3 chars', () => {
    expect(productoCreateSchema.safeParse({
      clave: 'X',
      descripcion: 'ab',
    }).success).toBe(false);
  });
});

describe('productoUpdateSchema', () => {
  it('allows partial updates', () => {
    const result = productoUpdateSchema.safeParse({ precio_venta: 5000 });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    expect(productoUpdateSchema.safeParse({}).success).toBe(true);
  });
});

// ============================================================================
// Orders
// ============================================================================

describe('ordenCreateSchema', () => {
  it('validates a delivery order', () => {
    const result = ordenCreateSchema.safeParse({
      tipo: 'delivery',
      items: [{ producto_id: VALID_UUID, cantidad: 2 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty items', () => {
    expect(ordenCreateSchema.safeParse({
      tipo: 'delivery',
      items: [],
    }).success).toBe(false);
  });

  it('rejects invalid tipo', () => {
    expect(ordenCreateSchema.safeParse({
      tipo: 'invalid',
      items: [{ producto_id: VALID_UUID }],
    }).success).toBe(false);
  });
});

describe('ordenEstadoSchema', () => {
  it('validates all valid states', () => {
    const states = ['pendiente', 'confirmada', 'en_preparacion', 'lista', 'en_camino', 'entregada', 'cancelada'];
    for (const estado of states) {
      expect(ordenEstadoSchema.safeParse({ estado }).success).toBe(true);
    }
  });

  it('rejects invalid state', () => {
    expect(ordenEstadoSchema.safeParse({ estado: 'unknown' }).success).toBe(false);
  });
});

// ============================================================================
// Reservaciones
// ============================================================================

describe('reservacionCreateSchema', () => {
  it('validates a valid reservation', () => {
    const result = reservacionCreateSchema.safeParse({
      cliente_nombre: 'Juan Pérez',
      cliente_telefono: '5512345678',
      fecha: '2026-03-15',
      hora: '20:00',
      personas: 4,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format', () => {
    expect(reservacionCreateSchema.safeParse({
      cliente_nombre: 'Juan',
      cliente_telefono: '5512345678',
      fecha: '15/03/2026', // wrong format
      hora: '20:00',
    }).success).toBe(false);
  });
});

describe('reservacionEstadoSchema', () => {
  it('validates all valid states', () => {
    const states = ['confirmada', 'sentada', 'completada', 'cancelada', 'no_show'];
    for (const estado of states) {
      expect(reservacionEstadoSchema.safeParse({ estado }).success).toBe(true);
    }
  });
});

// ============================================================================
// Finance
// ============================================================================

describe('abonarSchema', () => {
  it('accepts positive integer', () => {
    expect(abonarSchema.safeParse({ monto: 5000 }).success).toBe(true);
  });

  it('rejects zero', () => {
    expect(abonarSchema.safeParse({ monto: 0 }).success).toBe(false);
  });

  it('rejects negative', () => {
    expect(abonarSchema.safeParse({ monto: -100 }).success).toBe(false);
  });
});

describe('compraCreateSchema', () => {
  it('validates a purchase order', () => {
    const result = compraCreateSchema.safeParse({
      proveedor_id: VALID_UUID,
      lineas: [{
        producto_id: VALID_UUID,
        cantidad: 10,
        precio_unitario: 5000,
      }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty lineas', () => {
    expect(compraCreateSchema.safeParse({
      proveedor_id: VALID_UUID,
      lineas: [],
    }).success).toBe(false);
  });
});

describe('facturaCreateSchema', () => {
  it('validates a factura', () => {
    const result = facturaCreateSchema.safeParse({
      subtotal: 10000,
      iva: 1600,
      total: 11600,
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero total', () => {
    expect(facturaCreateSchema.safeParse({
      subtotal: 0,
      iva: 0,
      total: 0,
    }).success).toBe(false);
  });
});

// ============================================================================
// Public client endpoints
// ============================================================================

describe('clienteLoginSchema', () => {
  it('validates login data', () => {
    const result = clienteLoginSchema.safeParse({
      telefono: '5512345678',
      tenant_slug: 'la-xola',
    });
    expect(result.success).toBe(true);
  });

  it('rejects short phone', () => {
    expect(clienteLoginSchema.safeParse({
      telefono: '123',
      tenant_slug: 'x',
    }).success).toBe(false);
  });
});

describe('clientePedirSchema', () => {
  it('validates a public order', () => {
    const result = clientePedirSchema.safeParse({
      tenant_slug: 'la-xola',
      tipo: 'delivery',
      items: [{ producto_id: VALID_UUID, cantidad: 1 }],
    });
    expect(result.success).toBe(true);
  });
});

describe('calificacionSchema', () => {
  it('validates a rating', () => {
    expect(calificacionSchema.safeParse({ puntuacion: 5 }).success).toBe(true);
    expect(calificacionSchema.safeParse({ puntuacion: 1 }).success).toBe(true);
  });

  it('rejects out-of-range', () => {
    expect(calificacionSchema.safeParse({ puntuacion: 0 }).success).toBe(false);
    expect(calificacionSchema.safeParse({ puntuacion: 6 }).success).toBe(false);
  });
});

// ============================================================================
// Inventory
// ============================================================================

describe('traspasoSchema', () => {
  it('validates a transfer', () => {
    const result = traspasoSchema.safeParse({
      producto_id: VALID_UUID,
      de_almacen_id: VALID_UUID,
      a_almacen_id: VALID_UUID,
      cantidad: 10,
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero cantidad', () => {
    expect(traspasoSchema.safeParse({
      producto_id: VALID_UUID,
      de_almacen_id: VALID_UUID,
      a_almacen_id: VALID_UUID,
      cantidad: 0,
    }).success).toBe(false);
  });
});

describe('ajusteSchema', () => {
  it('validates an adjustment', () => {
    const result = ajusteSchema.safeParse({
      producto_id: VALID_UUID,
      almacen_id: VALID_UUID,
      cantidad_real: 50,
    });
    expect(result.success).toBe(true);
  });

  it('allows zero quantity (empty shelf)', () => {
    expect(ajusteSchema.safeParse({
      producto_id: VALID_UUID,
      almacen_id: VALID_UUID,
      cantidad_real: 0,
    }).success).toBe(true);
  });

  it('rejects negative quantity', () => {
    expect(ajusteSchema.safeParse({
      producto_id: VALID_UUID,
      almacen_id: VALID_UUID,
      cantidad_real: -1,
    }).success).toBe(false);
  });
});

// ============================================================================
// Misc
// ============================================================================

describe('grupoCreateSchema', () => {
  it('validates a group', () => {
    expect(grupoCreateSchema.safeParse({ nombre: 'Bebidas' }).success).toBe(true);
  });

  it('rejects empty nombre', () => {
    expect(grupoCreateSchema.safeParse({ nombre: '' }).success).toBe(false);
  });
});

describe('zonaEntregaCreateSchema', () => {
  it('validates with defaults', () => {
    const result = zonaEntregaCreateSchema.safeParse({ nombre: 'Centro' });
    expect(result.success).toBe(true);
    expect(result.data.costo_envio).toBe(0);
  });
});

describe('explosionBOMSchema', () => {
  it('validates explosion request', () => {
    const result = explosionBOMSchema.safeParse({ producto_id: VALID_UUID });
    expect(result.success).toBe(true);
    expect(result.data.porciones).toBe(1);
  });
});

describe('qrGenerateSchema', () => {
  it('validates QR generate request', () => {
    expect(qrGenerateSchema.safeParse({ mesa_id: VALID_UUID }).success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    expect(qrGenerateSchema.safeParse({ mesa_id: 'bad' }).success).toBe(false);
  });
});

describe('modificadorCreateSchema', () => {
  it('validates a modificador', () => {
    const result = modificadorCreateSchema.safeParse({ nombre: 'Sin cebolla' });
    expect(result.success).toBe(true);
    expect(result.data.precio_extra).toBe(0);
  });
});

// ============================================================================
// Generic
// ============================================================================

describe('paginationSchema', () => {
  it('provides defaults', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ page: 1, limit: 50 });
  });

  it('coerces string values', () => {
    const result = paginationSchema.safeParse({ page: '3', limit: '25' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ page: 3, limit: 25 });
  });

  it('rejects limit > 100', () => {
    expect(paginationSchema.safeParse({ limit: 200 }).success).toBe(false);
  });
});

describe('dateRangeSchema', () => {
  it('accepts valid dates', () => {
    const result = dateRangeSchema.safeParse({ desde: '2026-01-01', hasta: '2026-12-31' });
    expect(result.success).toBe(true);
  });

  it('accepts empty (both optional)', () => {
    expect(dateRangeSchema.safeParse({}).success).toBe(true);
  });

  it('rejects invalid format', () => {
    expect(dateRangeSchema.safeParse({ desde: '01/01/2026' }).success).toBe(false);
  });
});
