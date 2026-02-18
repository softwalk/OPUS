-- OPUS Migration 008: Digital Orders & Reservations
-- QR orders, delivery, takeout, reservations, customer sessions

CREATE TABLE ordenes_digitales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK(tipo IN ('qr_mesa', 'delivery', 'para_llevar')),
  mesa_id UUID REFERENCES mesas(id),
  cuenta_id UUID REFERENCES cuentas(id),
  cliente_nombre TEXT,
  cliente_telefono TEXT,
  sesion_cliente_id UUID,
  direccion_entrega TEXT,
  zona_entrega_id UUID,
  costo_envio INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL DEFAULT 0,
  iva INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  propina INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN (
    'pendiente', 'confirmada', 'en_preparacion', 'lista', 'en_camino', 'entregada', 'cancelada'
  )),
  notas TEXT,
  forma_pago TEXT,
  pagado BOOLEAN NOT NULL DEFAULT false,
  tiempo_estimado INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizada_en TIMESTAMPTZ
);

CREATE TABLE ordenes_digitales_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  orden_id UUID NOT NULL REFERENCES ordenes_digitales(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12,4) NOT NULL DEFAULT 1,
  precio_unitario INTEGER NOT NULL DEFAULT 0,
  importe INTEGER NOT NULL DEFAULT 0,
  modificadores JSONB NOT NULL DEFAULT '[]'::jsonb,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE zonas_entrega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  costo_envio INTEGER NOT NULL DEFAULT 0,
  tiempo_estimado INTEGER NOT NULL DEFAULT 30,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE direcciones_entrega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_telefono TEXT NOT NULL,
  alias TEXT,
  direccion TEXT NOT NULL,
  referencia TEXT,
  zona_entrega_id UUID REFERENCES zonas_entrega(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE qr_mesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mesa_id UUID NOT NULL REFERENCES mesas(id),
  token TEXT UNIQUE NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reservaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_nombre TEXT NOT NULL,
  cliente_telefono TEXT,
  cliente_email TEXT,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  personas INTEGER NOT NULL DEFAULT 2,
  mesa_id UUID REFERENCES mesas(id),
  zona_preferida_id UUID REFERENCES zonas(id),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'confirmada', 'sentada', 'cancelada', 'no_show')),
  codigo_confirmacion TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sesiones_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  telefono TEXT NOT NULL,
  nombre TEXT,
  codigo_otp TEXT,
  verificado BOOLEAN NOT NULL DEFAULT false,
  cliente_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE calificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  orden_id UUID REFERENCES ordenes_digitales(id),
  cuenta_id UUID REFERENCES cuentas(id),
  estrellas INTEGER NOT NULL CHECK(estrellas BETWEEN 1 AND 5),
  comentario TEXT,
  cliente_nombre TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Digital Orders
CREATE INDEX idx_ordenes_dig_tenant ON ordenes_digitales(tenant_id);
CREATE INDEX idx_ordenes_dig_estado ON ordenes_digitales(tenant_id, estado);
CREATE INDEX idx_ordenes_dig_fecha ON ordenes_digitales(tenant_id, created_at);
CREATE INDEX idx_ordenes_dig_items_tenant ON ordenes_digitales_items(tenant_id);
CREATE INDEX idx_ordenes_dig_items_orden ON ordenes_digitales_items(orden_id);
CREATE INDEX idx_zonas_entrega_tenant ON zonas_entrega(tenant_id);
CREATE INDEX idx_direcciones_tenant ON direcciones_entrega(tenant_id);
CREATE INDEX idx_qr_mesas_tenant ON qr_mesas(tenant_id);
CREATE INDEX idx_qr_mesas_token ON qr_mesas(token);
CREATE INDEX idx_reservaciones_tenant ON reservaciones(tenant_id);
CREATE INDEX idx_reservaciones_fecha ON reservaciones(tenant_id, fecha);
CREATE INDEX idx_sesiones_tenant ON sesiones_cliente(tenant_id);
CREATE INDEX idx_calificaciones_tenant ON calificaciones(tenant_id);
