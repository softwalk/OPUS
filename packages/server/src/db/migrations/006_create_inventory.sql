-- OPUS Migration 006: Inventory Tables
-- Warehouses, stock levels, movements, lost sales, alerts, overrides

CREATE TABLE almacenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, numero)
);

CREATE TABLE existencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  almacen_id UUID NOT NULL REFERENCES almacenes(id),
  cantidad NUMERIC(12,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, producto_id, almacen_id)
);

CREATE TABLE movimientos_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  almacen_id UUID NOT NULL REFERENCES almacenes(id),
  tipo TEXT NOT NULL CHECK(tipo IN (
    'entrada_compra', 'entrada_traspaso', 'entrada_produccion', 'entrada_ajuste',
    'salida_venta', 'salida_traspaso', 'salida_desperdicio', 'salida_copeo', 'salida_ajuste'
  )),
  cantidad NUMERIC(12,4) NOT NULL,
  costo_unitario INTEGER NOT NULL DEFAULT 0,
  referencia TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ventas_perdidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12,4) NOT NULL DEFAULT 1,
  motivo TEXT NOT NULL CHECK(motivo IN ('sin_stock', 'suspendido_86', 'otro')),
  precio_perdido INTEGER NOT NULL DEFAULT 0,
  mesero_id UUID REFERENCES personal(id),
  mesa_numero INTEGER,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE alertas_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  almacen_id UUID NOT NULL REFERENCES almacenes(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('bajo_minimo', 'agotado', 'punto_reorden')),
  cantidad_actual NUMERIC(12,4) NOT NULL DEFAULT 0,
  nivel_minimo NUMERIC(12,4) NOT NULL DEFAULT 0,
  atendida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sobregiros_autorizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cuenta_id UUID REFERENCES cuentas(id),
  cantidad NUMERIC(12,4) NOT NULL DEFAULT 1,
  autorizado_por TEXT NOT NULL,
  gerente_id UUID REFERENCES personal(id),
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Inventory
CREATE INDEX idx_almacenes_tenant ON almacenes(tenant_id);
CREATE INDEX idx_existencias_tenant ON existencias(tenant_id);
CREATE INDEX idx_existencias_producto ON existencias(tenant_id, producto_id);
CREATE INDEX idx_existencias_almacen ON existencias(tenant_id, almacen_id);
CREATE INDEX idx_movimientos_tenant ON movimientos_inventario(tenant_id);
CREATE INDEX idx_movimientos_producto ON movimientos_inventario(tenant_id, producto_id);
CREATE INDEX idx_movimientos_fecha ON movimientos_inventario(tenant_id, fecha);
CREATE INDEX idx_movimientos_tipo ON movimientos_inventario(tenant_id, tipo);
CREATE INDEX idx_ventas_perdidas_tenant ON ventas_perdidas(tenant_id);
CREATE INDEX idx_ventas_perdidas_producto ON ventas_perdidas(tenant_id, producto_id);
CREATE INDEX idx_ventas_perdidas_fecha ON ventas_perdidas(tenant_id, created_at);
CREATE INDEX idx_alertas_tenant ON alertas_stock(tenant_id);
CREATE INDEX idx_sobregiros_tenant ON sobregiros_autorizados(tenant_id);
