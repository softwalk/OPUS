# Minimum Viable Spec (MVS)

## Definición: El input mínimo necesario para generar un SaaS funcional

---

## Principio

El MVS es el contrato entre el usuario y el generador. Contiene SOLO lo que no se puede inferir. Todo lo demás tiene defaults inteligentes.

## Campos del MVS

### Obligatorios (el usuario DEBE responder)

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `app_name` | string | Nombre de la aplicación | "CliniTrack" |
| `blueprint` | enum | Tipo base de SaaS | "ehr" |
| `industry` | enum | Sector / industria | "healthcare" |
| `description` | string | Descripción en 1-3 oraciones | "Sistema de expedientes clínicos para consultorios pequeños" |
| `entities` | array | Entidades de negocio principales | Ver estructura abajo |
| `roles` | array | Roles de usuario | `["admin", "doctor", "receptionist"]` |

### Opcionales (defaults inteligentes si no se proveen)

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `locale` | string | `"es-MX"` | Idioma principal |
| `currency` | string | `"MXN"` | Moneda para billing |
| `branding.primary_color` | string | `"#2563EB"` | Color primario |
| `branding.logo_url` | string | null | Logo (se usa initial del nombre) |
| `auth_providers` | array | `["email", "google"]` | Providers de OAuth |
| `billing_enabled` | boolean | `true` | ¿Incluir billing? |
| `billing_provider` | string | `"stripe"` | Provider de pagos |
| `notifications` | array | `["email", "in_app"]` | Canales de notificación |
| `integrations` | array | `[]` | Integraciones externas |
| `compliance` | array | `[]` | Requisitos regulatorios |
| `custom_fields` | object | `{}` | Campos adicionales por entidad |
| `workflows` | array | auto-detectados del blueprint | Flujos de trabajo |
| `api_access` | boolean | `true` | ¿Exponer API REST? |
| `export_enabled` | boolean | `false` | ¿Permitir export de datos? |

### Estructura de una Entidad

```json
{
  "name": "Patient",
  "display_name": "Paciente",
  "fields": [
    {
      "name": "full_name",
      "type": "string",
      "required": true,
      "display_name": "Nombre completo"
    },
    {
      "name": "date_of_birth",
      "type": "date",
      "required": true,
      "display_name": "Fecha de nacimiento"
    },
    {
      "name": "email",
      "type": "email",
      "required": false,
      "display_name": "Correo electrónico"
    },
    {
      "name": "blood_type",
      "type": "enum",
      "options": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      "required": false,
      "display_name": "Tipo de sangre"
    }
  ],
  "relations": [
    {
      "entity": "Encounter",
      "type": "one_to_many",
      "display_name": "Consultas"
    }
  ],
  "permissions": {
    "admin": ["create", "read", "update", "delete"],
    "doctor": ["create", "read", "update"],
    "receptionist": ["create", "read"]
  }
}
```

### Tipos de campo soportados

| Tipo | DB Type | UI Component | Validación |
|------|---------|-------------|-----------|
| `string` | TEXT | Input text | maxLength |
| `text` | TEXT | Textarea | maxLength |
| `integer` | INTEGER | Input number | min, max |
| `decimal` | NUMERIC | Input number (step=0.01) | min, max, precision |
| `boolean` | BOOLEAN | Toggle/Switch | — |
| `date` | DATE | Date picker | min, max |
| `datetime` | TIMESTAMPTZ | Datetime picker | min, max |
| `email` | TEXT | Input email | regex email |
| `phone` | TEXT | Input tel | regex phone |
| `url` | TEXT | Input url | regex url |
| `enum` | TEXT | Select/Radio | options[] |
| `file` | TEXT (URL) | File upload | maxSize, allowedTypes |
| `image` | TEXT (URL) | Image upload | maxSize, dimensions |
| `money` | NUMERIC(12,2) | Currency input | min, max |
| `json` | JSONB | JSON editor | schema |
| `relation` | UUID (FK) | Select/Autocomplete | entity ref |

## Ejemplo Completo de MVS

```json
{
  "app_name": "CliniTrack",
  "blueprint": "ehr",
  "industry": "healthcare",
  "description": "Sistema de expedientes clínicos electrónicos para consultorios médicos pequeños y medianos en México",
  "locale": "es-MX",
  "currency": "MXN",
  "roles": [
    {
      "name": "admin",
      "display_name": "Administrador",
      "description": "Acceso total al sistema"
    },
    {
      "name": "doctor",
      "display_name": "Médico",
      "description": "Gestión de pacientes y consultas"
    },
    {
      "name": "receptionist",
      "display_name": "Recepcionista",
      "description": "Registro de pacientes y agendamiento"
    }
  ],
  "entities": [
    {
      "name": "Patient",
      "display_name": "Paciente",
      "fields": [
        {"name": "full_name", "type": "string", "required": true, "display_name": "Nombre completo"},
        {"name": "curp", "type": "string", "required": false, "display_name": "CURP"},
        {"name": "date_of_birth", "type": "date", "required": true, "display_name": "Fecha de nacimiento"},
        {"name": "gender", "type": "enum", "options": ["Masculino", "Femenino", "Otro"], "required": true, "display_name": "Género"},
        {"name": "phone", "type": "phone", "required": true, "display_name": "Teléfono"},
        {"name": "email", "type": "email", "required": false, "display_name": "Email"},
        {"name": "blood_type", "type": "enum", "options": ["A+","A-","B+","B-","AB+","AB-","O+","O-"], "required": false, "display_name": "Tipo de sangre"},
        {"name": "allergies", "type": "text", "required": false, "display_name": "Alergias conocidas"},
        {"name": "insurance_provider", "type": "string", "required": false, "display_name": "Aseguradora"}
      ],
      "relations": [
        {"entity": "Encounter", "type": "one_to_many"}
      ],
      "permissions": {
        "admin": ["create","read","update","delete"],
        "doctor": ["create","read","update"],
        "receptionist": ["create","read"]
      }
    },
    {
      "name": "Encounter",
      "display_name": "Consulta",
      "fields": [
        {"name": "date", "type": "datetime", "required": true, "display_name": "Fecha y hora"},
        {"name": "reason", "type": "text", "required": true, "display_name": "Motivo de consulta"},
        {"name": "diagnosis", "type": "text", "required": false, "display_name": "Diagnóstico"},
        {"name": "treatment", "type": "text", "required": false, "display_name": "Tratamiento"},
        {"name": "notes", "type": "text", "required": false, "display_name": "Notas clínicas"},
        {"name": "cost", "type": "money", "required": false, "display_name": "Costo de consulta"},
        {"name": "status", "type": "enum", "options": ["Programada","En curso","Completada","Cancelada"], "required": true, "display_name": "Estado"}
      ],
      "relations": [
        {"entity": "Patient", "type": "many_to_one"},
        {"entity": "Prescription", "type": "one_to_many"}
      ],
      "permissions": {
        "admin": ["create","read","update","delete"],
        "doctor": ["create","read","update"],
        "receptionist": ["create","read"]
      }
    },
    {
      "name": "Prescription",
      "display_name": "Receta",
      "fields": [
        {"name": "medication", "type": "string", "required": true, "display_name": "Medicamento"},
        {"name": "dosage", "type": "string", "required": true, "display_name": "Dosis"},
        {"name": "frequency", "type": "string", "required": true, "display_name": "Frecuencia"},
        {"name": "duration", "type": "string", "required": true, "display_name": "Duración"},
        {"name": "instructions", "type": "text", "required": false, "display_name": "Instrucciones"}
      ],
      "relations": [
        {"entity": "Encounter", "type": "many_to_one"}
      ],
      "permissions": {
        "admin": ["create","read","update","delete"],
        "doctor": ["create","read","update"],
        "receptionist": ["read"]
      }
    }
  ],
  "billing_enabled": true,
  "compliance": ["lfpdppp"],
  "notifications": ["email", "in_app"],
  "branding": {
    "primary_color": "#059669"
  }
}
```
