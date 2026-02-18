-- OPUS Migration 014: Reporting Views
-- Pre-built views for common reporting queries

-- View: Daily sales summary
CREATE OR REPLACE VIEW v_ventas_dia AS
SELECT
  c.tenant_id,
  DATE(c.cerrada_en) as fecha,
  COUNT(*) as num_cuentas,
  SUM(c.subtotal) as total_subtotal,
  SUM(c.iva) as total_iva,
  SUM(c.total) as total_ventas,
  SUM(c.propina) as total_propinas,
  SUM(c.descuento) as total_descuentos,
  CASE WHEN COUNT(*) > 0 THEN SUM(c.total) / COUNT(*) ELSE 0 END as ticket_promedio,
  AVG(c.personas) as personas_promedio
FROM cuentas c
WHERE c.estado = 'cobrada'
GROUP BY c.tenant_id, DATE(c.cerrada_en);

-- View: Sales by waiter
CREATE OR REPLACE VIEW v_ventas_mesero AS
SELECT
  c.tenant_id,
  c.mesero_id,
  p.nombre as mesero_nombre,
  DATE(c.cerrada_en) as fecha,
  COUNT(*) as num_cuentas,
  SUM(c.total) as total_ventas,
  SUM(c.propina) as total_propinas,
  AVG(c.personas) as personas_promedio
FROM cuentas c
JOIN personal p ON p.id = c.mesero_id AND p.tenant_id = c.tenant_id
WHERE c.estado = 'cobrada'
GROUP BY c.tenant_id, c.mesero_id, p.nombre, DATE(c.cerrada_en);

-- View: Sales by product
CREATE OR REPLACE VIEW v_ventas_producto AS
SELECT
  co.tenant_id,
  co.producto_id,
  pr.descripcion as producto_nombre,
  pr.grupo_id,
  g.nombre as grupo_nombre,
  DATE(cu.cerrada_en) as fecha,
  SUM(co.cantidad) as cantidad_vendida,
  SUM(co.importe) as total_ventas,
  pr.costo_integrado,
  CASE WHEN SUM(co.importe) > 0
    THEN ROUND((pr.costo_integrado * SUM(co.cantidad)::numeric / SUM(co.importe) * 100)::numeric, 2)
    ELSE 0
  END as food_cost_pct
FROM consumos co
JOIN cuentas cu ON cu.id = co.cuenta_id AND cu.tenant_id = co.tenant_id
JOIN productos pr ON pr.id = co.producto_id AND pr.tenant_id = co.tenant_id
LEFT JOIN grupos g ON g.id = pr.grupo_id AND g.tenant_id = co.tenant_id
WHERE cu.estado = 'cobrada' AND co.estado = 'activo'
GROUP BY co.tenant_id, co.producto_id, pr.descripcion, pr.grupo_id, g.nombre,
         DATE(cu.cerrada_en), pr.costo_integrado;

-- View: Stock availability (portions per product based on recipe)
CREATE OR REPLACE VIEW v_stock_disponibilidad AS
SELECT
  r.tenant_id,
  r.producto_id,
  p.descripcion as producto_nombre,
  p.suspendido_86,
  p.bloquear_sin_stock,
  MIN(
    CASE WHEN r.cantidad > 0
      THEN FLOOR(COALESCE(e.cantidad, 0) / r.cantidad)
      ELSE 999999
    END
  ) as porciones_disponibles,
  (
    SELECT json_agg(json_build_object(
      'insumo_id', r2.insumo_id,
      'insumo_nombre', p2.descripcion,
      'necesario', r2.cantidad,
      'stock_actual', COALESCE(e2.cantidad, 0),
      'porciones', CASE WHEN r2.cantidad > 0 THEN FLOOR(COALESCE(e2.cantidad, 0) / r2.cantidad) ELSE 999999 END,
      'unidad', p2.unidad
    ))
    FROM recetas r2
    JOIN productos p2 ON p2.id = r2.insumo_id AND p2.tenant_id = r2.tenant_id
    LEFT JOIN existencias e2 ON e2.producto_id = r2.insumo_id AND e2.tenant_id = r2.tenant_id AND e2.almacen_id = (
      SELECT a.id FROM almacenes a WHERE a.tenant_id = r2.tenant_id AND a.numero = 1 LIMIT 1
    )
    WHERE r2.producto_id = r.producto_id AND r2.tenant_id = r.tenant_id
  ) as ingredientes
FROM recetas r
JOIN productos p ON p.id = r.producto_id AND p.tenant_id = r.tenant_id
LEFT JOIN existencias e ON e.producto_id = r.insumo_id AND e.tenant_id = r.tenant_id AND e.almacen_id = (
  SELECT a.id FROM almacenes a WHERE a.tenant_id = r.tenant_id AND a.numero = 1 LIMIT 1
)
WHERE p.activo = true
GROUP BY r.tenant_id, r.producto_id, p.descripcion, p.suspendido_86, p.bloquear_sin_stock;
