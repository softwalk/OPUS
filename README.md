# 🏭 SaaS Factory — Plataforma de Generación de SaaS con IA

## Genera aplicaciones SaaS completas a partir de un Minimum Viable Spec (MVS)

**Motor:** Claude Opus 4.6 | **Enfoque:** Multi-tenant, multi-nicho, plantillas modulares
**Filosofía:** Pedir lo mínimo, generar lo máximo, producción real desde el día uno.

---

## 📁 Estructura del Proyecto

```
saas-factory/
├── docs/
│   ├── 01-DECONSTRUIR.md          # Intención, entidades, supuestos, gaps
│   ├── 02-DIAGNOSTICAR.md         # Riesgos, ambigüedades, fallas, mitigación
│   ├── 03-DESARROLLAR.md          # Diseño completo del sistema
│   ├── 04-ENTREGAR.md             # Roadmap, checklist, plan accionable
│   ├── ARCHITECTURE.md            # Arquitectura técnica detallada
│   ├── MINIMUM-VIABLE-SPEC.md     # Definición del MVS
│   ├── QUESTION-FLOW.md           # Sistema de preguntas mínimas
│   ├── PIPELINE.md                # Pipeline de generación end-to-end
│   ├── COMMERCIAL-STRATEGY.md     # Pricing, paquetización, marketplace
│   └── MASTER-PROMPT.md           # Prompt maestro reutilizable
├── specs/
│   ├── openapi.yaml               # API principal
│   ├── agent-contract.yaml        # Contrato del agente generador
│   ├── api/*.yaml                 # APIs específicas
│   └── data-schemas/*.json        # Schemas de datos
├── templates/
│   ├── blueprints/*.yaml          # Plantillas por tipo de SaaS
│   └── industries/*.yaml          # Overlays por industria
├── pipeline/
│   ├── pipeline-config.yaml       # Config del pipeline de generación
│   └── stages.yaml                # Etapas del pipeline
├── prompts/v1/                    # System prompts de cada agente
├── guardrails/                    # Seguridad, validación, anti-ambigüedad
├── evals/                         # Evaluaciones y datasets
├── infrastructure/                # Docker, K8s configs
├── scripts/                       # Utilidades
└── .github/workflows/             # CI/CD
```

## 🚀 Orden de Lectura

1. `docs/01-DECONSTRUIR.md` → Qué y por qué
2. `docs/02-DIAGNOSTICAR.md` → Riesgos y mitigación
3. `docs/03-DESARROLLAR.md` → Diseño completo
4. `docs/04-ENTREGAR.md` → Plan accionable + roadmap
5. `docs/MASTER-PROMPT.md` → El prompt que genera apps
