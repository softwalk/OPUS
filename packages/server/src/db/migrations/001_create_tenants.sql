-- OPUS Migration 001: Platform Tables (no tenant_id)
-- Tenants and tenant configuration

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'enterprise')),
  config JSONB NOT NULL DEFAULT '{
    "iva_porcentaje": 16,
    "servicio_porcentaje": 0,
    "timezone": "America/Mexico_City",
    "moneda": "MXN",
    "kds_alerta_min": 8,
    "kds_critico_min": 15,
    "max_almacenes": 8
  }'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_activo ON tenants(activo);
