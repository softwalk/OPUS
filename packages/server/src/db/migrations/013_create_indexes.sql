-- OPUS Migration 013: Additional Performance Indexes
-- Composite indexes for common query patterns

-- POS: Active bills per table (most common query)
CREATE INDEX IF NOT EXISTS idx_cuentas_activas
  ON cuentas(tenant_id, mesa_id, estado)
  WHERE estado = 'abierta';

-- POS: Today's sales
CREATE INDEX IF NOT EXISTS idx_cuentas_hoy
  ON cuentas(tenant_id, abierta_en)
  WHERE estado = 'cobrada';

-- Consumos: Active items on bill
CREATE INDEX IF NOT EXISTS idx_consumos_activos
  ON consumos(tenant_id, cuenta_id, estado)
  WHERE estado = 'activo';

-- Products: Active menu items
CREATE INDEX IF NOT EXISTS idx_productos_menu
  ON productos(tenant_id, tipo, activo)
  WHERE activo = true AND tipo = 'terminado';

-- Stock: Quick stock lookup
CREATE INDEX IF NOT EXISTS idx_existencias_lookup
  ON existencias(tenant_id, producto_id, almacen_id, cantidad);

-- KDS: Pending orders
CREATE INDEX IF NOT EXISTS idx_cocina_pendientes
  ON cocina_queue(tenant_id, estado, created_at)
  WHERE estado IN ('pendiente', 'en_preparacion');

-- Notifications: Unread
CREATE INDEX IF NOT EXISTS idx_notif_unread
  ON notificaciones(tenant_id, destinatario_tipo, leida, created_at DESC)
  WHERE leida = false;

-- Reservations: Upcoming
CREATE INDEX IF NOT EXISTS idx_reservaciones_upcoming
  ON reservaciones(tenant_id, fecha, hora, estado)
  WHERE estado IN ('pendiente', 'confirmada');

-- Digital orders: Active
CREATE INDEX IF NOT EXISTS idx_ordenes_activas
  ON ordenes_digitales(tenant_id, estado, created_at)
  WHERE estado NOT IN ('entregada', 'cancelada');
