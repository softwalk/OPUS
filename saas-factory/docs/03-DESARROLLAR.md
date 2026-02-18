# 03 — DESARROLLAR

## Diseño Completo: Arquitectura + Flujo de Preguntas + Pipeline + Plantillas + Datos

---

## 3.1 Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SAAS FACTORY PLATFORM                            │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      FRONTEND (Next.js)                          │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────┐  │   │
│  │  │ Discovery │  │ App Dashboard│  │ Blueprint │  │ Marketplace│  │   │
│  │  │ Wizard   │  │              │  │ Editor    │  │           │  │   │
│  │  └──────────┘  └──────────────┘  └───────────┘  └───────────┘  │   │
│  └──────────────────────────┬───────────────────────────────────────┘   │
│                             │                                            │
│  ┌──────────────────────────▼───────────────────────────────────────┐   │
│  │                      API GATEWAY                                  │   │
│  │  Auth (JWT) │ Rate Limiting │ Tenant Resolution │ Request Log     │   │
│  └──────────────────────────┬───────────────────────────────────────┘   │
│                             │                                            │
│  ┌──────────────────────────▼───────────────────────────────────────┐   │
│  │                   CORE SERVICES                                   │   │
│  │                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │ Discovery   │  │ Generation  │  │ App Management          │  │   │
│  │  │ Service     │  │ Pipeline    │  │ Service                 │  │   │
│  │  │             │  │             │  │                         │  │   │
│  │  │ • Questions │  │ • MVS→PRD   │  │ • CRUD apps             │  │   │
│  │  │ • MVS Build │  │ • PRD→Code  │  │ • Deploy/Undeploy       │  │   │
│  │  │ • Validation│  │ • Test      │  │ • Re-generation         │  │   │
│  │  │ • Anti-ambig│  │ • Deploy    │  │ • Monitoring             │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│  │                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │ Blueprint   │  │ Billing     │  │ Marketplace             │  │   │
│  │  │ Service     │  │ Service     │  │ Service                 │  │   │
│  │  │             │  │             │  │                         │  │   │
│  │  │ • Registry  │  │ • Plans     │  │ • Publish/Browse        │  │   │
│  │  │ • Compose   │  │ • Metering  │  │ • Purchase              │  │   │
│  │  │ • Validate  │  │ • Stripe    │  │ • Ratings               │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                             │                                            │
│  ┌──────────────────────────▼───────────────────────────────────────┐   │
│  │                   AI AGENT LAYER                                  │   │
│  │                                                                   │   │
│  │  ┌──────────────────────────────────────────────────────────┐    │   │
│  │  │              ORCHESTRATOR (Opus 4.6)                      │    │   │
│  │  │  Recibe MVS → planifica → coordina agentes → entrega     │    │   │
│  │  └──────┬──────────┬──────────┬──────────┬──────────────────┘    │   │
│  │         │          │          │          │                        │   │
│  │  ┌──────▼───┐ ┌────▼────┐ ┌──▼──────┐ ┌▼──────────┐           │   │
│  │  │Discovery │ │Architect│ │CodeGen  │ │Reviewer   │           │   │
│  │  │Agent     │ │Agent    │ │Agent    │ │Agent      │           │   │
│  │  │(Sonnet)  │ │(Opus)   │ │(Sonnet) │ │(Opus)     │           │   │
│  │  └──────────┘ └─────────┘ └─────────┘ └───────────┘           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                             │                                            │
│  ┌──────────────────────────▼───────────────────────────────────────┐   │
│  │                   DATA LAYER                                      │   │
│  │                                                                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │   │
│  │  │PostgreSQL│  │ Redis    │  │ S3/Minio │  │ Queue          │  │   │
│  │  │(main DB) │  │(cache +  │  │(generated│  │(Bull/RabbitMQ) │  │   │
│  │  │+ RLS     │  │ sessions)│  │ code)    │  │(pipeline jobs) │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                   OBSERVABILITY                                   │   │
│  │  Logs (JSON) │ Traces (OTEL) │ Metrics (Prometheus) │ Alerts     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

                              │ DEPLOY
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    GENERATED APPS (Runtime)                               │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ App "MiCRM"  │  │ App "CliniX" │  │ App "EduPro" │  ... N apps     │
│  │ (CRM + Retail│  │ (EHR + Salud)│  │ (LMS + Edu)  │                  │
│  │  blueprint)  │  │              │  │              │                  │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │                  │
│  │ │ Frontend │ │  │ │ Frontend │ │  │ │ Frontend │ │                  │
│  │ │ (Next.js)│ │  │ │ (Next.js)│ │  │ │ (Next.js)│ │                  │
│  │ ├──────────┤ │  │ ├──────────┤ │  │ ├──────────┤ │                  │
│  │ │ API      │ │  │ │ API      │ │  │ │ API      │ │                  │
│  │ │ (Node)   │ │  │ │ (Node)   │ │  │ │ (Node)   │ │                  │
│  │ ├──────────┤ │  │ ├──────────┤ │  │ ├──────────┤ │                  │
│  │ │ DB (PG)  │ │  │ │ DB (PG)  │ │  │ │ DB (PG)  │ │                  │
│  │ │ + RLS    │ │  │ │ + RLS    │ │  │ │ + RLS    │ │                  │
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3.2 Módulos del Core

### Módulo 1: Discovery Service

**Responsabilidad:** Guiar al usuario desde idea vaga → MVS completo y validado.

**Componentes:**
- Question Engine: decide qué preguntar según contexto
- MVS Builder: construye el MVS incrementalmente
- Validator: valida el MVS contra schema y reglas de negocio
- Anti-Ambiguity Engine: detecta contradicciones y vacíos
- Preview Generator: muestra preview de la app en tiempo real

**Flujo detallado:** Ver `docs/QUESTION-FLOW.md`

### Módulo 2: Blueprint Service

**Responsabilidad:** Gestionar el catálogo de blueprints e industry overlays.

**Componentes:**
- Registry: catálogo de blueprints disponibles
- Composer: combina blueprint + overlay + customizaciones del MVS
- Validator: verifica compatibilidad entre blueprint, overlay y MVS
- Marketplace Connector: conecta con templates de terceros

### Módulo 3: Generation Pipeline

**Responsabilidad:** Transformar MVS validado → código funcional desplegado.

**Etapas:** Ver `docs/PIPELINE.md`

### Módulo 4: App Management Service

**Responsabilidad:** Lifecycle de las apps generadas.

**Componentes:**
- Deploy Manager: despliega, actualiza, escala, destruye apps
- Re-generation Engine: re-genera parcialmente respetando customizaciones
- Monitoring Proxy: health checks y métricas de cada app
- Migration Manager: migraciones de DB seguras

### Módulo 5: Billing Service

**Responsabilidad:** Monetización de la plataforma y del SaaS generado.

**Dos niveles:**
1. Billing de la plataforma (cobro al creador de la app)
2. Billing integrado en la app generada (cobro al usuario final)

### Módulo 6: Marketplace Service

**Responsabilidad:** Ecosistema de blueprints y overlays comunitarios.

---

## 3.3 Multi-Tenancy Architecture

### Nivel 1: Plataforma (SaaS Factory)

```sql
-- Cada organización es un tenant de la plataforma
CREATE TABLE platform.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',  -- free, starter, pro, enterprise
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: cada query filtra por org_id del JWT
ALTER TABLE platform.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON platform.organizations
    USING (id = current_setting('app.current_org_id')::UUID);
```

### Nivel 2: App Generada (multi-tenant del SaaS)

```sql
-- Cada app generada tiene sus propios tenants
-- Schema compartido con RLS (modelo más simple y escalable)
CREATE TABLE app.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Todas las tablas de negocio tienen tenant_id
-- RLS aísla datos automáticamente
CREATE TABLE app.{entity_name} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app.tenants(id),
    -- ... campos de la entidad ...
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS automático
ALTER TABLE app.{entity_name} ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.{entity_name}
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### Estrategia de Aislamiento

| Aspecto | Plataforma | App Generada |
|---------|-----------|-------------|
| DB | Schema `platform.*` con RLS | Schema `app.*` con RLS |
| Storage | Bucket por organización | Bucket por app, carpeta por tenant |
| Subdomain | `{org}.saasfactory.com` | `{tenant}.{app-name}.app` |
| API Keys | JWT con org_id | JWT con tenant_id |
| Billing | Stripe customer = organización | Stripe customer = tenant del SaaS |

---

## 3.4 Seguridad por Capas

```
Capa 1: NETWORK
├── HTTPS obligatorio (TLS 1.3)
├── WAF (rate limiting, IP blocking)
├── DDoS protection (Cloudflare/AWS Shield)
└── VPN para servicios internos

Capa 2: AUTENTICACIÓN
├── JWT con refresh tokens (rotación automática)
├── OAuth 2.0 (Google, GitHub, Microsoft)
├── MFA opcional (TOTP)
├── Session management con Redis
└── Brute force protection (lockout después de 5 intentos)

Capa 3: AUTORIZACIÓN
├── RBAC (Role-Based Access Control)
├── Roles por defecto: owner, admin, member, viewer
├── Permisos granulares por entidad y acción
├── API key scoping (read-only, write, admin)
└── Tenant isolation via RLS

Capa 4: DATOS
├── Encryption at rest (AES-256)
├── Encryption in transit (TLS)
├── PII redaction en logs
├── Backup automático diario
├── Soft delete por defecto (retención 30 días)
└── Audit trail inmutable

Capa 5: CÓDIGO GENERADO
├── SAST scan post-generación (semgrep)
├── Dependency scan (npm audit, Snyk)
├── OWASP Top 10 hardened por defecto
├── Input validation en todo endpoint
├── Parameterized queries (no string concat)
├── CSRF protection
├── CORS configurado por dominio
└── Content Security Policy headers

Capa 6: OPERACIONAL
├── Secrets en Vault/AWS Secrets Manager
├── Least privilege para service accounts
├── Immutable infrastructure (containers)
├── Audit log de toda acción administrativa
└── Incident response playbook
```

---

## 3.5 Observabilidad

### Métricas de la Plataforma

```yaml
platform_metrics:
  generation:
    - generation_requests_total          # Total de generaciones solicitadas
    - generation_success_rate            # % exitosas
    - generation_duration_seconds        # Tiempo de generación (histograma)
    - generation_cost_usd                # Costo de API por generación
    - generation_by_blueprint            # Distribución por blueprint
  
  apps:
    - active_apps_total                  # Apps desplegadas activas
    - apps_by_plan                       # Distribución por plan
    - app_uptime_percent                 # Uptime promedio de apps
    - app_error_rate                     # Tasa de error por app
  
  business:
    - mrr_usd                            # Monthly Recurring Revenue
    - new_signups_daily                  # Registros diarios
    - conversion_free_to_paid            # Tasa de conversión
    - churn_monthly                      # Churn mensual
    - arpu_usd                           # Average Revenue Per User
    - cac_usd                            # Customer Acquisition Cost
```

### Stack de Observabilidad

```
Logs:    Structured JSON → Loki/CloudWatch
Traces:  OpenTelemetry → Jaeger/Tempo
Metrics: Prometheus → Grafana
Errors:  Sentry (platform + apps generadas)
Alerts:  Grafana Alerting → Slack/PagerDuty
Uptime:  Synthetic checks cada 60s por app
```

---

## 3.6 Escalabilidad

### Horizontal Scaling

```
┌─────────────────────────────────────────┐
│          Load Balancer (L7)              │
├──────┬──────┬──────┬──────┬─────────────┤
│ API  │ API  │ API  │ API  │ Auto-scale  │
│ Pod 1│ Pod 2│ Pod 3│ Pod N│ por CPU/RPS │
└──┬───┴──┬───┴──┬───┴──┬───┘             │
   └──────┼──────┼──────┘                  │
          ▼                                │
   ┌──────────────┐                        │
   │  PG Primary  │ ← Write               │
   ├──────────────┤                        │
   │  PG Replica  │ ← Read                │
   │  PG Replica  │ ← Read                │
   └──────────────┘                        │
                                           │
   ┌──────────────┐                        │
   │  Redis       │ ← Cache + Sessions    │
   │  (Cluster)   │                        │
   └──────────────┘                        │
                                           │
   ┌──────────────────────────────────┐    │
   │  Generation Workers              │    │
   │  (scale 0→N según cola)         │    │
   │  Worker 1 │ Worker 2 │ Worker N  │    │
   └──────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Límites por Plan

| Recurso | Free | Starter ($49/mes) | Pro ($199/mes) | Enterprise |
|---------|------|----------|------|------------|
| Apps generadas | 1 | 5 | 20 | Ilimitadas |
| Re-generaciones/mes | 3 | 20 | 100 | Ilimitadas |
| Entidades por app | 5 | 15 | 50 | Ilimitadas |
| Tenants por app | 1 | 10 | 100 | Ilimitadas |
| Storage por app | 500MB | 5GB | 50GB | Custom |
| API calls/mes | 10K | 100K | 1M | Custom |
| Custom domain | No | Sí | Sí | Sí |
| Priority support | No | Email | Chat | Dedicado |
| Export código | No | Sí | Sí | Sí |
| Blueprints premium | No | No | Sí | Sí |
| SLA | — | 99.5% | 99.9% | 99.95% |
