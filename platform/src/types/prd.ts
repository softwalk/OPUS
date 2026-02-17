export interface PrdApiRoute {
  method: string;
  path: string;
  description: string;
  authRequired: boolean;
  permissions: string[];
  queryParams?: Array<{ name: string; type: string; required: boolean }>;
  responseSchema?: Record<string, unknown>;
  validationSchema?: Record<string, unknown>;
}

export interface PrdUiPage {
  path: string;
  type: "list" | "detail" | "form" | "dashboard";
  entity: string;
  columns?: string[];
  filters?: string[];
  actions?: string[];
}

export interface PrdWorkflow {
  entity: string;
  field: string;
  states: string[];
  transitions: Array<{
    from: string;
    to: string;
    allowedRoles: string[];
    actions?: string[];
  }>;
}

export interface PRD {
  prd_version: string;
  app_name: string;
  database_schema: {
    prisma_schema: string;
    rls_policies: Array<{ table: string; policy: string }>;
    indexes: string[];
  };
  api_routes: PrdApiRoute[];
  permissions_matrix: Record<string, Record<string, string[]>>;
  ui_pages: PrdUiPage[];
  workflows: PrdWorkflow[];
  billing_config?: Record<string, unknown>;
  seed_data: Record<string, unknown[]>;
  middleware_config: {
    auth: Record<string, unknown>;
    tenant_resolution: Record<string, unknown>;
    rate_limiting: Record<string, unknown>;
  };
}
