import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPlanLimits } from "@/lib/permissions";
import type { Plan } from "@/generated/prisma/client";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { organization: true },
  });

  if (!user) return null;

  const org = user.organization;
  const limits = getPlanLimits(org.plan as Plan);

  const appCount = await prisma.app.count({
    where: { orgId: org.id, status: { not: "ARCHIVED" } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuracion</h1>
        <p className="text-muted-foreground">Gestiona tu cuenta y organizacion</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizacion</CardTitle>
          <CardDescription>Detalles de tu organizacion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Nombre</span>
            <span className="font-medium">{org.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Slug</span>
            <code className="text-sm bg-gray-100 px-2 py-1 rounded">{org.slug}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Plan</span>
            <Badge>{org.plan}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Limites del Plan</CardTitle>
          <CardDescription>Uso actual vs. limites de tu plan {org.plan}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Apps</span>
            <span className="text-sm">
              {appCount} / {limits.maxApps === Infinity ? "Ilimitadas" : limits.maxApps}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Entidades por App</span>
            <span className="text-sm">
              {limits.maxEntitiesPerApp === Infinity ? "Ilimitadas" : limits.maxEntitiesPerApp}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Re-generaciones / mes</span>
            <span className="text-sm">
              {limits.maxRegenerationsPerMonth === Infinity ? "Ilimitadas" : limits.maxRegenerationsPerMonth}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tu Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Nombre</span>
            <span className="font-medium">{user.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Rol</span>
            <Badge variant="outline">{user.role}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
