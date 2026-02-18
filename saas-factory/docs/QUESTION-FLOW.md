# Sistema de Preguntas Mínimas (Discovery Flow)

## Principio: Solo preguntar lo que NO podemos inferir.

---

## Flujo (Máximo 10 Pasos)

```
PASO 1: "¿Qué quieres construir?" → Input libre
PASO 2: Clasificación automática → blueprint + industria inferidos
PASO 3: "¿Qué nombre tendrá tu app?"
PASO 4: Confirmación de entidades (pre-seleccionadas del blueprint)
PASO 5: Campos por entidad (solo si modificó paso 4)
PASO 6: Roles de usuario (pre-seleccionados del blueprint)
PASO 7: Preview + Confirmación → "¿Listo para generar?"
PASO 8: (OPCIONAL) Personalización: branding, integraciones, billing
PASO 9: Generación con progress bar
PASO 10: Entrega: URL + credenciales + próximos pasos
```

## Lógica de Inferencia por Paso

### Paso 1 → 2: Clasificación Automática

El agente analiza el input libre y extrae:

```json
{
  "intent": "booking + ehr",
  "industry": "healthcare",
  "sub_industry": "dental",
  "detected_entities": ["Patient", "Appointment", "Treatment"],
  "detected_features": ["scheduling", "patient_records"],
  "confidence": 0.87,
  "suggested_blueprint": "booking",
  "suggested_overlay": "healthcare"
}
```

Si confidence < 0.7, pide clarificación. Si >= 0.7, presenta la inferencia para confirmar.

### Paso 4: Entidades Pre-Seleccionadas

En lugar de preguntar "¿qué entidades necesitas?", el sistema muestra:

```
Tu app de Reservas para Clínica Dental incluirá:

✅ Pacientes (nombre, teléfono, email, historial)
✅ Citas (fecha, hora, servicio, estado)
✅ Servicios (nombre, duración, precio)
✅ Doctores (nombre, especialidad, horario)
☐ Pagos (monto, método, estado)
☐ Recetas (medicamento, dosis, instrucciones)

¿Quieres agregar, quitar o modificar alguna?
```

### Paso 6: Roles Pre-Seleccionados

```
Tipos de usuario de tu app:

✅ Administrador — acceso total
✅ Doctor — gestionar pacientes y citas
✅ Recepcionista — agendar citas y registrar pacientes
☐ Paciente (portal) — ver sus citas y datos

¿Quieres ajustar?
```

## Reglas Anti-Ambigüedad

| Situación | Detección | Acción |
|-----------|-----------|--------|
| Entidad mencionada sin campos | Grafo de dependencias | Inyectar campos del blueprint |
| Rol sin permisos definidos | Check de completitud | Aplicar permisos por defecto del blueprint |
| Contradicción (ej: "gratis" + "cobrar") | Análisis semántico | Preguntar: "¿Freemium o completamente gratis?" |
| Entidad huérfana (sin relación) | Grafo de entidades | Sugerir relación o preguntar |
| Campo obligatorio sin tipo | Inferencia de nombre | Inferir tipo (ej: "email" → tipo email) |
| Flujo incompleto | Análisis de estados | Completar con flujo estándar del blueprint |

## Defaults Inteligentes por Blueprint

| Blueprint | Entidades Default | Roles Default | Flujo Default |
|-----------|------------------|---------------|---------------|
| CRM | Contact, Company, Deal, Activity | admin, sales_rep, manager | Lead → Qualified → Proposal → Won/Lost |
| Booking | Service, Resource, Booking, Client | admin, provider, client | Available → Booked → Confirmed → Completed |
| Inventory | Product, Warehouse, Movement, Supplier | admin, warehouse_mgr, viewer | In Stock → Reserved → Shipped → Delivered |
| LMS | Course, Module, Lesson, Student | admin, instructor, student | Draft → Published → Enrolled → Completed |
| Invoicing | Invoice, LineItem, Client, Payment | admin, accountant, viewer | Draft → Sent → Paid → Overdue |
| Tickets | Ticket, Agent, Queue, Response | admin, agent, customer | Open → In Progress → Resolved → Closed |

## Métricas del Discovery Flow

| Métrica | Target |
|---------|--------|
| Preguntas promedio hasta MVS completo | ≤ 8 |
| Tiempo promedio de discovery | ≤ 10 minutos |
| Tasa de "confirmó sin cambios" en paso 4 | > 60% |
| Tasa de abandono en discovery | < 20% |
| Contradicciones detectadas y resueltas | 100% |
