# Pipeline de Generación

## Desde MVS → PRD → Diseño → Backend/Frontend → Tests → Despliegue → Billing

---

## Vista General

```
MVS Validado
    │
    ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  STAGE 1     │──▶│  STAGE 2     │──▶│  STAGE 3     │
│  MVS → PRD   │   │  PRD → Design│   │  Code Gen    │
│  (Opus 4.6)  │   │  (Opus 4.6)  │   │  (Sonnet 4.5)│
└──────────────┘   └──────────────┘   └──────────────┘
                                           │
    ┌──────────────────────────────────────┘
    ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  STAGE 4     │──▶│  STAGE 5     │──▶│  STAGE 6     │
│  Validate    │   │  Deploy      │   │  Configure   │
│  (Haiku 4.5) │   │  (Infra)     │   │  Billing     │
└──────────────┘   └──────────────┘   └──────────────┘
```

## Stage 1: MVS → PRD (Product Requirements Document)

**Agente:** Architect Agent (Opus 4.6)
**Input:** MVS validado + Blueprint + Industry Overlay
**Output:** PRD estructurado

**El PRD contiene:**
- Lista completa de entidades con campos, tipos, validaciones
- Mapa de relaciones entre entidades
- Matriz de permisos (RBAC completa)
- Flujos de trabajo con estados y transiciones
- Lista de endpoints API con request/response
- Wireframes textuales de cada pantalla
- Configuración de billing (planes, límites, features)
- Requisitos de compliance específicos

**Validación:** El usuario puede revisar el PRD antes de continuar. Si no revisa en 5 min, continúa automáticamente.

## Stage 2: PRD → Design (Diseño Técnico)

**Agente:** Architect Agent (Opus 4.6)
**Input:** PRD
**Output:** Design Document

**El Design Document contiene:**
- Schema de base de datos (Prisma schema)
- Estructura de archivos del proyecto
- Definición de API routes
- Componentes de UI necesarios
- Middleware y hooks
- Configuración de auth y tenant resolution
- Jobs y cron tasks

## Stage 3: Code Generation

**Agente:** CodeGen Agent (Sonnet 4.5) — en paralelo por módulo
**Input:** Design Document + Templates base
**Output:** Código fuente completo

**Generación paralela:**
```
CodeGen Agent
├── [Paralelo] DB Schema + Migrations (Prisma)
├── [Paralelo] API Routes (CRUD por entidad)
├── [Paralelo] Frontend Pages (listado, detalle, forms)
├── [Paralelo] Auth + Middleware
├── [Secuencial] Billing integration
├── [Secuencial] Seed data
└── [Secuencial] Tests básicos
```

**Importante:** El CodeGen NO genera from scratch. Usa templates pre-existentes (scaffold) y genera SOLO la capa de negocio sobre ellos. Esto asegura consistencia y calidad.

## Stage 4: Validate

**Agente:** Reviewer Agent (Opus 4.6) + Automated checks
**Input:** Código generado
**Output:** Reporte de validación

**Checks automáticos:**
```
□ TypeScript compila sin errores (tsc --noEmit)
□ ESLint pasa sin errores críticos
□ Prisma schema es válido (prisma validate)
□ Todos los endpoints tienen validación de input (Zod)
□ RLS policies existen para todas las tablas
□ SAST scan limpio (semgrep)
□ Dependency scan limpio (npm audit)
□ Tests básicos pasan
□ Build de Next.js exitoso
□ Docker image se construye correctamente
```

**Check del Reviewer Agent:**
- ¿El código refleja el PRD?
- ¿Hay entidades del MVS no implementadas?
- ¿Los permisos están correctamente aplicados?
- ¿Hay patrones de seguridad faltantes?

Si falla → re-genera las partes fallidas (máx 3 reintentos).

## Stage 5: Deploy

**Proceso:** Automatizado, sin intervención humana
**Input:** Código validado + Docker image
**Output:** App desplegada con URL

```
1. Build Docker image
2. Push a registry
3. Provisionar base de datos (schema + RLS + seed)
4. Provisionar Redis instance
5. Deploy container(s)
6. Configurar dominio/subdomain
7. Provisionar SSL (Let's Encrypt)
8. Health check
9. Smoke test automatizado
```

## Stage 6: Configure Billing

**Proceso:** Semi-automatizado
**Input:** Config de billing del MVS
**Output:** Stripe configurado

```
1. Crear productos en Stripe
2. Crear planes/precios
3. Configurar webhooks
4. Crear portal de cliente
5. Verificar flujo: signup → trial → cobro
```

## Tiempos Estimados por Stage

| Stage | Tiempo | Modelo | Costo estimado |
|-------|--------|--------|---------------|
| 1. MVS → PRD | 30-60s | Opus 4.6 | $0.50 |
| 2. PRD → Design | 30-60s | Opus 4.6 | $0.40 |
| 3. Code Gen | 2-5min | Sonnet 4.5 | $0.80 |
| 4. Validate | 1-2min | Haiku + tools | $0.15 |
| 5. Deploy | 2-3min | Infra only | $0.00 |
| 6. Billing | 30s | API calls | $0.00 |
| **Total** | **5-10min** | | **~$1.85** |
