-- OPUS Migration 005: Cuentas & Consumos
-- Bills and line items — core POS transaction tables

CREATE TABLE cuentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mesa_id UUID REFERENCES mesas(id),
  folio TEXT,
  mesero_id UUID REFERENCES personal(id),
  cajero_id UUID REFERENCES personal(id),
  cliente_id UUID,
  personas INTEGER NOT NULL DEFAULT 1,
  turno TEXT,
  subtotal INTEGER NOT NULL DEFAULT 0,
  servicio INTEGER NOT NULL DEFAULT 0,
  iva INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  descuento INTEGER NOT NULL DEFAULT 0,
  propina INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'abierta' CHECK(estado IN ('abierta', 'precuenta', 'cobrada', 'cancelada')),
  forma_pago_id UUID REFERENCES formas_pago(id),
  cancelada_por TEXT,
  motivo_cancelacion TEXT,
  abierta_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrada_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE consumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cuenta_id UUID NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12,4) NOT NULL DEFAULT 1,
  precio_unitario INTEGER NOT NULL DEFAULT 0,
  importe INTEGER NOT NULL DEFAULT 0,
  referencia TEXT,
  notas TEXT,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK(estado IN ('activo', 'cancelado', 'gratis', 'cortesia')),
  comanda_impresa BOOLEAN NOT NULL DEFAULT false,
  cancelado_por TEXT,
  motivo_cancelacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cortes_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cajero_id UUID REFERENCES personal(id),
  turno TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  efectivo_sistema INTEGER NOT NULL DEFAULT 0,
  efectivo_real INTEGER NOT NULL DEFAULT 0,
  diferencia INTEGER NOT NULL DEFAULT 0,
  tarjeta INTEGER NOT NULL DEFAULT 0,
  otros INTEGER NOT NULL DEFAULT 0,
  total_ventas INTEGER NOT NULL DEFAULT 0,
  num_cuentas INTEGER NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Cuentas & Consumos
CREATE INDEX idx_cuentas_tenant ON cuentas(tenant_id);
CREATE INDEX idx_cuentas_estado ON cuentas(tenant_id, estado);
CREATE INDEX idx_cuentas_mesa ON cuentas(tenant_id, mesa_id);
CREATE INDEX idx_cuentas_fecha ON cuentas(tenant_id, abierta_en);
CREATE INDEX idx_cuentas_mesero ON cuentas(tenant_id, mesero_id);
CREATE INDEX idx_cuentas_folio ON cuentas(tenant_id, folio);
CREATE INDEX idx_consumos_tenant ON consumos(tenant_id);
CREATE INDEX idx_consumos_cuenta ON consumos(tenant_id, cuenta_id);
CREATE INDEX idx_consumos_producto ON consumos(tenant_id, producto_id);
CREATE INDEX idx_cortes_tenant ON cortes_caja(tenant_id);
CREATE INDEX idx_cortes_fecha ON cortes_caja(tenant_id, fecha);
