# Arquitectura Técnica Detallada

## Diagramas, Flujos de Datos y Decisiones Técnicas

---

## Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| **Plataforma Frontend** | Next.js 15 + Tailwind + shadcn/ui | SSR, DX, ecosistema |
| **Plataforma Backend** | Next.js API Routes + tRPC | Type-safety end-to-end |
| **Base de Datos** | PostgreSQL 16 + RLS | Multi-tenant nativo, robusto |
| **Cache** | Redis 7 | Sessions, cache, rate limiting |
| **Cola** | BullMQ (Redis) | Jobs de generación, deploys |
| **Storage** | S3/R2 (Cloudflare) | Código generado, assets |
| **AI** | Anthropic API (Opus/Sonnet/Haiku) | Motor de generación |
| **Auth** | NextAuth.js v5 | OAuth, JWT, sessions |
| **Billing** | Stripe | Suscripciones, metering |
| **Deploy (plataforma)** | Kubernetes / Fly.io | Escalable, portable |
| **Deploy (apps)** | Docker containers managed | Aislamiento por app |
| **CI/CD** | GitHub Actions | Integración nativa |
| **Monitoreo** | Prometheus + Grafana + Sentry | Métricas, logs, errores |
| **CDN** | Cloudflare | Performance, DDoS protection |

## Flujo de Datos Principal

```
Usuario ──▶ Discovery UI ──▶ Discovery Agent (Sonnet)
                                    │
                                    ▼
                              MVS Validado
                                    │
                                    ▼
                           Orchestrator (Opus)
                              │    │    │
                    ┌─────────┘    │    └─────────┐
                    ▼              ▼              ▼
              PRD Generator   Design Agent   CodeGen Agent
              (Opus)         (Opus)         (Sonnet x paralelo)
                    │              │              │
                    └──────┬───────┘              │
                           ▼                      ▼
                      Design Doc            Código Generado
                                                 │
                                                 ▼
                                          Reviewer (Opus)
                                          + Automated Checks
                                                 │
                                         ┌───────┴───────┐
                                         │ Pass?         │
                                         │ Sí → Deploy   │
                                         │ No → Re-gen   │
                                         └───────────────┘
                                                 │
                                                 ▼
                                          App Desplegada
                                          + URL + Creds
```

## Modelo de Datos Relacional

```
platform.organizations ─── 1:N ──── platform.users
         │                                    
         ├── 1:N ──── platform.apps ─── 1:N ──── platform.generations
         │                  │
         │                  ├── blueprint_id → platform.blueprints
         │                  └── industry_overlay → platform.industry_overlays
         │
         ├── 1:N ──── platform.usage_metrics
         └── 1:N ──── platform.audit_log

platform.marketplace_templates
         │
         └── author_org_id → platform.organizations
```

## Decisiones Técnicas Clave

### Multi-Tenancy: Schema Compartido + RLS

**Elegido:** Un schema PostgreSQL con `tenant_id` en cada tabla + Row Level Security.

**Alternativas descartadas:**
- Schema por tenant: complejo de mantener, migraciones multiplicadas
- DB por tenant: costoso, difícil de escalar
- Discriminator column sin RLS: riesgo de data leak

**Implementación:**
```sql
-- Toda tabla de negocio tiene tenant_id
-- RLS se activa automáticamente
-- El middleware setea current_setting('app.current_tenant_id') antes de cada query
-- Prisma middleware inyecta tenant_id en toda operación
```

### Generación: Templates + AI (No Pure AI)

**Elegido:** Scaffold fijo (auth, layout, middleware) + AI genera solo la capa de negocio.

**Por qué no AI pura:** Inconsistencia, bugs en infraestructura, lento.
**Por qué no templates puros:** No se adapta a MVS arbitrarios.
**Sweet spot:** AI genera entidades, API, UI de negocio sobre scaffold probado.

### Auth: NextAuth.js v5

**Elegido:** NextAuth con JWT + refresh tokens.

**Flujo:**
```
1. Login → NextAuth genera JWT con: userId, orgId, tenantId, role
2. Middleware extrae JWT → setea headers para API routes
3. API routes leen headers → aplican RBAC + RLS
4. Refresh token rota cada 15 min
```

### Rate Limiting: Token Bucket en Redis

```
Lectura: 100 req/min por tenant
Escritura: 30 req/min por tenant
Generación: según plan (3-100/mes por org)
API pública: 1000 req/hora por API key
```
