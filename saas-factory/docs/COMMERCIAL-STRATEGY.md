# Estrategia Comercial

## Paquetización, Pricing, Límites, Onboarding y Marketplace

---

## Planes y Pricing

| | Free | Starter | Pro | Enterprise |
|--|------|---------|-----|------------|
| **Precio** | $0 | $49/mes | $199/mes | Custom |
| **Apps** | 1 | 5 | 20 | Ilimitadas |
| **Entidades/app** | 5 | 15 | 50 | Ilimitadas |
| **Re-generaciones/mes** | 3 | 20 | 100 | Ilimitadas |
| **Tenants/app** | 1 (sin multi-tenant) | 10 | 100 | Ilimitadas |
| **Storage/app** | 500MB | 5GB | 50GB | Custom |
| **API calls/mes** | 10K | 100K | 1M | Custom |
| **Usuarios/org** | 1 | 5 | 20 | Ilimitados |
| **Custom domain** | ❌ | ✅ | ✅ | ✅ |
| **Export código** | ❌ | ✅ | ✅ | ✅ |
| **Blueprints premium** | ❌ | ❌ | ✅ | ✅ |
| **Industry overlays** | Básicos | Todos | Todos | Custom |
| **Soporte** | Docs | Email (48h) | Chat (4h) | Dedicado |
| **SLA** | — | 99.5% | 99.9% | 99.95% |
| **Billing en app** | ❌ | ✅ | ✅ | ✅ |
| **Whitelabel** | ❌ | ❌ | ❌ | ✅ |

## Modelo de Revenue

```
Revenue Streams:
├── 1. Suscripciones mensuales (MRR principal)
├── 2. Generaciones adicionales ($5/generación extra)
├── 3. Marketplace (20% comisión en ventas de templates)
├── 4. Add-ons premium:
│   ├── Custom domain: incluido desde Starter
│   ├── Integración CRM externo: $29/mes
│   ├── Compliance pack (SOC2, HIPAA): $99/mes
│   └── Priority generation: $19/mes
└── 5. Enterprise: contrato anual custom
```

## Funnel de Conversión Target

```
Visitante → Signup (8%) → Primera app generada (60%) → Deploy (80%) → Paid (15%)

Métricas objetivo:
- Time to first app: < 15 min desde signup
- Free → Starter conversion: 15% en 30 días
- Starter → Pro upgrade: 25% en 90 días
- Monthly churn (paid): < 8%
- ARPU: $120/mes
- LTV: $1,440 (12 meses promedio)
- CAC target: < $200
```

## Onboarding

```
Minuto 0:   Signup (email o Google OAuth)
Minuto 1:   "¿Qué quieres construir?" (Discovery paso 1)
Minuto 5:   MVS completado, preview mostrado
Minuto 8:   App generándose (progress bar visible)
Minuto 13:  App desplegada, URL entregada
Minuto 14:  Tour guiado de la app generada (3 pasos)
Minuto 15:  "Tu app está lista. ¿Qué quieres ajustar?"

Post-onboarding (email drip):
Día 1:  "Así puedes personalizar tu app" (tutorial)
Día 3:  "Conecta tu dominio propio" (upgrade hint)
Día 7:  "Tus primeros usuarios: cómo invitar al equipo"
Día 14: "Tu app está creciendo, considera Starter" (si free)
Día 30: "Resumen del mes + tips de optimización"
```

## Marketplace de Templates

**Modelo:** Creadores publican templates (blueprint + overlay + MVS parcial), usuarios los instalan.

**Revenue split:** 80% creador / 20% plataforma

**Categorías:**
- Por industria (Salud, Retail, Educación, etc.)
- Por tipo (CRM, Inventory, Booking, etc.)
- Por funcionalidad (Billing, Reporting, Analytics)
- Gratis vs. Premium

**Proceso de publicación:**
1. Creador crea app usando la plataforma
2. Exporta como template
3. Agrega descripción, screenshots, pricing
4. Review automático (calidad + seguridad)
5. Publicación en marketplace

**Quality gates para publicación:**
- Template genera app sin errores
- Documentación mínima presente
- Sin dependencias externas rotas
- Eval score > 85%
- Sin contenido inapropiado
