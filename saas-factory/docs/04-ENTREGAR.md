# 04 — ENTREGAR

## Plan Accionable: Roadmap + Checklist + Artefactos Iniciales

---

## 4.1 Roadmap 30/90/180 Días

### Días 1-30: MVP Funcional (Alpha Interna)

**Objetivo:** Generar una app CRM funcional desde un MVS, desplegada automáticamente.

| Semana | Entregable | Criterio de Éxito |
|--------|-----------|-------------------|
| S1 | MVS Schema definido + Discovery Agent funcional | Agent captura MVS completo en < 15 preguntas |
| S1 | Blueprint CRM completo | Cubre: Contactos, Empresas, Deals, Pipeline, Activities |
| S2 | Pipeline de generación: MVS → PRD → Código | Genera repo funcional que compila y pasa lint |
| S2 | Scaffold base con auth + multi-tenant + RBAC | Login, registro, roles admin/member/viewer funcionan |
| S3 | Generación de entidades dinámicas + API CRUD | CRUD completo para todas las entidades del MVS |
| S3 | Frontend generado (listados, formularios, detalle) | UI funcional con Tailwind, responsive |
| S4 | Deploy automatizado (Docker → managed infra) | App desplegada con URL accesible en < 5 min |
| S4 | Test de integración end-to-end | Demo: MVS → App funcional desplegada en una sesión |

**Criterios de éxito del día 30:**
- Generar un CRM funcional desde cero en < 30 minutos
- La app generada tiene auth, CRUD, roles, multi-tenant
- Deploy automatizado con URL funcional
- 0 errores críticos en el happy path

### Días 31-90: Producto Beta (Beta Cerrada)

| Semana | Entregable | Criterio de Éxito |
|--------|-----------|-------------------|
| S5-S6 | 3 blueprints adicionales: Inventario, Booking, Facturación | Cada uno genera app funcional |
| S5-S6 | 2 industry overlays: Healthcare, Retail | Overlay modifica entidades/campos/compliance del blueprint |
| S7 | Billing de la plataforma (Stripe) | Registro → plan free → upgrade → cobro funcional |
| S7 | Billing integrado en apps generadas | App generada puede cobrar a sus usuarios vía Stripe |
| S8 | Re-generación parcial | Modificar MVS → regenerar solo lo cambiado, preservar custom |
| S8 | Dashboard de gestión de apps | Lista apps, métricas básicas, logs, restart |
| S9-S10 | Sistema de evaluaciones (evals) | Suite de eval con >90% pass rate |
| S9-S10 | Seguridad hardened | SAST scan, dependency scan, pentest básico |
| S11-S12 | Beta cerrada con 10-20 usuarios | Feedback loop semanal |

**Criterios de éxito del día 90:**
- 4 blueprints funcionales con 2 industry overlays
- 10+ usuarios beta generando apps reales
- Billing funcional (plataforma + apps generadas)
- NPS > 40 en beta testers
- < 5% tasa de error en generación
- Tiempo promedio de generación < 10 minutos

### Días 91-180: Lanzamiento Público (GA)

| Semana | Entregable | Criterio de Éxito |
|--------|-----------|-------------------|
| S13-S14 | 10 blueprints totales + 5 industry overlays | Cobertura del 70% de los nichos más demandados |
| S13-S14 | Marketplace v1 (publicar y comprar templates) | Al menos 5 templates de terceros publicados |
| S15-S16 | Custom domain para apps generadas | SSL automático con Let's Encrypt |
| S15-S16 | Onboarding guiado (tutorial interactivo) | Tasa de completación > 80% |
| S17-S18 | Export de código (self-hosting) | El usuario puede descargar y desplegar por su cuenta |
| S17-S18 | API pública de la plataforma | Documentación con OpenAPI + SDK para TypeScript/Python |
| S19-S20 | Optimización de costos (model routing, caching) | Costo por generación < $2 USD promedio |
| S19-S20 | SOC2 Type I preparación | Evidencia recopilada, controles implementados |
| S21-S24 | Lanzamiento público | Product Hunt, marketing, primeros clientes de pago |

**Criterios de éxito del día 180:**
- 100+ apps generadas y activas
- 50+ organizaciones registradas
- MRR > $5,000 USD
- Uptime > 99.5%
- Tiempo promedio de generación < 5 minutos
- Churn mensual < 10%

---

## 4.2 Checklist de Go-Live

### Pre-Requisitos Técnicos

```
INFRAESTRUCTURA:
□ Dominio comprado y DNS configurado
□ SSL/TLS certificados configurados
□ CDN configurada (Cloudflare o similar)
□ Infra de producción provisionada (K8s o managed containers)
□ Base de datos de producción con backups automatizados
□ Redis de producción para cache y sesiones
□ Object storage para código generado y assets
□ Cola de mensajes para jobs de generación
□ Secrets manager configurado con todas las credenciales

SEGURIDAD:
□ OWASP Top 10 mitigado
□ SAST scan integrado en CI/CD (semgrep)
□ Dependency scan integrado (npm audit, Snyk)
□ Rate limiting configurado por plan
□ WAF habilitado
□ DDoS protection activa
□ Brute force protection en login
□ Session management con rotación de tokens
□ CORS configurado solo para dominios permitidos
□ CSP headers configurados
□ PII redaction en logs verificado
□ Audit trail funcional e inmutable
□ Backup/restore probado y documentado
□ Incident response plan documentado

CÓDIGO GENERADO (validaciones post-generación):
□ Todas las queries son parametrizadas
□ Input validation en todo endpoint
□ XSS protection (escape de output)
□ CSRF tokens en formularios
□ File upload validation (tipo, tamaño)
□ Error messages no exponen internals

OBSERVABILIDAD:
□ Logging estructurado funcionando
□ Tracing end-to-end verificado
□ Métricas de negocio reportándose
□ Alertas configuradas para:
  □ Error rate > 5%
  □ Latencia p99 > 5s
  □ Generación fallida
  □ Cost spike
  □ Disk/memory usage > 80%
□ Dashboard de operaciones funcional
□ Synthetic monitoring (uptime checks)
□ On-call rotation establecida

CI/CD:
□ Pipeline de CI funcional (lint, test, build, scan)
□ Pipeline de CD funcional (staging → canary → production)
□ Rollback automatizado probado
□ Feature flags implementados
□ Database migrations automatizadas y probadas
□ Smoke tests post-deploy

BILLING:
□ Stripe integrado y probado
□ Webhooks de Stripe configurados y verificados
□ Planes creados en Stripe (free, starter, pro, enterprise)
□ Upgrade/downgrade funcional
□ Metering de uso funcional
□ Facturación automática verificada
□ Dunning (cobro fallido) configurado

LEGAL:
□ Terms of Service publicados
□ Privacy Policy publicada
□ Cookie Policy (si aplica)
□ DPA (Data Processing Agreement) para enterprise
□ Aviso de privacidad LFPDPPP (México) / GDPR (EU)
□ Disclaimer de código generado "as-is"
```

### Pre-Requisitos Comerciales

```
ONBOARDING:
□ Landing page con propuesta de valor clara
□ Demo interactiva o video de 2 minutos
□ Flujo de signup → primera app generada < 15 minutos
□ Documentación de getting started
□ FAQ con preguntas más comunes
□ Canal de soporte (email mínimo, chat ideal)

MARKETING:
□ 3-5 apps de ejemplo generadas y desplegadas como demo
□ Testimonios de beta testers
□ Comparativa vs. alternativas (Bubble, Retool, etc.)
□ Blog post de lanzamiento
□ Product Hunt preparado

MÉTRICAS DE TRACKING:
□ Analytics configurado (Mixpanel, PostHog, o similar)
□ Funnel de conversión tracked:
  □ Visit → Signup
  □ Signup → First MVS created
  □ First MVS → First app generated
  □ Generated → Deployed
  □ Free → Paid
□ NPS survey implementado (post-generación)
```

---

## 4.3 Artefactos Base

### Schema de Base de Datos de la Plataforma

```sql
-- ═══════════════════════════════════════
-- PLATFORM DATABASE SCHEMA
-- ═══════════════════════════════════════

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schema de la plataforma
CREATE SCHEMA IF NOT EXISTS platform;

-- ── Organizaciones (tenants de la plataforma) ──
CREATE TABLE platform.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free'
        CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Usuarios de la plataforma ──
CREATE TABLE platform.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES platform.organizations(id),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    auth_provider TEXT DEFAULT 'email',
    password_hash TEXT,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Apps generadas ──
CREATE TABLE platform.apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES platform.organizations(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    blueprint_id TEXT NOT NULL,
    industry_overlay TEXT,
    mvs JSONB NOT NULL,               -- El MVS completo
    prd JSONB,                         -- El PRD generado
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'generating', 'generated',
                          'deploying', 'deployed', 'error', 'archived')),
    deploy_url TEXT,
    deploy_config JSONB DEFAULT '{}',
    generation_metadata JSONB DEFAULT '{}',  -- tokens, cost, duration
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, slug)
);

-- ── Generaciones (historial) ──
CREATE TABLE platform.generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES platform.apps(id),
    mvs_snapshot JSONB NOT NULL,        -- MVS al momento de generación
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    stage TEXT,                          -- Etapa actual del pipeline
    logs JSONB DEFAULT '[]',
    cost_usd NUMERIC(10,4),
    tokens_used INTEGER,
    duration_seconds INTEGER,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Blueprints ──
CREATE TABLE platform.blueprints (
    id TEXT PRIMARY KEY,                 -- 'crm', 'inventory', etc.
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    entities JSONB NOT NULL,             -- Entidades que incluye
    flows JSONB DEFAULT '[]',            -- Flujos predefinidos
    ui_patterns JSONB DEFAULT '[]',      -- Patterns de UI
    is_premium BOOLEAN DEFAULT FALSE,
    version TEXT NOT NULL DEFAULT '1.0.0',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Industry Overlays ──
CREATE TABLE platform.industry_overlays (
    id TEXT PRIMARY KEY,                 -- 'healthcare', 'retail', etc.
    name TEXT NOT NULL,
    description TEXT,
    entity_modifications JSONB DEFAULT '{}',  -- Campos extra por entidad
    compliance_requirements JSONB DEFAULT '[]',
    terminology JSONB DEFAULT '{}',      -- Renombrado de labels
    is_premium BOOLEAN DEFAULT FALSE,
    version TEXT NOT NULL DEFAULT '1.0.0',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Marketplace ──
CREATE TABLE platform.marketplace_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_org_id UUID REFERENCES platform.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    blueprint_id TEXT,
    industry_overlay TEXT,
    mvs_template JSONB NOT NULL,
    price_usd NUMERIC(10,2) DEFAULT 0,  -- 0 = gratis
    downloads INTEGER DEFAULT 0,
    rating NUMERIC(3,2),
    status TEXT DEFAULT 'draft'
        CHECK (status IN ('draft', 'review', 'published', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Audit Log ──
CREATE TABLE platform.audit_log (
    id BIGSERIAL PRIMARY KEY,
    org_id UUID,
    user_id UUID,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_org ON platform.audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_resource ON platform.audit_log(resource_type, resource_id);

-- ── Usage Metering ──
CREATE TABLE platform.usage_metrics (
    id BIGSERIAL PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES platform.organizations(id),
    metric_name TEXT NOT NULL,           -- 'generation', 'api_call', 'storage_bytes'
    value NUMERIC NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_usage_org_period ON platform.usage_metrics(org_id, period_start);

-- ── RLS Policies ──
ALTER TABLE platform.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.usage_metrics ENABLE ROW LEVEL SECURITY;
```

### Estructura del Repo de App Generada

```
generated-app/
├── README.md                          # Auto-generado con info de la app
├── package.json
├── tsconfig.json
├── next.config.ts
├── .env.example                       # Variables de entorno documentadas
├── docker-compose.yaml                # Para desarrollo local
├── Dockerfile                         # Multi-stage build optimizado
│
├── prisma/
│   ├── schema.prisma                  # Schema de DB (generado desde MVS)
│   └── migrations/                    # Migraciones versionadas
│
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx             # Dashboard layout con sidebar
│   │   │   ├── page.tsx               # Home/overview
│   │   │   └── [entity]/              # Rutas dinámicas por entidad
│   │   │       ├── page.tsx           # Listado
│   │   │       ├── [id]/page.tsx      # Detalle
│   │   │       └── new/page.tsx       # Crear nuevo
│   │   ├── api/
│   │   │   ├── auth/[...nextauth].ts  # Auth endpoints
│   │   │   └── v1/                    # API REST versionada
│   │   │       └── [entity]/
│   │   │           └── route.ts       # CRUD endpoints
│   │   ├── layout.tsx
│   │   └── page.tsx                   # Landing
│   │
│   ├── components/
│   │   ├── ui/                        # Componentes base (shadcn/ui)
│   │   ├── forms/                     # Formularios por entidad
│   │   ├── tables/                    # Tablas/listados por entidad
│   │   └── layout/                    # Sidebar, header, etc.
│   │
│   ├── lib/
│   │   ├── db.ts                      # Cliente Prisma
│   │   ├── auth.ts                    # Configuración NextAuth
│   │   ├── permissions.ts             # RBAC helpers
│   │   ├── tenant.ts                  # Multi-tenant helpers
│   │   ├── billing.ts                 # Stripe helpers
│   │   ├── validation.ts              # Zod schemas por entidad
│   │   └── utils.ts
│   │
│   ├── middleware.ts                   # Auth + tenant resolution
│   │
│   └── generated/                     # ⚠️ NO EDITAR - regenerable
│       ├── entities.ts                # Tipos TypeScript de entidades
│       ├── api-client.ts              # Cliente API tipado
│       └── permissions.ts             # Mapa de permisos
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── scripts/
│   ├── seed.ts                        # Datos de ejemplo
│   └── migrate.ts                     # Script de migración
│
├── .github/
│   └── workflows/
│       └── ci.yaml                    # CI/CD pipeline
│
└── CUSTOMIZATION.md                   # Guía de personalización post-generación
```

---

## 4.4 Contrato API de la Plataforma (Resumen)

```yaml
# Endpoints principales de SaaS Factory API

# ── Discovery ──
POST   /api/v1/discovery/start           # Inicia sesión de descubrimiento
POST   /api/v1/discovery/answer          # Envía respuesta a pregunta
GET    /api/v1/discovery/{session}/mvs    # Obtiene MVS parcial en construcción
POST   /api/v1/discovery/{session}/validate  # Valida MVS actual

# ── Apps ──
POST   /api/v1/apps                      # Crea app desde MVS
GET    /api/v1/apps                      # Lista apps de la org
GET    /api/v1/apps/{id}                 # Detalle de app
PATCH  /api/v1/apps/{id}                 # Actualiza app (re-genera)
DELETE /api/v1/apps/{id}                 # Archiva app
POST   /api/v1/apps/{id}/deploy         # Despliega app
POST   /api/v1/apps/{id}/undeploy       # Quita deploy
GET    /api/v1/apps/{id}/logs           # Logs de la app
GET    /api/v1/apps/{id}/metrics        # Métricas de la app

# ── Generación ──
POST   /api/v1/generate                  # Inicia pipeline de generación
GET    /api/v1/generate/{id}/status      # Status del pipeline
GET    /api/v1/generate/{id}/logs        # Logs de generación
POST   /api/v1/generate/{id}/cancel      # Cancela generación

# ── Blueprints ──
GET    /api/v1/blueprints                # Lista blueprints disponibles
GET    /api/v1/blueprints/{id}           # Detalle de blueprint
GET    /api/v1/industries                # Lista industry overlays
GET    /api/v1/industries/{id}           # Detalle de overlay

# ── Marketplace ──
GET    /api/v1/marketplace/templates     # Buscar templates
GET    /api/v1/marketplace/templates/{id}  # Detalle
POST   /api/v1/marketplace/templates     # Publicar template
POST   /api/v1/marketplace/templates/{id}/install  # Instalar template

# ── Billing ──
GET    /api/v1/billing/plans             # Planes disponibles
POST   /api/v1/billing/subscribe         # Suscribirse a plan
POST   /api/v1/billing/portal            # URL del portal de Stripe
GET    /api/v1/billing/usage             # Uso actual

# ── Admin ──
GET    /api/v1/org                       # Detalles de la org
PATCH  /api/v1/org                       # Actualizar org
GET    /api/v1/org/members               # Miembros
POST   /api/v1/org/members/invite        # Invitar miembro
```

---

## 4.5 Estimación de Costos de Infraestructura

### Escenario: 100 apps activas, 50 orgs

| Componente | Servicio | Costo/mes estimado |
|------------|---------|-------------------|
| Compute (plataforma) | 3x Kubernetes pods (2 vCPU, 4GB) | $150 |
| Compute (apps generadas) | Containers compartidos | $300 |
| Base de datos | PostgreSQL managed (2 vCPU, 8GB) | $100 |
| Redis | Managed Redis (2GB) | $30 |
| Storage | S3/R2 (100GB) | $5 |
| CDN + WAF | Cloudflare Pro | $20 |
| Monitoring | Grafana Cloud (free tier) | $0 |
| Error tracking | Sentry (free tier) | $0 |
| CI/CD | GitHub Actions (2,000 min/mes) | $0 |
| Claude API | ~500 generaciones/mes @ $2 avg | $1,000 |
| Stripe fees | 2.9% + $0.30 por transacción | Variable |
| **Total** | | **~$1,605/mes** |

### Break-even

Con pricing de Starter=$49/mes, Pro=$199/mes:
- 20 Starter + 5 Pro = $980 + $995 = $1,975/mes → **Rentable desde ~25 clientes pagos**
