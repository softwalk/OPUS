-- OPUS Migration 007: Kitchen Display System
-- KDS queue with urgency tracking

CREATE TABLE cocina_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo_origen TEXT NOT NULL DEFAULT 'pos' CHECK(tipo_origen IN ('pos', 'digital')),
  cuenta_id UUID REFERENCES cuentas(id),
  orden_digital_id UUID,
  mesa_numero INTEGER,
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'en_preparacion', 'listo', 'entregado')),
  prioridad INTEGER NOT NULL DEFAULT 0 CHECK(prioridad IN (0, 1)),
  area TEXT,
  mesero_nombre TEXT,
  tiempo_estimado INTEGER,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  inicio_preparacion TIMESTAMPTZ,
  listo_en TIMESTAMPTZ,
  entregado_en TIMESTAMPTZ
);

-- Indexes for Kitchen
CREATE INDEX idx_cocina_tenant ON cocina_queue(tenant_id);
CREATE INDEX idx_cocina_estado ON cocina_queue(tenant_id, estado);
CREATE INDEX idx_cocina_fecha ON cocina_queue(tenant_id, created_at);
