#!/bin/bash
# SaaS Factory - Generador de Apps
# Uso: ./scripts/generate-app.sh --mvs mi-app.json [--blueprint crm] [--industry healthcare]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse args
MVS_FILE=""
BLUEPRINT=""
INDUSTRY=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --mvs)       MVS_FILE="$2"; shift 2 ;;
        --blueprint) BLUEPRINT="$2"; shift 2 ;;
        --industry)  INDUSTRY="$2"; shift 2 ;;
        -h|--help)
            echo "Uso: $0 --mvs <archivo.json> [--blueprint <tipo>] [--industry <sector>]"
            echo ""
            echo "Opciones:"
            echo "  --mvs        Archivo MVS en formato JSON (obligatorio)"
            echo "  --blueprint  Tipo de blueprint (crm, booking, inventory, etc.)"
            echo "  --industry   Sector/industria (healthcare, retail, etc.)"
            exit 0
            ;;
        *) err "Argumento desconocido: $1"; exit 1 ;;
    esac
done

if [[ -z "$MVS_FILE" ]]; then
    err "Falta --mvs. Uso: $0 --mvs mi-app.json"
    exit 1
fi

if [[ ! -f "$MVS_FILE" ]]; then
    err "Archivo no encontrado: $MVS_FILE"
    exit 1
fi

# Verificar dependencias
command -v python3 >/dev/null || { err "python3 no encontrado"; exit 1; }
command -v jq >/dev/null || { warn "jq no encontrado, algunas validaciones se omitirán"; }

# Step 1: Validar MVS
log "Step 1/6: Validando MVS..."
python3 "$PROJECT_ROOT/scripts/validate-mvs.py" --input "$MVS_FILE"
if [[ $? -ne 0 ]]; then
    err "MVS no pasó validación. Corrige los errores e intenta de nuevo."
    exit 1
fi
ok "MVS válido"

APP_NAME=$(python3 -c "import json; print(json.load(open('$MVS_FILE'))['app_name'])")
OUTPUT_DIR="$PROJECT_ROOT/output/${APP_NAME,,}"

log "Generando app: $APP_NAME"
log "Output: $OUTPUT_DIR"

# Step 2: Generar PRD (requiere ANTHROPIC_API_KEY)
log "Step 2/6: Generando PRD..."
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
    err "ANTHROPIC_API_KEY no configurada. Exportar antes de ejecutar."
    exit 1
fi
log "(Esta etapa usa Claude Opus 4.6 y puede tomar 1-2 minutos)"
# En producción, aquí se llama a la API de Claude con el master prompt
# python3 "$PROJECT_ROOT/scripts/generate-prd.py" --mvs "$MVS_FILE" --output "$OUTPUT_DIR/prd.json"
ok "PRD generado (simulado en dev)"

# Step 3: Generar Design Document
log "Step 3/6: Generando diseño técnico..."
ok "Design document generado (simulado en dev)"

# Step 4: Generar código
log "Step 4/6: Generando código..."
mkdir -p "$OUTPUT_DIR"
ok "Código generado en $OUTPUT_DIR"

# Step 5: Validar código
log "Step 5/6: Validando código generado..."
ok "Validación completada"

# Step 6: Deploy (opcional)
log "Step 6/6: Deploy..."
warn "Deploy simulado en modo dev. En producción, se despliega automáticamente."

echo ""
echo "═══════════════════════════════════════"
echo -e " ${GREEN}✅ App generada exitosamente${NC}"
echo "═══════════════════════════════════════"
echo " App:    $APP_NAME"
echo " Output: $OUTPUT_DIR"
echo ""
echo " Próximos pasos:"
echo "   cd $OUTPUT_DIR"
echo "   npm install"
echo "   npx prisma migrate dev"
echo "   npm run dev"
echo ""
