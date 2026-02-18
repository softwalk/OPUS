-- OPUS Migration 004: Catalog Tables
-- Product groups, products, recipes, modifiers

CREATE TABLE grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  orden_display INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  clave TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  grupo_id UUID REFERENCES grupos(id),
  tipo TEXT NOT NULL DEFAULT 'insumo' CHECK(tipo IN ('insumo', 'subproducto', 'terminado')),
  unidad TEXT NOT NULL DEFAULT 'pza',
  contenido NUMERIC(12,4) NOT NULL DEFAULT 1,
  precio_venta INTEGER NOT NULL DEFAULT 0,
  costo_unitario INTEGER NOT NULL DEFAULT 0,
  costo_integrado INTEGER NOT NULL DEFAULT 0,
  punto_reorden NUMERIC(12,4) NOT NULL DEFAULT 0,
  area_produccion TEXT,
  porciones NUMERIC(12,4) NOT NULL DEFAULT 1,
  imagen_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  -- Stock control fields (v4)
  suspendido_86 BOOLEAN NOT NULL DEFAULT false,
  suspendido_86_motivo TEXT,
  suspendido_86_por TEXT,
  suspendido_86_en TIMESTAMPTZ,
  nivel_minimo_critico NUMERIC(12,4) NOT NULL DEFAULT 5,
  bloquear_sin_stock BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, clave)
);

CREATE TABLE recetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12,4) NOT NULL DEFAULT 1,
  unidad TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE modificadores_producto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  precio_extra INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Catalog
CREATE INDEX idx_grupos_tenant ON grupos(tenant_id);
CREATE INDEX idx_productos_tenant ON productos(tenant_id);
CREATE INDEX idx_productos_clave ON productos(tenant_id, clave);
CREATE INDEX idx_productos_tipo ON productos(tenant_id, tipo);
CREATE INDEX idx_productos_grupo ON productos(tenant_id, grupo_id);
CREATE INDEX idx_productos_86 ON productos(tenant_id, suspendido_86) WHERE suspendido_86 = true;
CREATE INDEX idx_recetas_tenant ON recetas(tenant_id);
CREATE INDEX idx_recetas_producto ON recetas(tenant_id, producto_id);
CREATE INDEX idx_modificadores_tenant ON modificadores_producto(tenant_id);
CREATE INDEX idx_modificadores_producto ON modificadores_producto(tenant_id, producto_id);
