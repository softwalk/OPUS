# 01 — DECONSTRUIR

## Intención, Entidades, Supuestos, Qué Falta y Qué No Hace Falta Preguntar

---

## 1.1 Intención Real

**¿Qué se quiere construir?**
Una plataforma-fábrica que recibe una especificación mínima (MVS) de un usuario no técnico o semi-técnico y genera automáticamente una aplicación SaaS funcional, multi-tenant, lista para producción, con billing integrado.

**¿Para quién?**
- Agencias de desarrollo que quieren entregar más rápido
- Emprendedores no técnicos que quieren validar ideas
- Empresas que necesitan herramientas internas
- Consultores que venden soluciones verticales

**¿Qué problema resuelve?**
El 80% de las aplicaciones SaaS comparten el mismo 80% de funcionalidad (auth, CRUD, roles, billing, notificaciones). Hoy se reescribe desde cero cada vez. SaaS Factory elimina esa redundancia.

**Modelo mental:** LEGO + Factory. Bloques reutilizables (blueprints) que se ensamblan según la especificación, personalizados por industria (overlays), y generados por IA.

---

## 1.2 Entidades del Dominio

```
┌──────────────────────────────────────────────────────────────┐
│                    ENTIDADES PRINCIPALES                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  PLATAFORMA (SaaS Factory)                                   │
│  ├── Tenant (organización que usa la plataforma)             │
│  ├── Usuario de la plataforma (quien define el MVS)          │
│  ├── Blueprint (plantilla base por tipo de app)              │
│  ├── Industry Overlay (personalización por sector)           │
│  ├── MVS (Minimum Viable Spec — el input)                   │
│  ├── Pipeline (proceso de generación)                        │
│  └── Generated App (la aplicación generada — el output)      │
│                                                              │
│  APP GENERADA (cada SaaS generado)                           │
│  ├── Tenant del SaaS (cliente final del SaaS generado)       │
│  ├── Usuario del SaaS (usuario final)                        │
│  ├── Entidades de negocio (dinámicas según MVS)              │
│  ├── Roles y permisos                                        │
│  ├── Flujos de trabajo                                       │
│  ├── Integraciones                                           │
│  └── Plan de billing                                         │
│                                                              │
│  MARKETPLACE                                                 │
│  ├── Plantilla publicada                                     │
│  ├── Autor (puede ser la comunidad)                          │
│  ├── Reseña / Rating                                         │
│  └── Transacción (compra/licencia de plantilla)              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Nota crítica — Dos niveles de multi-tenancy:**
1. **Nivel 1:** La plataforma SaaS Factory es multi-tenant (múltiples clientes usan la fábrica)
2. **Nivel 2:** Cada app generada ES TAMBIÉN multi-tenant (el SaaS generado tiene sus propios clientes)

Esto es "multi-tenancy anidado" y es una decisión arquitectónica fundamental.

---

## 1.3 Supuestos Explícitos

| # | Supuesto | Justificación |
|---|----------|---------------|
| S1 | El usuario NO necesita saber programar | La plataforma genera todo el código |
| S2 | El 80% de los SaaS comparten funcionalidad base | Auth, CRUD, roles, billing, notificaciones, audit |
| S3 | Un blueprint + industry overlay cubre el 90% de los requisitos de un nicho | El 10% restante se personaliza post-generación |
| S4 | El MVS puede capturarse en < 15 minutos de interacción | Si toma más, la UX falló |
| S5 | La app generada debe ser editable por humanos | No es una caja negra; genera código limpio y convencional |
| S6 | El deploy es automatizado y la app arranca funcional | No requiere configuración manual post-generación |
| S7 | El billing del SaaS generado usa Stripe como base | Estándar de la industria, más fácil de integrar |
| S8 | Stack técnico del output: Next.js + PostgreSQL + API REST/tRPC | Balanceo entre adopción, rendimiento y talento disponible |
| S9 | La plataforma misma se monetiza por suscripción + generación | Free tier limitado, planes de pago por apps generadas |
| S10 | Cumplimiento básico incluye GDPR/LFPDPPP pero no SOC2/HIPAA en v1 | SOC2/HIPAA son overlays premium para v2+ |

---

## 1.4 Qué Falta (Gaps Identificados)

| Gap | Descripción | Criticidad | Resolución |
|-----|-------------|-----------|------------|
| G1 | ¿Quién hostea las apps generadas? ¿La plataforma (PaaS) o el cliente (self-host)? | Alta | Ambos: managed hosting por defecto, export para self-host |
| G2 | ¿Las apps generadas se pueden actualizar después? ¿Cómo? | Alta | Sí: sistema de "re-generación parcial" que respeta customizaciones |
| G3 | ¿Qué pasa si el usuario quiere funcionalidad que ningún blueprint cubre? | Media | Custom entities + lógica condicional en el MVS |
| G4 | ¿Hay un editor visual post-generación o solo código? | Media | v1: solo código con buena documentación. v2: editor visual |
| G5 | ¿Cómo se manejan las migraciones de DB cuando la app evoluciona? | Alta | Migraciones automáticas versionadas con cada re-generación |
| G6 | ¿Límites de escala por app generada? | Media | Definidos por plan: filas, storage, API calls/mes |
| G7 | ¿Soporte multi-idioma en las apps generadas? | Baja v1 | i18n scaffold incluido, traducción como add-on |

---

## 1.5 Qué NO Hace Falta Preguntar

Estas decisiones se pueden tomar sin consultar al usuario porque tienen defaults claros basados en mejores prácticas:

| Decisión | Default | Por qué no preguntar |
|----------|---------|---------------------|
| ¿Qué base de datos? | PostgreSQL | Estándar, multi-tenant nativo con RLS |
| ¿Framework frontend? | Next.js (App Router) | Adopción masiva, SSR, buen DX |
| ¿Autenticación? | Email + OAuth (Google, GitHub) | Cubre el 95% de los casos |
| ¿Cómo se despliega? | Containers (Docker) en managed infra | Portable, escalable, estándar |
| ¿Sistema de roles? | RBAC con roles base (admin, member, viewer) | Cubre la mayoría de necesidades |
| ¿Formato de API? | REST con OpenAPI spec | Universal, bien tooled |
| ¿Pagos? | Stripe (+ MercadoPago para LATAM) | Estándar global + regional |
| ¿Notificaciones? | Email + in-app | Lo mínimo útil |
| ¿Logs y auditoría? | Structured JSON logs + audit trail | Requerimiento de producción |
| ¿CI/CD? | GitHub Actions | Integración nativa, bajo costo |
| ¿Monitoreo? | Health checks + error tracking (Sentry) | Lo mínimo viable para producción |
| ¿Rate limiting? | Sí, por plan | Protección básica obligatoria |
| ¿Versionado de API? | /v1/ prefix | Buena práctica, sin costo |

**Principio: Si la respuesta correcta es la misma en el 90%+ de los casos, no preguntar. Usar el default y permitir override opcional en el MVS.**

---

## 1.6 Taxonomía de Tipos de SaaS (Blueprints Base)

Identificamos los arquetipos más comunes de SaaS. Cada uno es un "blueprint" que define entidades, flujos y UI patterns:

| Blueprint | Descripción | Ejemplos del Mundo Real | Entidades Core |
|-----------|-------------|------------------------|----------------|
| **CRM** | Gestión de contactos y pipeline de ventas | HubSpot, Pipedrive | Contact, Company, Deal, Pipeline, Activity |
| **Inventario** | Control de stock, productos, almacenes | TradeGecko, inFlow | Product, Warehouse, StockMovement, Supplier |
| **Reservas** | Agendamiento y booking | Calendly, Booksy | Service, Resource, Booking, TimeSlot, Client |
| **LMS** | Plataforma de aprendizaje | Teachable, Thinkific | Course, Module, Lesson, Student, Progress, Certificate |
| **Marketplace** | Compra-venta entre usuarios | Airbnb, MercadoLibre | Listing, Order, Review, Seller, Buyer, Transaction |
| **Facturación** | Emisión de facturas y cobranza | Stripe Billing, Facturama | Invoice, LineItem, Client, Payment, TaxConfig |
| **Tickets** | Mesa de ayuda y soporte | Zendesk, Freshdesk | Ticket, Agent, Queue, SLA, Tag, Response |
| **Proyectos** | Gestión de proyectos y tareas | Asana, Linear | Project, Task, Sprint, Team, Comment, Milestone |
| **EHR** | Expediente clínico (vertical salud) | DrChrono | Patient, Encounter, Prescription, Vital, Lab |
| **PMS** | Property Management | Guesty, Lodgify | Property, Unit, Reservation, Guest, Maintenance |

---

## 1.7 Mapa de Decisiones: Qué Pedir vs. Qué Inferir

```
SIEMPRE PEDIR (campos obligatorios del MVS):
├── Nombre de la app
├── Tipo de SaaS (seleccionar blueprint)
├── Industria / Sector
├── Entidades principales (al menos las del negocio)
└── Roles de usuario

PEDIR SOLO SI ES RELEVANTE:
├── Integraciones externas específicas
├── Requisitos de compliance (si sector regulado)
├── Idioma(s) de la app
└── Personalización de branding

NUNCA PEDIR (inferir o usar default):
├── Stack tecnológico
├── Estructura de base de datos
├── Arquitectura de deployment
├── Configuración de CI/CD
├── Formato de API
├── Sistema de autenticación base
├── Estructura de logs/auditoría
└── Rate limiting y seguridad base
```

Esta taxonomía de "pedir vs. inferir" es lo que permite reducir las preguntas de ~100 a ~10 y capturar el MVS en minutos, no horas.
