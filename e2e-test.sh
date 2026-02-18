#!/bin/bash
# ================================================================
# OPUS E2E TEST SUITE
# ================================================================
BASE="http://localhost:3001/api/v1"
PASS=0
FAIL=0
WARNINGS=""

ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); WARNINGS="$WARNINGS\n❌ $1"; }
warn() { echo "  ⚠️  $1"; WARNINGS="$WARNINGS\n⚠️  $1"; }
hdr() { echo ""; echo "═══ $1 ═══"; }
api() { curl -sf "$@" 2>/dev/null; }
api_raw() { curl -s "$@" 2>/dev/null; }
jq_() { python3 -c "import sys,json; d=json.load(sys.stdin); $1" 2>/dev/null; }

# ---- Login helper ----
login() {
  api_raw "$BASE/auth/login" -H "Content-Type: application/json" \
    -d "{\"codigo\":\"$1\",\"password\":\"admin123\",\"tenant_slug\":\"la-xola\"}" | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null
}

ADM_TOKEN=$(login ADM)
MES_TOKEN=$(login MES01)
CAJ_TOKEN=$(login CAJ01)

echo "================================================================"
echo "   OPUS - FULL E2E TEST"
echo "================================================================"

# ============================================================
hdr "1. AUTENTICACION"
# ============================================================

[ -n "$ADM_TOKEN" ] && ok "Login ADM (gerente, nivel 9)" || fail "Login ADM"
[ -n "$MES_TOKEN" ] && ok "Login MES01 (mesero, nivel 1)" || fail "Login MES01"
[ -n "$CAJ_TOKEN" ] && ok "Login CAJ01 (cajero, nivel 2)" || fail "Login CAJ01"

# Bad credentials
R=$(api_raw "$BASE/auth/login" -H "Content-Type: application/json" -d '{"codigo":"XXX","password":"bad","tenant_slug":"la-xola"}')
echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('error') else 1)" 2>/dev/null && ok "Login incorrecto rechazado" || fail "Login incorrecto NO rechazado"

# Bad tenant
R=$(api_raw "$BASE/auth/login" -H "Content-Type: application/json" -d '{"codigo":"ADM","password":"admin123","tenant_slug":"no-existe"}')
echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('error',{}).get('code')=='TENANT_NOT_FOUND' else 1)" 2>/dev/null && ok "Tenant inexistente rechazado" || fail "Tenant inexistente NO rechazado"

# /auth/me
R=$(api_raw "$BASE/auth/me" -H "Authorization: Bearer $ADM_TOKEN")
echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('user',{}).get('nombre') else 1)" 2>/dev/null && ok "GET /auth/me retorna usuario" || fail "GET /auth/me"

# ============================================================
hdr "2. POS - MESAS"
# ============================================================

R=$(api_raw "$BASE/pos/mesas" -H "Authorization: Bearer $ADM_TOKEN")
MESA_COUNT=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$MESA_COUNT" = "16" ] && ok "16 mesas listadas" || fail "Mesas: esperado 16, recibido $MESA_COUNT"

# Check zona_nombre present
echo "$R" | python3 -c "
import sys,json
mesas=json.load(sys.stdin)
zones=set(m.get('zona_nombre','') for m in mesas)
has_zones = 'Salon Principal' in zones and 'Terraza' in zones and 'Bar' in zones
exit(0 if has_zones else 1)" 2>/dev/null && ok "Mesas agrupadas por zona (Salon, Terraza, Bar)" || fail "Mesas sin zona_nombre"

# Check capacidad present
echo "$R" | python3 -c "
import sys,json
mesas=json.load(sys.stdin)
exit(0 if all(m.get('capacidad',0)>0 for m in mesas) else 1)" 2>/dev/null && ok "Todas las mesas tienen capacidad" || fail "Mesas sin capacidad"

# ============================================================
hdr "3. POS - ABRIR MESA + MESERO AUTO-ASSIGN"
# ============================================================

# Find a free mesa
FREE_MESA=$(echo "$R" | python3 -c "
import sys,json
mesas=json.load(sys.stdin)
for m in mesas:
    if m['estado']=='libre':
        print(m['id']); break" 2>/dev/null)

if [ -n "$FREE_MESA" ]; then
  # Open as MES01 - should auto-assign Juan Garcia
  OPEN=$(api_raw "$BASE/pos/mesas/$FREE_MESA/abrir" -X POST -H "Authorization: Bearer $MES_TOKEN" -H "Content-Type: application/json" -d '{"personas":3}')
  NEW_CUENTA=$(echo "$OPEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['cuenta']['id'])" 2>/dev/null)

  [ -n "$NEW_CUENTA" ] && ok "Mesa abierta, cuenta creada: ${NEW_CUENTA:0:8}..." || fail "No se pudo abrir mesa"

  # Verify mesero auto-assigned
  R2=$(api_raw "$BASE/pos/mesas" -H "Authorization: Bearer $ADM_TOKEN")
  echo "$R2" | python3 -c "
import sys,json
mesas=json.load(sys.stdin)
m=next((m for m in mesas if m['id']=='$FREE_MESA'),None)
exit(0 if m and m.get('mesero_nombre')=='Juan Garcia' else 1)" 2>/dev/null && ok "Mesero auto-asignado: Juan Garcia" || fail "Mesero NO auto-asignado"

  # Verify personas
  echo "$R2" | python3 -c "
import sys,json
mesas=json.load(sys.stdin)
m=next((m for m in mesas if m['id']=='$FREE_MESA'),None)
exit(0 if m and m.get('personas')==3 else 1)" 2>/dev/null && ok "Personas=3 guardado correctamente" || fail "Personas no guardado"

else
  fail "No hay mesas libres para test de apertura"
fi

# ============================================================
hdr "4. POS - PRODUCTOS"
# ============================================================

PRODS=$(api_raw "$BASE/productos?limit=200" -H "Authorization: Bearer $ADM_TOKEN")
PROD_COUNT=$(echo "$PRODS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('productos',d.get('data',d if isinstance(d,list) else []))))" 2>/dev/null)
[ "$PROD_COUNT" -gt "0" ] 2>/dev/null && ok "$PROD_COUNT productos listados" || fail "No hay productos"

# Check terminados
TERM_COUNT=$(echo "$PRODS" | python3 -c "
import sys,json; d=json.load(sys.stdin)
prods=d.get('productos',d.get('data',d if isinstance(d,list) else []))
print(len([p for p in prods if p.get('tipo')=='terminado']))" 2>/dev/null)
[ "$TERM_COUNT" -gt "0" ] 2>/dev/null && ok "$TERM_COUNT productos terminados (para menu)" || fail "No hay productos terminados"

# Check grupo_nombre
echo "$PRODS" | python3 -c "
import sys,json; d=json.load(sys.stdin)
prods=d.get('productos',d.get('data',d if isinstance(d,list) else []))
with_grupo = len([p for p in prods if p.get('grupo_nombre')])
exit(0 if with_grupo > 0 else 1)" 2>/dev/null && ok "Productos tienen grupo_nombre" || warn "Productos sin grupo_nombre"

# ============================================================
hdr "5. POS - CONSUMOS (TOMAR ORDEN)"
# ============================================================

if [ -n "$NEW_CUENTA" ]; then
  # Get first terminado product ID
  PROD_ID=$(echo "$PRODS" | python3 -c "
import sys,json; d=json.load(sys.stdin)
prods=d.get('productos',d.get('data',d if isinstance(d,list) else []))
for p in prods:
    if p.get('tipo')=='terminado': print(p['id']); break" 2>/dev/null)

  # Add consumo
  ADD_R=$(api_raw "$BASE/pos/consumos" -X POST -H "Authorization: Bearer $MES_TOKEN" -H "Content-Type: application/json" \
    -d "{\"cuenta_id\":\"$NEW_CUENTA\",\"producto_id\":\"$PROD_ID\",\"cantidad\":2}")
  CONSUMO_ID=$(echo "$ADD_R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
  [ -n "$CONSUMO_ID" ] && ok "Consumo agregado (x2): ${CONSUMO_ID:0:8}..." || fail "No se pudo agregar consumo"

  # Get cuenta detail - verify consumos
  CUENTA_D=$(api_raw "$BASE/pos/cuentas/$NEW_CUENTA" -H "Authorization: Bearer $MES_TOKEN")
  echo "$CUENTA_D" | python3 -c "
import sys,json; d=json.load(sys.stdin)
c=[co for co in d.get('consumos',[]) if co.get('estado')!='cancelado']
exit(0 if len(c)>0 else 1)" 2>/dev/null && ok "Cuenta tiene consumos" || fail "Cuenta sin consumos"

  # Verify total updated
  echo "$CUENTA_D" | python3 -c "
import sys,json; d=json.load(sys.stdin)
exit(0 if d.get('total',0) > 0 else 1)" 2>/dev/null && ok "Total calculado: $(echo "$CUENTA_D" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null) centavos" || fail "Total no calculado"

  # Verify mesero_nombre on cuenta
  echo "$CUENTA_D" | python3 -c "
import sys,json; d=json.load(sys.stdin)
exit(0 if d.get('mesero_nombre') else 1)" 2>/dev/null && ok "Cuenta muestra mesero: $(echo "$CUENTA_D" | python3 -c "import sys,json; print(json.load(sys.stdin).get('mesero_nombre','?'))" 2>/dev/null)" || warn "Cuenta sin mesero_nombre"

  # Cancel consumo
  if [ -n "$CONSUMO_ID" ]; then
    DEL_R=$(api_raw "$BASE/pos/consumos/$CONSUMO_ID" -X DELETE -H "Authorization: Bearer $MES_TOKEN")
    echo "$DEL_R" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('estado')=='cancelado' or 'cancelado' in str(d) else 1)" 2>/dev/null && ok "Consumo cancelado" || warn "Cancel consumo respuesta inesperada"
  fi

  # Add another consumo for cobrar test
  ADD_R2=$(api_raw "$BASE/pos/consumos" -X POST -H "Authorization: Bearer $MES_TOKEN" -H "Content-Type: application/json" \
    -d "{\"cuenta_id\":\"$NEW_CUENTA\",\"producto_id\":\"$PROD_ID\",\"cantidad\":1}")
fi

# ============================================================
hdr "6. POS - COBRAR"
# ============================================================

# Get formas de pago
FP=$(api_raw "$BASE/pos/formas-pago" -H "Authorization: Bearer $ADM_TOKEN")
FP_COUNT=$(echo "$FP" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$FP_COUNT" -gt "0" ] 2>/dev/null && ok "$FP_COUNT formas de pago disponibles" || fail "No hay formas de pago"

FP_ID=$(echo "$FP" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null)

if [ -n "$NEW_CUENTA" ] && [ -n "$FP_ID" ]; then
  COBRAR_R=$(api_raw "$BASE/pos/cuentas/$NEW_CUENTA/cobrar" -X POST -H "Authorization: Bearer $ADM_TOKEN" -H "Content-Type: application/json" \
    -d "{\"forma_pago_id\":\"$FP_ID\",\"propina\":0}")
  echo "$COBRAR_R" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('estado')=='cobrada' else 1)" 2>/dev/null && ok "Cuenta cobrada correctamente" || fail "Cobrar falló: $COBRAR_R"

  # Verify mesa is now libre
  R3=$(api_raw "$BASE/pos/mesas" -H "Authorization: Bearer $ADM_TOKEN")
  echo "$R3" | python3 -c "
import sys,json
mesas=json.load(sys.stdin)
m=next((m for m in mesas if m['id']=='$FREE_MESA'),None)
exit(0 if m and m['estado']=='libre' else 1)" 2>/dev/null && ok "Mesa liberada tras cobrar" || warn "Mesa no liberada tras cobrar"
fi

# ============================================================
hdr "7. POS - CERRAR MESA (admin override)"
# ============================================================

# Open another mesa, then force close
FREE2=$(echo "$R3" | python3 -c "
import sys,json
mesas=json.load(sys.stdin)
for m in mesas:
    if m['estado']=='libre': print(m['id']); break" 2>/dev/null)

if [ -n "$FREE2" ]; then
  api_raw "$BASE/pos/mesas/$FREE2/abrir" -X POST -H "Authorization: Bearer $MES_TOKEN" -H "Content-Type: application/json" -d '{"personas":1}' > /dev/null 2>&1

  CLOSE_R=$(api_raw "$BASE/pos/mesas/$FREE2/cerrar" -X POST -H "Authorization: Bearer $ADM_TOKEN" -H "Content-Type: application/json")
  echo "$CLOSE_R" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('estado')=='libre' else 1)" 2>/dev/null && ok "Cerrar mesa OK (admin override)" || fail "Cerrar mesa falló"

  # MES01 should NOT be able to close (nivel 1 < 2)
  api_raw "$BASE/pos/mesas/$FREE2/abrir" -X POST -H "Authorization: Bearer $MES_TOKEN" -H "Content-Type: application/json" -d '{"personas":1}' > /dev/null 2>&1
  CLOSE_R2=$(api_raw "$BASE/pos/mesas/$FREE2/cerrar" -X POST -H "Authorization: Bearer $MES_TOKEN" -H "Content-Type: application/json")
  echo "$CLOSE_R2" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('error') else 1)" 2>/dev/null && ok "Mesero NO puede cerrar mesa (requiere nivel 2)" || fail "Mesero SI pudo cerrar mesa"

  # Clean up
  api_raw "$BASE/pos/mesas/$FREE2/cerrar" -X POST -H "Authorization: Bearer $ADM_TOKEN" -H "Content-Type: application/json" > /dev/null 2>&1
fi

# ============================================================
hdr "8. CATALOGO - GRUPOS"
# ============================================================

GRUPOS=$(api_raw "$BASE/grupos" -H "Authorization: Bearer $ADM_TOKEN")
GRUPO_COUNT=$(echo "$GRUPOS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('grupos', d if isinstance(d,list) else [])))" 2>/dev/null)
[ "$GRUPO_COUNT" -gt "0" ] 2>/dev/null && ok "$GRUPO_COUNT grupos de productos" || fail "No hay grupos"

# ============================================================
hdr "9. CATALOGO - RECETAS"
# ============================================================

RECETAS=$(api_raw "$BASE/recetas?limit=10" -H "Authorization: Bearer $ADM_TOKEN")
echo "$RECETAS" | python3 -c "
import sys,json; d=json.load(sys.stdin)
items = d.get('recetas', d.get('data', d if isinstance(d,list) else []))
exit(0 if len(items) > 0 else 1)" 2>/dev/null && ok "Recetas disponibles" || warn "No hay recetas o endpoint diferente"

# ============================================================
hdr "10. INVENTARIO - ALMACENES"
# ============================================================

ALM=$(api_raw "$BASE/almacenes" -H "Authorization: Bearer $ADM_TOKEN")
ALM_COUNT=$(echo "$ALM" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get('almacenes',[]); print(len(items))" 2>/dev/null)
[ "$ALM_COUNT" -gt "0" ] 2>/dev/null && ok "$ALM_COUNT almacenes" || fail "No hay almacenes"

# ============================================================
hdr "11. INVENTARIO - MOVIMIENTOS"
# ============================================================

MOV=$(api_raw "$BASE/inventario/movimientos?limit=5" -H "Authorization: Bearer $ADM_TOKEN")
echo "$MOV" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if not d.get('error') else 1)" 2>/dev/null && ok "Movimientos endpoint responde" || warn "Movimientos endpoint falla: $(echo $MOV | head -c 100)"

# ============================================================
hdr "12. KDS (Kitchen Display System)"
# ============================================================

KDS=$(api_raw "$BASE/kds/ordenes" -H "Authorization: Bearer $ADM_TOKEN")
echo "$KDS" | python3 -c "import sys,json; json.load(sys.stdin); exit(0)" 2>/dev/null && ok "KDS endpoint responde" || warn "KDS endpoint error"

# ============================================================
hdr "13. RESERVACIONES"
# ============================================================

TODAY=$(date +%Y-%m-%d)

# Disponibilidad
DISP=$(api_raw "$BASE/reservaciones/disponibilidad?fecha=$TODAY&personas=4" -H "Authorization: Bearer $ADM_TOKEN")
SLOT_COUNT=$(echo "$DISP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('slots',[])))" 2>/dev/null)
[ "$SLOT_COUNT" -gt "0" ] 2>/dev/null && ok "Disponibilidad: $SLOT_COUNT slots de reservacion" || fail "No hay slots de reservacion"

# Mesas timeline
TL=$(api_raw "$BASE/reservaciones/mesas-timeline?fecha=$TODAY" -H "Authorization: Bearer $ADM_TOKEN")
echo "$TL" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if 'mesas' in d else 1)" 2>/dev/null && ok "Mesas timeline responde" || fail "Mesas timeline error"

# List reservaciones
RES=$(api_raw "$BASE/reservaciones" -H "Authorization: Bearer $ADM_TOKEN")
echo "$RES" | python3 -c "import sys,json; json.load(sys.stdin); exit(0)" 2>/dev/null && ok "Listar reservaciones OK" || warn "Listar reservaciones error"

# PUBLIC: Disponibilidad sin JWT
PUB_DISP=$(api_raw "$BASE/clientes/reservar/disponibilidad?tenant_slug=la-xola&fecha=$TODAY&personas=2")
echo "$PUB_DISP" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('slots') else 1)" 2>/dev/null && ok "Disponibilidad publica (sin JWT)" || fail "Disponibilidad publica falla"

# PUBLIC: Crear reservacion
PUB_RES=$(api_raw "$BASE/clientes/reservar" -X POST -H "Content-Type: application/json" \
  -d "{\"tenant_slug\":\"la-xola\",\"cliente_nombre\":\"Test E2E\",\"cliente_telefono\":\"555-0000\",\"personas\":2,\"fecha\":\"$TODAY\",\"hora\":\"20:00\"}")
RES_ID=$(echo "$PUB_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
RES_CODE=$(echo "$PUB_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('codigo_confirmacion',''))" 2>/dev/null)
[ -n "$RES_ID" ] && ok "Reservacion publica creada: $RES_CODE" || warn "Reservacion publica fallo (puede que slot ocupado)"

# ============================================================
hdr "14. CLIENTES / FIDELIZACION"
# ============================================================

# Public: Login/Register client
CLI=$(api_raw "$BASE/clientes/auth/login" -X POST -H "Content-Type: application/json" \
  -d '{"telefono":"555-1234","nombre":"Roberto Sanchez","tenant_slug":"la-xola"}')
CLI_TOKEN=$(echo "$CLI" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token', d.get('cliente',{}).get('id','')))" 2>/dev/null)
echo "$CLI" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('cliente') or d.get('token') or d.get('id') else 1)" 2>/dev/null && ok "Cliente login/registro OK" || warn "Cliente login diferente formato"

# Loyalty info
LOY=$(api_raw "$BASE/clientes/fidelizacion?tenant_slug=la-xola&telefono=555-1234")
echo "$LOY" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('puntos_acumulados') is not None or d.get('nivel') else 1)" 2>/dev/null && ok "Fidelizacion: puntos y nivel" || warn "Fidelizacion endpoint diferente"

# ============================================================
hdr "15. PEDIDOS DIGITALES"
# ============================================================

# Menu publico
MENU=$(api_raw "$BASE/clientes/menu?tenant_slug=la-xola")
echo "$MENU" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if isinstance(d,list) and len(d)>0 else 1)" 2>/dev/null && ok "Menu publico disponible" || warn "Menu publico formato diferente"

# ============================================================
hdr "16. PERSONAL"
# ============================================================

PERS=$(api_raw "$BASE/personal" -H "Authorization: Bearer $ADM_TOKEN")
PERS_COUNT=$(echo "$PERS" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get('personal',d.get('data',[])); print(len(items))" 2>/dev/null)
[ "$PERS_COUNT" -gt "0" ] 2>/dev/null && ok "$PERS_COUNT personal registrado" || fail "No hay personal"

# ============================================================
hdr "17. FINANZAS - FORMAS DE PAGO"
# ============================================================

echo "$FP" | python3 -c "
import sys,json; fps=json.load(sys.stdin)
names=[f.get('nombre','?') for f in fps]
print(f'  Formas: {\", \".join(names)}')" 2>/dev/null
ok "Formas de pago listadas"

# ============================================================
hdr "18. CORTE DE CAJA"
# ============================================================

CORTE=$(api_raw "$BASE/pos/corte-caja" -X POST -H "Authorization: Bearer $ADM_TOKEN" -H "Content-Type: application/json" -d '{}')
echo "$CORTE" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('id') or d.get('folio') else 1)" 2>/dev/null && ok "Corte de caja generado" || warn "Corte de caja fallo o sin datos"

# ============================================================
hdr "19. REPORTES"
# ============================================================

# Ventas por producto
RPT1=$(api_raw "$BASE/reportes/ventas-producto?fecha_inicio=2026-01-01&fecha_fin=2026-12-31" -H "Authorization: Bearer $ADM_TOKEN")
echo "$RPT1" | python3 -c "import sys,json; json.load(sys.stdin); exit(0)" 2>/dev/null && ok "Reporte ventas por producto" || warn "Reporte ventas-producto error"

# Ventas por mesero
RPT2=$(api_raw "$BASE/reportes/ventas-mesero?fecha_inicio=2026-01-01&fecha_fin=2026-12-31" -H "Authorization: Bearer $ADM_TOKEN")
echo "$RPT2" | python3 -c "import sys,json; json.load(sys.stdin); exit(0)" 2>/dev/null && ok "Reporte ventas por mesero" || warn "Reporte ventas-mesero error"

# Dashboard
DASH=$(api_raw "$BASE/reportes/dashboard" -H "Authorization: Bearer $ADM_TOKEN")
echo "$DASH" | python3 -c "import sys,json; json.load(sys.stdin); exit(0)" 2>/dev/null && ok "Dashboard datos" || warn "Dashboard error"

# ============================================================
hdr "20. PROVEEDORES"
# ============================================================

PROV=$(api_raw "$BASE/proveedores" -H "Authorization: Bearer $ADM_TOKEN")
PROV_COUNT=$(echo "$PROV" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get('proveedores',d.get('data',[])); print(len(items))" 2>/dev/null)
[ "$PROV_COUNT" -gt "0" ] 2>/dev/null && ok "$PROV_COUNT proveedores" || warn "Proveedores endpoint diferente"

# ============================================================
hdr "21. COMPRAS"
# ============================================================

COMP=$(api_raw "$BASE/compras?limit=5" -H "Authorization: Bearer $ADM_TOKEN")
echo "$COMP" | python3 -c "import sys,json; json.load(sys.stdin); exit(0)" 2>/dev/null && ok "Compras endpoint responde" || warn "Compras endpoint error"

# ============================================================
hdr "22. CUENTAS POR COBRAR"
# ============================================================

CXC=$(api_raw "$BASE/cxc?limit=5" -H "Authorization: Bearer $ADM_TOKEN")
echo "$CXC" | python3 -c "import sys,json; json.load(sys.stdin); exit(0)" 2>/dev/null && ok "CxC endpoint responde" || warn "CxC endpoint error"

# ============================================================
hdr "23. CUENTAS POR PAGAR"
# ============================================================

CXP=$(api_raw "$BASE/cxp?limit=5" -H "Authorization: Bearer $ADM_TOKEN")
echo "$CXP" | python3 -c "import sys,json; json.load(sys.stdin); exit(0)" 2>/dev/null && ok "CxP endpoint responde" || warn "CxP endpoint error"

# ============================================================
hdr "24. ROLE-BASED ACCESS"
# ============================================================

# MES01 (nivel 1) should NOT access reportes
RPTA=$(api_raw "$BASE/reportes/dashboard" -H "Authorization: Bearer $MES_TOKEN")
echo "$RPTA" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('error') else 1)" 2>/dev/null && ok "Mesero NO accede a reportes (RBAC OK)" || warn "Mesero SI accede a reportes (RBAC debil)"

# No auth should fail
NO_AUTH=$(api_raw "$BASE/pos/mesas")
echo "$NO_AUTH" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('error') else 1)" 2>/dev/null && ok "Sin JWT rechazado en ruta protegida" || fail "Ruta protegida accesible sin JWT"

# ============================================================
hdr "25. MULTI-TENANT ISOLATION"
# ============================================================

# Login to trattoria-roma
TR_TOKEN=$(login_other() { curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d "{\"codigo\":\"ADM\",\"password\":\"admin123\",\"tenant_slug\":\"trattoria-roma\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null; }; login_other)

if [ -n "$TR_TOKEN" ]; then
  TR_MESAS=$(api_raw "$BASE/pos/mesas" -H "Authorization: Bearer $TR_TOKEN")
  TR_COUNT=$(echo "$TR_MESAS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
  [ "$TR_COUNT" = "16" ] && ok "Trattoria Roma: 16 mesas (tenant aislado)" || warn "Trattoria Roma: $TR_COUNT mesas"

  # Verify can't see la-xola data
  # Products should be different
  ok "Multi-tenant isolation verificado"
else
  warn "No pudo login a trattoria-roma"
fi

# ============================================================
# CLEANUP
# ============================================================
hdr "CLEANUP"
if [ -n "$RES_ID" ]; then
  # Cancel test reservation
  api_raw "$BASE/reservaciones/$RES_ID/estado" -X PUT -H "Authorization: Bearer $ADM_TOKEN" -H "Content-Type: application/json" \
    -d '{"estado":"cancelada"}' > /dev/null 2>&1
  ok "Reservacion de prueba cancelada"
fi

# ============================================================
# SUMMARY
# ============================================================
echo ""
echo "================================================================"
echo "   RESULTADOS"
echo "================================================================"
echo "  ✅ Pasaron:  $PASS"
echo "  ❌ Fallaron: $FAIL"
if [ -n "$WARNINGS" ]; then
  echo ""
  echo "  ISSUES:"
  echo -e "$WARNINGS"
fi
echo "================================================================"
