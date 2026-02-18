import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Box, Zap, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [appCount, generationCount, deployedCount] = await Promise.all([
    prisma.app.count({ where: { orgId: session.user.orgId, status: { not: "ARCHIVED" } } }),
    prisma.generation.count({
      where: { app: { orgId: session.user.orgId } },
    }),
    prisma.app.count({ where: { orgId: session.user.orgId, status: "DEPLOYED" } }),
  ]);

  const recentApps = await prisma.app.findMany({
    where: { orgId: session.user.orgId, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Bienvenido, {session.user.name}
          </p>
        </div>
        <Link href="/dashboard/apps/new">
          <Button>
            <Zap className="mr-2 h-4 w-4" />
            Nueva App
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Apps</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{appCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Generaciones</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{generationCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Desplegadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deployedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Apps Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Box className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No tienes apps todavia</p>
              <p className="text-sm text-muted-foreground mb-4">
                Crea tu primera app SaaS con IA
              </p>
              <Link href="/dashboard/apps/new">
                <Button>Crear mi primera app</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentApps.map((app) => (
                <Link
                  key={app.id}
                  href={`/dashboard/apps/${app.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{app.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {app.blueprintId} | {app.status.toLowerCase()}
                    </p>
                  </div>
                  <StatusIcon status={app.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "DEPLOYED":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "GENERATED":
      return <CheckCircle className="h-5 w-5 text-blue-500" />;
    case "GENERATING":
      return <Zap className="h-5 w-5 text-yellow-500 animate-pulse" />;
    case "ERROR":
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Box className="h-5 w-5 text-gray-400" />;
  }
}
