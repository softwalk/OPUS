-- OPUS Migration 011: System Tables
-- Audit trail and notifications

CREATE TABLE auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  entidad TEXT,
  entidad_id TEXT,
  descripcion TEXT,
  datos_json JSONB,
  usuario TEXT,
  usuario_id UUID,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  destinatario_tipo TEXT NOT NULL CHECK(destinatario_tipo IN ('mesero', 'cocina', 'gerente', 'cliente')),
  destinatario_id UUID,
  titulo TEXT NOT NULL,
  mensaje TEXT,
  tipo TEXT NOT NULL DEFAULT 'info' CHECK(tipo IN ('info', 'alerta', 'urgente')),
  referencia_tipo TEXT,
  referencia_id TEXT,
  leida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for System
CREATE INDEX idx_auditoria_tenant ON auditoria(tenant_id);
CREATE INDEX idx_auditoria_tipo ON auditoria(tenant_id, tipo);
CREATE INDEX idx_auditoria_fecha ON auditoria(tenant_id, created_at DESC);
CREATE INDEX idx_auditoria_entidad ON auditoria(tenant_id, entidad, entidad_id);
CREATE INDEX idx_notificaciones_tenant ON notificaciones(tenant_id);
CREATE INDEX idx_notificaciones_dest ON notificaciones(tenant_id, destinatario_tipo, destinatario_id);
CREATE INDEX idx_notificaciones_leida ON notificaciones(tenant_id, leida) WHERE leida = false;
