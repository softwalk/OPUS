import { mvsSchema, type MvsOutput } from "./schema";

export interface ValidationIssue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  field?: string;
}

const BLOCKED_ENTITY_NAMES = ["User", "Tenant", "Organization", "AuditLog", "Session"];
const BLOCKED_FIELD_NAMES = ["password", "secret", "token", "api_key"];

export function validateMvs(data: unknown): {
  valid: boolean;
  mvs?: MvsOutput;
  issues: ValidationIssue[];
} {
  // Step 1: Schema validation
  const parseResult = mvsSchema.safeParse(data);
  if (!parseResult.success) {
    return {
      valid: false,
      issues: parseResult.error.issues.map((err, i) => ({
        id: `schema_${i}`,
        severity: "error" as const,
        message: `${err.path.map(String).join(".")}: ${err.message}`,
        field: err.path.map(String).join("."),
      })),
    };
  }

  const mvs = parseResult.data;
  const issues: ValidationIssue[] = [];

  // Step 2: Business rules validation

  // Check blocked entity names
  for (const entity of mvs.entities) {
    if (BLOCKED_ENTITY_NAMES.includes(entity.name)) {
      issues.push({
        id: "blocked_entity",
        severity: "error",
        message: `Entity name "${entity.name}" is reserved by the system`,
        field: `entities.${entity.name}`,
      });
    }

    // Check blocked field names
    for (const field of entity.fields) {
      if (BLOCKED_FIELD_NAMES.includes(field.name)) {
        issues.push({
          id: "blocked_field",
          severity: "error",
          message: `Field name "${field.name}" in entity "${entity.name}" is blocked for security`,
          field: `entities.${entity.name}.fields.${field.name}`,
        });
      }
    }

    // Check for duplicate field names
    const fieldNames = entity.fields.map((f) => f.name);
    const duplicates = fieldNames.filter((n, i) => fieldNames.indexOf(n) !== i);
    if (duplicates.length > 0) {
      issues.push({
        id: "duplicate_fields",
        severity: "error",
        message: `Duplicate field names in "${entity.name}": ${duplicates.join(", ")}`,
        field: `entities.${entity.name}`,
      });
    }
  }

  // Check orphan entities (no relations)
  const entityNames = mvs.entities.map((e) => e.name);
  for (const entity of mvs.entities) {
    const hasRelations = entity.relations && entity.relations.length > 0;
    const isReferencedByOthers = mvs.entities.some(
      (e) => e.relations?.some((r) => r.entity === entity.name)
    );
    if (!hasRelations && !isReferencedByOthers && mvs.entities.length > 1) {
      issues.push({
        id: "orphan_entity",
        severity: "warning",
        message: `Entity "${entity.name}" has no relations with other entities`,
        field: `entities.${entity.name}`,
      });
    }
  }

  // Check relation targets exist
  for (const entity of mvs.entities) {
    if (entity.relations) {
      for (const rel of entity.relations) {
        if (!entityNames.includes(rel.entity)) {
          issues.push({
            id: "missing_relation_target",
            severity: "error",
            message: `Entity "${entity.name}" has relation to non-existent entity "${rel.entity}"`,
            field: `entities.${entity.name}.relations`,
          });
        }
      }
    }
  }

  // Check roles have permissions defined
  for (const role of mvs.roles) {
    const hasAnyPermissions = mvs.entities.some(
      (e) => e.permissions && e.permissions[role.name]
    );
    if (!hasAnyPermissions) {
      issues.push({
        id: "missing_permissions",
        severity: "warning",
        message: `Role "${role.name}" has no explicit permissions defined - defaults will be applied`,
        field: `roles.${role.name}`,
      });
    }
  }

  // Check workflow entities exist
  for (const workflow of mvs.workflows) {
    if (!entityNames.includes(workflow.entity)) {
      issues.push({
        id: "workflow_entity_missing",
        severity: "error",
        message: `Workflow references non-existent entity "${workflow.entity}"`,
        field: "workflows",
      });
    }
  }

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    valid: !hasErrors,
    mvs: hasErrors ? undefined : mvs,
    issues,
  };
}
