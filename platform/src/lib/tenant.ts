import { auth } from "./auth";
import { prisma } from "./db";

export async function getCurrentSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  return session;
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { organization: true },
  });
  if (!user) throw new Error("User not found");
  return user;
}

export async function getCurrentOrg() {
  const session = await getCurrentSession();
  const org = await prisma.organization.findFirst({
    where: {
      users: { some: { id: session.user.id } },
    },
  });
  if (!org) throw new Error("Organization not found");
  return org;
}

export async function logAuditEvent(params: {
  orgId?: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  await prisma.auditLog.create({
    data: {
      orgId: params.orgId,
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      details: (params.details || {}) as any,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
}
