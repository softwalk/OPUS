-- OPUS Migration 012: Row Level Security Policies
-- Enable RLS on ALL tenant-scoped tables

-- Helper: Set current tenant config parameter
DO $$ BEGIN
  PERFORM set_config('app.current_tenant', '00000000-0000-0000-0000-000000000000', false);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================================
-- ENABLE RLS ON ALL TENANT TABLES
-- ============================================================

-- POS Core
ALTER TABLE zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE formas_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortes_caja ENABLE ROW LEVEL SECURITY;

-- Catalog
ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE modificadores_producto ENABLE ROW LEVEL SECURITY;

-- Inventory
ALTER TABLE almacenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE existencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_perdidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE sobregiros_autorizados ENABLE ROW LEVEL SECURITY;

-- Kitchen
ALTER TABLE cocina_queue ENABLE ROW LEVEL SECURITY;

-- Digital Orders
ALTER TABLE ordenes_digitales ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_digitales_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE zonas_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE direcciones_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE calificaciones ENABLE ROW LEVEL SECURITY;

-- Loyalty
ALTER TABLE fidelizacion_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE fidelizacion_puntos ENABLE ROW LEVEL SECURITY;

-- Finance
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_cobrar ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE polizas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_compra_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_lineas ENABLE ROW LEVEL SECURITY;

-- System
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Users (special: belongs to tenant but is queried during login)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CREATE POLICIES FOR ALL TABLES
-- Pattern: tenant_id = current_setting('app.current_tenant')::uuid
-- ============================================================

-- Function to generate tenant isolation policies
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'zonas', 'mesas', 'turnos', 'formas_pago', 'personal', 'asistencia',
    'cuentas', 'consumos', 'cortes_caja',
    'grupos', 'productos', 'recetas', 'modificadores_producto',
    'almacenes', 'existencias', 'movimientos_inventario',
    'ventas_perdidas', 'alertas_stock', 'sobregiros_autorizados',
    'cocina_queue',
    'ordenes_digitales', 'ordenes_digitales_items', 'zonas_entrega',
    'direcciones_entrega', 'qr_mesas', 'reservaciones', 'sesiones_cliente', 'calificaciones',
    'fidelizacion_config', 'fidelizacion_puntos',
    'clientes', 'proveedores', 'facturas', 'cuentas_cobrar', 'cuentas_pagar',
    'polizas', 'ordenes_compra', 'orden_compra_lineas', 'pedidos', 'pedido_lineas',
    'auditoria', 'notificaciones',
    'users'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Drop existing policies if any
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON %I', tbl);

    -- SELECT policy
    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON %I FOR SELECT USING (tenant_id = current_setting(''app.current_tenant'')::uuid)',
      tbl
    );

    -- INSERT policy
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON %I FOR INSERT WITH CHECK (tenant_id = current_setting(''app.current_tenant'')::uuid)',
      tbl
    );

    -- UPDATE policy
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON %I FOR UPDATE USING (tenant_id = current_setting(''app.current_tenant'')::uuid)',
      tbl
    );

    -- DELETE policy
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON %I FOR DELETE USING (tenant_id = current_setting(''app.current_tenant'')::uuid)',
      tbl
    );

    -- FORCE RLS even for table owner (critical: app connects as table owner)
    -- Exception: 'users' table needs NO FORCE for login queries without tenant context
    IF tbl != 'users' THEN
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;
