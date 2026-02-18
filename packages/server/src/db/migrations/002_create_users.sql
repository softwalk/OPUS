-- OPUS Migration 002: Users (authentication)
-- Users belong to a tenant and authenticate with bcrypt passwords

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  puesto TEXT NOT NULL CHECK(puesto IN ('mesero', 'cajero', 'cocinero', 'subgerente', 'gerente', 'superadmin')),
  nivel_acceso INTEGER NOT NULL DEFAULT 1 CHECK(nivel_acceso BETWEEN 1 AND 99),
  activo BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, codigo)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_codigo ON users(tenant_id, codigo);
