import type { OrgRole } from "@/generated/prisma/client";

type Action = "create" | "read" | "update" | "delete" | "manage";
type Resource =
  | "apps"
  | "generations"
  | "blueprints"
  | "members"
  | "billing"
  | "settings"
  | "audit_logs";

const PERMISSIONS: Record<OrgRole, Record<Resource, Action[]>> = {
  OWNER: {
    apps: ["create", "read", "update", "delete", "manage"],
    generations: ["create", "read", "update", "delete", "manage"],
    blueprints: ["read"],
    members: ["create", "read", "update", "delete", "manage"],
    billing: ["read", "update", "manage"],
    settings: ["read", "update", "manage"],
    audit_logs: ["read"],
  },
  ADMIN: {
    apps: ["create", "read", "update", "delete"],
    generations: ["create", "read", "update", "delete"],
    blueprints: ["read"],
    members: ["create", "read", "update"],
    billing: ["read"],
    settings: ["read", "update"],
    audit_logs: ["read"],
  },
  MEMBER: {
    apps: ["create", "read", "update"],
    generations: ["create", "read"],
    blueprints: ["read"],
    members: ["read"],
    billing: [],
    settings: ["read"],
    audit_logs: [],
  },
  VIEWER: {
    apps: ["read"],
    generations: ["read"],
    blueprints: ["read"],
    members: ["read"],
    billing: [],
    settings: [],
    audit_logs: [],
  },
};

export function hasPermission(
  role: OrgRole,
  resource: Resource,
  action: Action
): boolean {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return false;

  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) return false;

  return resourcePermissions.includes(action) || resourcePermissions.includes("manage");
}

export function requirePermission(
  role: OrgRole,
  resource: Resource,
  action: Action
): void {
  if (!hasPermission(role, resource, action)) {
    throw new Error(
      `Insufficient permissions: ${role} cannot ${action} ${resource}`
    );
  }
}

// Plan limits
const PLAN_LIMITS = {
  FREE: { maxApps: 1, maxEntitiesPerApp: 5, maxRegenerationsPerMonth: 3 },
  STARTER: { maxApps: 5, maxEntitiesPerApp: 15, maxRegenerationsPerMonth: 20 },
  PRO: { maxApps: 20, maxEntitiesPerApp: 50, maxRegenerationsPerMonth: 100 },
  ENTERPRISE: { maxApps: Infinity, maxEntitiesPerApp: Infinity, maxRegenerationsPerMonth: Infinity },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: PlanType) {
  return PLAN_LIMITS[plan];
}

export function checkPlanLimit(
  plan: PlanType,
  limit: keyof (typeof PLAN_LIMITS)["FREE"],
  currentValue: number
): { allowed: boolean; limit: number; current: number } {
  const planLimits = PLAN_LIMITS[plan];
  const maxValue = planLimits[limit];
  return {
    allowed: currentValue < maxValue,
    limit: maxValue,
    current: currentValue,
  };
}
