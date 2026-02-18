# 02 — DIAGNOSTICAR

## Riesgos, Ambigüedades Típicas, Fallas Comunes y Cómo Evitarlas

---

## 2.1 Mapa de Riesgos

### Riesgos Técnicos

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|----|--------|-------------|---------|------------|
| RT1 | El código generado tiene bugs o no compila | Alta | Alto | Pipeline de validación: lint → build → test automatizado post-generación |
| RT2 | La generación produce código inseguro (SQL injection, XSS) | Media | Crítico | Templates pre-hardened + SAST scan automático + guardrails en el prompt |
| RT3 | El modelo "alucina" entidades o flujos que no existen en el MVS | Media | Alto | Validación de output contra MVS schema + eval suite |
| RT4 | La app generada no escala bajo carga | Media | Alto | Blueprints incluyen patterns de escalabilidad probados (connection pooling, caching, pagination) |
| RT5 | Migraciones de DB rompen datos existentes al re-generar | Alta | Crítico | Diff de schema antes de migrar, backup automático, migraciones reversibles |
| RT6 | El multi-tenancy tiene leaks de datos entre tenants | Baja | Crítico | PostgreSQL RLS por defecto, tests de aislamiento automatizados |
| RT7 | El pipeline de generación tarda demasiado (> 10 min) | Media | Medio | Generación paralela por módulo, caching de componentes comunes |
| RT8 | Dependencias del código generado quedan desactualizadas | Alta | Medio | Lock files + bot de actualización + re-generación periódica |

### Riesgos de Producto

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|----|--------|-------------|---------|------------|
| RP1 | El MVS no captura lo que el usuario realmente quiere | Alta | Alto | Sistema de preguntas con preview en tiempo real, confirmación explícita |
| RP2 | El usuario quiere cambios que requieren re-generar todo | Media | Alto | Re-generación parcial que respeta archivos marcados como "custom" |
| RP3 | Los blueprints no cubren el nicho del usuario | Media | Medio | Blueprint "Custom" genérico + marketplace de templates comunitarios |
| RP4 | El usuario no puede personalizar la app post-generación | Alta | Alto | Código limpio, documentado, con puntos de extensión marcados |
| RP5 | Competencia con low-code (Bubble, Retool) | Alta | Medio | Diferenciador: genera código real, no vendor lock-in, production-grade |

### Riesgos Comerciales

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|----|--------|-------------|---------|------------|
| RC1 | Costo de API de Claude hace el negocio no rentable | Media | Crítico | Model routing agresivo (Haiku para simple, Opus solo para diseño), caching, batch |
| RC2 | Usuarios generan apps y se van (churn alto) | Alta | Alto | Hosting managed + actualizaciones automáticas como retención |
| RC3 | Liability por bugs en apps generadas | Media | Alto | ToS claros, código es "as-is", responsabilidad del usuario en producción |

---

## 2.2 Ambigüedades Típicas del Usuario

Cuando un usuario describe lo que quiere, estas son las ambigüedades más comunes y cómo el sistema las resuelve:

### Ambigüedad 1: Entidades Incompletas
```
Usuario dice: "Quiero un sistema para mi clínica"
Problema:    ¿Qué entidades? ¿Pacientes? ¿Citas? ¿Expedientes? ¿Recetas?
Resolución:  El blueprint "EHR" + overlay "healthcare" inyecta las entidades
             estándar del dominio. El sistema pregunta: "¿Cuáles de estas
             entidades necesitas?" en lugar de "¿Qué entidades quieres?"
```

### Ambigüedad 2: Roles Vagos
```
Usuario dice: "Necesito diferentes tipos de usuarios"
Problema:    ¿Cuáles? ¿Qué puede hacer cada uno?
Resolución:  El blueprint sugiere roles estándar del dominio.
             CRM → admin, sales_rep, manager
             LMS → admin, instructor, student
             El usuario solo confirma o ajusta.
```

### Ambigüedad 3: Flujos Implícitos
```
Usuario dice: "Los clientes deben poder reservar citas"
Problema:    ¿Flujo de confirmación? ¿Pagos? ¿Cancelación? ¿Recordatorios?
Resolución:  El blueprint "Booking" incluye el flujo completo por defecto.
             El sistema muestra: "Tu flujo de reservas incluirá: selección →
             confirmación → pago → recordatorio → cancelación. ¿Quieres
             modificar algo?"
```

### Ambigüedad 4: Contradicciones
```
Usuario dice: "Quiero que sea gratis para los usuarios pero con planes de pago"
Problema:    Contradicción directa
Resolución:  El motor anti-ambigüedad detecta la contradicción y pregunta:
             "¿Quieres un modelo freemium (gratis con límites, pago para más)
             o completamente gratis sin monetización?"
```

### Ambigüedad 5: Escala No Definida
```
Usuario dice: "Necesito un CRM"
Problema:    ¿Para 10 usuarios o 10,000? ¿100 contactos o 1M?
Resolución:  Default inteligente basado en el plan seleccionado.
             Starter: hasta 1,000 contactos, 5 usuarios
             Pro: hasta 100,000 contactos, 50 usuarios
             Enterprise: sin límites
```

---

## 2.3 Fallas Comunes en Generadores de Código y Cómo Evitarlas

### Falla 1: "Código Espagueti Generado"
- **Síntoma:** Código sin estructura, funciones enormes, sin separación de concerns
- **Causa:** Prompt no especifica arquitectura ni patterns
- **Solución:** Los blueprints incluyen la estructura de archivos y patterns obligatorios. El agente genera dentro de esa estructura, no from scratch.

### Falla 2: "Funciona en Demo, Falla en Producción"
- **Síntoma:** No hay manejo de errores, no hay validación, no hay rate limiting
- **Causa:** El generador se enfoca en happy path
- **Solución:** Los templates incluyen middleware de producción pre-configurado: error handling, validation, rate limiting, health checks, logging. El código generado se inyecta DENTRO de este scaffold.

### Falla 3: "Generó Algo Diferente a lo que Pedí"
- **Síntoma:** Las entidades o flujos no corresponden al MVS
- **Causa:** El LLM interpretó mal o alucinó
- **Solución:** Pipeline con etapa de verificación: se genera un PRD intermedio que el usuario confirma antes de generar código. Post-generación, se ejecuta un "spec compliance check" automatizado.

### Falla 4: "No Puedo Modificar el Código Generado"
- **Síntoma:** Código críptico, sin comentarios, acoplado al generador
- **Causa:** El generador optimiza para su conveniencia, no para el mantenedor humano
- **Solución:** El prompt exige código idiomático con comentarios, nombres descriptivos, y sin dependencias del generador. Post-generación es código vanilla que cualquier dev puede mantener.

### Falla 5: "Cada App Generada es Completamente Diferente"
- **Síntoma:** Inconsistencia en estructura, naming, patterns entre apps
- **Causa:** Generación from scratch cada vez
- **Solución:** Core compartido (módulos base) + generación solo de la capa de negocio. Todas las apps comparten la misma estructura base, auth, billing, etc.

---

## 2.4 Matriz de Detección de Contradicciones

El sistema debe detectar automáticamente estas contradicciones en el MVS:

| Contradicción | Detección | Resolución Automática |
|---------------|-----------|----------------------|
| Entidad referenciada pero no definida | Grafo de dependencias de entidades | Preguntar o inferir del blueprint |
| Rol con permisos conflictivos | Análisis de permisos por CRUD | Pedir clarificación |
| Flujo que requiere entidad no incluida | Análisis de dependencias del flujo | Sugerir agregar la entidad |
| Billing configurado sin precio | Validación de campos requeridos | Aplicar defaults del plan |
| Multi-idioma con un solo idioma definido | Verificación de consistencia | Desactivar multi-idioma |
| Integración externa sin credenciales | Check de requisitos de integración | Marcar como "configurar post-deploy" |
| Campo "obligatorio" con default nulo | Validación de esquemas | Pedir valor default o marcar como opcional |

---

## 2.5 Checklist de Viabilidad Pre-Generación

Antes de iniciar el pipeline, validar:

```
VIABILIDAD TÉCNICA:
□ ¿Existe blueprint base para este tipo de app?
□ ¿Todas las entidades del MVS tienen al menos un campo?
□ ¿Los roles definidos cubren todos los flujos?
□ ¿Las integraciones solicitadas son soportadas?
□ ¿El volumen esperado es compatible con el plan?

VIABILIDAD DEL MVS:
□ ¿El MVS pasa validación contra JSON Schema?
□ ¿No hay contradicciones detectadas?
□ ¿Todos los campos obligatorios están presentes?
□ ¿Las entidades forman un grafo conexo (no hay islas)?
□ ¿Hay al menos un flujo de negocio definido?

VIABILIDAD COMERCIAL:
□ ¿El plan del usuario soporta la cantidad de entidades?
□ ¿El costo estimado de generación está dentro del presupuesto?
□ ¿No se exceden los límites del plan?
```
