-- OPUS Migration 010: Finance Tables
-- Clients, suppliers, invoices, AR, AP, journal entries, purchase orders

CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo TEXT,
  nombre TEXT NOT NULL,
  rfc TEXT,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  limite_credito INTEGER NOT NULL DEFAULT 0,
  saldo INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  -- Loyalty fields
  puntos_acumulados INTEGER NOT NULL DEFAULT 0,
  nivel_fidelizacion TEXT NOT NULL DEFAULT 'bronce' CHECK(nivel_fidelizacion IN ('bronce', 'plata', 'oro', 'platino')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo TEXT,
  nombre TEXT NOT NULL,
  rfc TEXT,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  contacto TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  folio TEXT,
  cuenta_id UUID REFERENCES cuentas(id),
  cliente_id UUID REFERENCES clientes(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal INTEGER NOT NULL DEFAULT 0,
  iva INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'activa' CHECK(estado IN ('activa', 'cancelada', 'pagada')),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cuentas_cobrar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id),
  cuenta_id UUID REFERENCES cuentas(id),
  factura_id UUID REFERENCES facturas(id),
  concepto TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  importe INTEGER NOT NULL DEFAULT 0,
  saldo INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'pagada', 'cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cuentas_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proveedor_id UUID REFERENCES proveedores(id),
  orden_compra_id UUID,
  concepto TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  importe INTEGER NOT NULL DEFAULT 0,
  saldo INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'pagada', 'cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE polizas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK(tipo IN ('ingreso', 'egreso')),
  cuenta TEXT,
  num_documento TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion TEXT,
  importe INTEGER NOT NULL DEFAULT 0,
  iva INTEGER NOT NULL DEFAULT 0,
  forma_pago TEXT,
  referencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ordenes_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  folio TEXT,
  proveedor_id UUID NOT NULL REFERENCES proveedores(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega DATE,
  subtotal INTEGER NOT NULL DEFAULT 0,
  iva INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'recibida', 'cancelada')),
  notas TEXT,
  recibida_por TEXT,
  recibida_en TIMESTAMPTZ,
  almacen_recepcion_id UUID REFERENCES almacenes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orden_compra_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  orden_compra_id UUID NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12,4) NOT NULL DEFAULT 1,
  precio_unitario INTEGER NOT NULL DEFAULT 0,
  importe INTEGER NOT NULL DEFAULT 0,
  cantidad_recibida NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legacy tables (preserved from v1)
CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  total INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pedido_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12,4) NOT NULL DEFAULT 1,
  precio_unitario INTEGER NOT NULL DEFAULT 0,
  importe INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from cuentas_pagar to ordenes_compra
ALTER TABLE cuentas_pagar ADD CONSTRAINT fk_cxp_oc
  FOREIGN KEY (orden_compra_id) REFERENCES ordenes_compra(id);

-- Add FK from fidelizacion_puntos to clientes
ALTER TABLE fidelizacion_puntos ADD CONSTRAINT fk_fid_cliente
  FOREIGN KEY (cliente_id) REFERENCES clientes(id);

-- Add FK from sesiones_cliente to clientes
ALTER TABLE sesiones_cliente ADD CONSTRAINT fk_sesion_cliente
  FOREIGN KEY (cliente_id) REFERENCES clientes(id);

-- Add FK from cuentas to clientes
ALTER TABLE cuentas ADD CONSTRAINT fk_cuenta_cliente
  FOREIGN KEY (cliente_id) REFERENCES clientes(id);

-- Add FK from ordenes_digitales to zonas_entrega
ALTER TABLE ordenes_digitales ADD CONSTRAINT fk_orden_zona
  FOREIGN KEY (zona_entrega_id) REFERENCES zonas_entrega(id);

-- Indexes for Finance
CREATE INDEX idx_clientes_tenant ON clientes(tenant_id);
CREATE INDEX idx_proveedores_tenant ON proveedores(tenant_id);
CREATE INDEX idx_facturas_tenant ON facturas(tenant_id);
CREATE INDEX idx_facturas_fecha ON facturas(tenant_id, fecha);
CREATE INDEX idx_cxc_tenant ON cuentas_cobrar(tenant_id);
CREATE INDEX idx_cxc_estado ON cuentas_cobrar(tenant_id, estado);
CREATE INDEX idx_cxp_tenant ON cuentas_pagar(tenant_id);
CREATE INDEX idx_cxp_estado ON cuentas_pagar(tenant_id, estado);
CREATE INDEX idx_polizas_tenant ON polizas(tenant_id);
CREATE INDEX idx_polizas_fecha ON polizas(tenant_id, fecha);
CREATE INDEX idx_oc_tenant ON ordenes_compra(tenant_id);
CREATE INDEX idx_oc_estado ON ordenes_compra(tenant_id, estado);
CREATE INDEX idx_oc_lineas_tenant ON orden_compra_lineas(tenant_id);
CREATE INDEX idx_oc_lineas_oc ON orden_compra_lineas(orden_compra_id);
CREATE INDEX idx_pedidos_tenant ON pedidos(tenant_id);
CREATE INDEX idx_pedido_lineas_tenant ON pedido_lineas(tenant_id);
