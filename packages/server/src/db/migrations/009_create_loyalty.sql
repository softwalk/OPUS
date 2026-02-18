-- OPUS Migration 009: Loyalty Program (Fidelizacion)
-- Points config, transactions, and tier management

CREATE TABLE fidelizacion_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  puntos_por_peso NUMERIC(8,4) NOT NULL DEFAULT 0.1,
  puntos_canjeables_min INTEGER NOT NULL DEFAULT 100,
  valor_punto NUMERIC(8,4) NOT NULL DEFAULT 0.5,
  nivel_bronce_puntos INTEGER NOT NULL DEFAULT 0,
  nivel_plata_puntos INTEGER NOT NULL DEFAULT 500,
  nivel_oro_puntos INTEGER NOT NULL DEFAULT 2000,
  nivel_platino_puntos INTEGER NOT NULL DEFAULT 5000,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fidelizacion_puntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('acumulado', 'canjeado', 'ajuste', 'bono')),
  puntos INTEGER NOT NULL,
  saldo_anterior INTEGER NOT NULL DEFAULT 0,
  saldo_nuevo INTEGER NOT NULL DEFAULT 0,
  monto_venta INTEGER,
  cuenta_id UUID REFERENCES cuentas(id),
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Loyalty
CREATE INDEX idx_fidelizacion_config_tenant ON fidelizacion_config(tenant_id);
CREATE INDEX idx_fidelizacion_puntos_tenant ON fidelizacion_puntos(tenant_id);
CREATE INDEX idx_fidelizacion_puntos_cliente ON fidelizacion_puntos(tenant_id, cliente_id);
CREATE INDEX idx_fidelizacion_puntos_fecha ON fidelizacion_puntos(tenant_id, created_at);
