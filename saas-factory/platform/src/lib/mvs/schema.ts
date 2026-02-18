import { z } from "zod";

export const fieldSchema = z.object({
  name: z.string().regex(/^[a-z][a-z_0-9]+$/),
  type: z.enum([
    "string", "text", "integer", "decimal", "boolean", "date", "datetime",
    "email", "phone", "url", "enum", "file", "image", "money", "json", "relation",
  ]),
  display_name: z.string(),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  default_value: z.unknown().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  max_length: z.number().int().optional(),
});

export const relationSchema = z.object({
  entity: z.string(),
  type: z.enum(["one_to_one", "one_to_many", "many_to_one", "many_to_many"]),
  display_name: z.string().optional(),
});

export const entitySchema = z.object({
  name: z.string().regex(/^[A-Z][a-zA-Z]+$/),
  display_name: z.string(),
  fields: z.array(fieldSchema).min(1).max(50),
  relations: z.array(relationSchema).optional(),
  permissions: z.record(z.string(), z.array(z.enum(["create", "read", "update", "delete"]))).optional(),
});

export const roleSchema = z.object({
  name: z.string().regex(/^[a-z_]+$/),
  display_name: z.string(),
  description: z.string().optional(),
});

export const workflowTransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  allowed_roles: z.array(z.string()).optional(),
  trigger_action: z.string().optional(),
});

export const workflowSchema = z.object({
  entity: z.string(),
  field: z.string(),
  states: z.array(z.string()),
  transitions: z.array(workflowTransitionSchema),
});

export const mvsSchema = z.object({
  app_name: z.string().min(2).max(50).regex(/^[a-zA-ZÀ-ÿ0-9 _-]+$/),
  blueprint: z.enum([
    "crm", "inventory", "booking", "lms", "marketplace",
    "invoicing", "tickets", "projects", "ehr", "pms", "custom",
  ]),
  industry: z.enum([
    "healthcare", "retail", "education", "real_estate", "hospitality",
    "finance", "logistics", "legal", "manufacturing", "general",
  ]),
  description: z.string().min(10).max(500),
  locale: z.enum(["es-MX", "es-ES", "en-US", "pt-BR"]).default("es-MX"),
  currency: z.enum(["MXN", "USD", "EUR", "BRL", "COP", "ARS"]).default("MXN"),
  roles: z.array(roleSchema).min(1).max(10),
  entities: z.array(entitySchema).min(1).max(50),
  billing_enabled: z.boolean().default(true),
  billing_provider: z.enum(["stripe", "mercadopago"]).default("stripe"),
  auth_providers: z.array(z.enum(["email", "google", "github", "microsoft"])).default(["email", "google"]),
  notifications: z.array(z.enum(["email", "in_app", "sms", "whatsapp"])).default(["email", "in_app"]),
  compliance: z.array(z.enum(["lfpdppp", "gdpr", "hipaa", "soc2", "pci_dss"])).default([]),
  integrations: z.array(z.object({
    name: z.string(),
    type: z.enum(["api", "webhook", "oauth", "zapier"]),
    config: z.record(z.string(), z.unknown()).optional(),
  })).default([]),
  branding: z.object({
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#2563EB"),
    logo_url: z.string().url().optional(),
  }).default({ primary_color: "#2563EB" }),
  workflows: z.array(workflowSchema).default([]),
});

export type MvsInput = z.input<typeof mvsSchema>;
export type MvsOutput = z.output<typeof mvsSchema>;
