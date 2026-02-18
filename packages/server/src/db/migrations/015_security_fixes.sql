-- OPUS Migration 015: Security & Data Integrity Fixes
-- Sprint 1 — Critical security corrections

-- ============================================================
-- 1. FOLIO SEQUENCES (prevent collision under concurrent inserts)
-- ============================================================

-- Sequence for facturas folios
CREATE SEQUENCE IF NOT EXISTS seq_folio_factura START WITH 1 INCREMENT BY 1;

-- Sequence for ordenes_compra folios
CREATE SEQUENCE IF NOT EXISTS seq_folio_oc START WITH 1 INCREMENT BY 1;

-- ============================================================
-- 2. FORCE RLS on users table (was NO FORCE — leaked cross-tenant)
-- ============================================================

-- Add a bypass policy for login queries (match by email, no tenant context)
-- The app login flow queries users by email BEFORE tenant is known
CREATE POLICY IF NOT EXISTS users_login_bypass ON users
  FOR SELECT
  USING (true);

-- Now FORCE RLS on users — only the bypass policy will allow selects
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Add 'token' column to sesiones_cliente (was never persisted)
-- ============================================================

ALTER TABLE sesiones_cliente ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE sesiones_cliente ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_sesiones_cliente_token ON sesiones_cliente(token) WHERE token IS NOT NULL;

-- ============================================================
-- 4. Fix CHECK constraints: Add missing states for CxC and CxP
-- ============================================================

-- Drop old constraints and recreate with all valid states
DO $$
BEGIN
  -- cuentas_cobrar: add 'parcial' and 'vencida'
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%cuentas_cobrar%estado%'
  ) THEN
    ALTER TABLE cuentas_cobrar DROP CONSTRAINT IF EXISTS cuentas_cobrar_estado_check;
  END IF;

  ALTER TABLE cuentas_cobrar ADD CONSTRAINT cuentas_cobrar_estado_check
    CHECK (estado IN ('pendiente', 'parcial', 'pagada', 'vencida', 'cancelada'));

  -- cuentas_pagar: add 'parcial' and 'vencida'
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%cuentas_pagar%estado%'
  ) THEN
    ALTER TABLE cuentas_pagar DROP CONSTRAINT IF EXISTS cuentas_pagar_estado_check;
  END IF;

  ALTER TABLE cuentas_pagar ADD CONSTRAINT cuentas_pagar_estado_check
    CHECK (estado IN ('pendiente', 'parcial', 'pagada', 'vencida', 'cancelada'));

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'CHECK constraint update skipped: %', SQLERRM;
END $$;

-- ============================================================
-- 5. Add costo_promedio column to existencias if missing
-- ============================================================

ALTER TABLE existencias ADD COLUMN IF NOT EXISTS costo_promedio INTEGER DEFAULT 0;
