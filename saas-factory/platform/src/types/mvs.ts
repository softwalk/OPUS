export type BlueprintType =
  | "crm"
  | "inventory"
  | "booking"
  | "lms"
  | "marketplace"
  | "invoicing"
  | "tickets"
  | "projects"
  | "ehr"
  | "pms"
  | "custom";

export type IndustryType =
  | "healthcare"
  | "retail"
  | "education"
  | "real_estate"
  | "hospitality"
  | "finance"
  | "logistics"
  | "legal"
  | "manufacturing"
  | "general";

export type FieldType =
  | "string"
  | "text"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "email"
  | "phone"
  | "url"
  | "enum"
  | "file"
  | "image"
  | "money"
  | "json"
  | "relation";

export type RelationType =
  | "one_to_one"
  | "one_to_many"
  | "many_to_one"
  | "many_to_many";

export interface MvsField {
  name: string;
  type: FieldType;
  display_name: string;
  required?: boolean;
  unique?: boolean;
  options?: string[];
  default_value?: unknown;
  min?: number;
  max?: number;
  max_length?: number;
}

export interface MvsRelation {
  entity: string;
  type: RelationType;
  display_name?: string;
}

export interface MvsEntity {
  name: string;
  display_name: string;
  fields: MvsField[];
  relations?: MvsRelation[];
  permissions?: Record<string, string[]>;
}

export interface MvsRole {
  name: string;
  display_name: string;
  description?: string;
}

export interface MvsWorkflowTransition {
  from: string;
  to: string;
  allowed_roles?: string[];
  trigger_action?: string;
}

export interface MvsWorkflow {
  entity: string;
  field: string;
  states: string[];
  transitions: MvsWorkflowTransition[];
}

export interface MvsIntegration {
  name: string;
  type: "api" | "webhook" | "oauth" | "zapier";
  config?: Record<string, unknown>;
}

export interface MvsBranding {
  primary_color?: string;
  logo_url?: string;
}

export interface MVS {
  app_name: string;
  blueprint: BlueprintType;
  industry: IndustryType;
  description: string;
  locale?: string;
  currency?: string;
  roles: MvsRole[];
  entities: MvsEntity[];
  billing_enabled?: boolean;
  billing_provider?: "stripe" | "mercadopago";
  auth_providers?: string[];
  notifications?: string[];
  compliance?: string[];
  integrations?: MvsIntegration[];
  branding?: MvsBranding;
  workflows?: MvsWorkflow[];
}

export interface DiscoveryClassification {
  intent: string;
  industry: IndustryType;
  sub_industry?: string;
  detected_entities: string[];
  detected_features: string[];
  confidence: number;
  suggested_blueprint: BlueprintType;
  suggested_overlay?: string;
}
