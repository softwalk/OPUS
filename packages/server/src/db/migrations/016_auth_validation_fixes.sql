-- OPUS Migration 016: Auth & Validation Improvements (Sprint 2)
-- Supports JWT refresh token rotation and strengthens data integrity

-- ============================================================
-- 1. Add estado constraint to ordenes_digitales
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'ordenes_digitales_estado_check'
  ) THEN
    ALTER TABLE ordenes_digitales ADD CONSTRAINT ordenes_digitales_estado_check
      CHECK (estado IN ('pendiente', 'confirmada', 'en_preparacion', 'lista', 'en_camino', 'entregada', 'cancelada'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ordenes_digitales estado constraint skipped: %', SQLERRM;
END $$;

-- ============================================================
-- 2. Add estado constraint to reservaciones
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'reservaciones_estado_check'
  ) THEN
    ALTER TABLE reservaciones ADD CONSTRAINT reservaciones_estado_check
      CHECK (estado IN ('pendiente', 'confirmada', 'sentada', 'completada', 'cancelada', 'no_show'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'reservaciones estado constraint skipped: %', SQLERRM;
END $$;

-- ============================================================
-- 3. Add estado constraint to ordenes_compra
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'ordenes_compra_estado_check'
  ) THEN
    ALTER TABLE ordenes_compra ADD CONSTRAINT ordenes_compra_estado_check
      CHECK (estado IN ('pendiente', 'recibida', 'cancelada'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ordenes_compra estado constraint skipped: %', SQLERRM;
END $$;

-- ============================================================
-- 4. Validate calificaciones.puntuacion range
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'calificaciones_puntuacion_check'
  ) THEN
    ALTER TABLE calificaciones ADD CONSTRAINT calificaciones_puntuacion_check
      CHECK (puntuacion >= 1 AND puntuacion <= 5);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'calificaciones puntuacion constraint skipped: %', SQLERRM;
END $$;

-- ============================================================
-- 5. Add NOT NULL constraints for critical financial fields
-- ============================================================

-- Ensure polizas.tipo is always set
DO $$
BEGIN
  ALTER TABLE polizas ALTER COLUMN tipo SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'polizas.tipo NOT NULL skipped: %', SQLERRM;
END $$;

-- Ensure polizas.importe is always set
DO $$
BEGIN
  ALTER TABLE polizas ALTER COLUMN importe SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'polizas.importe NOT NULL skipped: %', SQLERRM;
END $$;

-- ============================================================
-- 6. Add polizas tipo constraint
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'polizas_tipo_check'
  ) THEN
    ALTER TABLE polizas ADD CONSTRAINT polizas_tipo_check
      CHECK (tipo IN ('ingreso', 'egreso'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'polizas tipo constraint skipped: %', SQLERRM;
END $$;

-- ============================================================
-- 7. Index for faster refresh token validation (user+tenant lookup)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_id_activo ON users(id) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_tenants_id_activo ON tenants(id) WHERE activo = true;
