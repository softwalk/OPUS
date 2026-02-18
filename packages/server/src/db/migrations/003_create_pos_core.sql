-- OPUS Migration 003: POS Core Tables
-- Zones, tables, shifts, payment methods, staff, attendance

CREATE TABLE zonas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  zona_id UUID REFERENCES zonas(id),
  capacidad INTEGER NOT NULL DEFAULT 4,
  estado TEXT NOT NULL DEFAULT 'libre' CHECK(estado IN ('libre', 'ocupada', 'reservada', 'cerrada')),
  mesero_id UUID,
  personas INTEGER NOT NULL DEFAULT 0,
  turno TEXT,
  abierta_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, numero)
);

CREATE TABLE turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  hora_inicio TEXT,
  hora_fin TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE formas_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  clave TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE personal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  puesto TEXT NOT NULL DEFAULT 'mesero' CHECK(puesto IN ('mesero', 'cajero', 'cocinero', 'subgerente', 'gerente', 'barman', 'repartidor', 'hostess')),
  nivel_acceso INTEGER NOT NULL DEFAULT 1,
  telefono TEXT,
  direccion TEXT,
  email TEXT,
  password_hash TEXT,
  sueldo_diario INTEGER NOT NULL DEFAULT 0,
  propina_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_ingreso DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, codigo)
);

CREATE TABLE asistencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  personal_id UUID NOT NULL REFERENCES personal(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_entrada TIMESTAMPTZ,
  hora_salida TIMESTAMPTZ,
  tipo TEXT NOT NULL DEFAULT 'normal' CHECK(tipo IN ('normal', 'retardo', 'falta', 'permiso', 'vacaciones', 'incapacidad')),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for POS Core
CREATE INDEX idx_zonas_tenant ON zonas(tenant_id);
CREATE INDEX idx_mesas_tenant ON mesas(tenant_id);
CREATE INDEX idx_mesas_estado ON mesas(tenant_id, estado);
CREATE INDEX idx_turnos_tenant ON turnos(tenant_id);
CREATE INDEX idx_formas_pago_tenant ON formas_pago(tenant_id);
CREATE INDEX idx_personal_tenant ON personal(tenant_id);
CREATE INDEX idx_personal_codigo ON personal(tenant_id, codigo);
CREATE INDEX idx_asistencia_tenant ON asistencia(tenant_id);
CREATE INDEX idx_asistencia_fecha ON asistencia(tenant_id, fecha);
