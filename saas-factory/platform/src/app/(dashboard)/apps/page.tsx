import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppCard } from "@/components/apps/app-card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Box } from "lucide-react";
import Link from "next/link";

export default async function AppsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const apps = await prisma.app.findMany({
    where: { orgId: session.user.orgId, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Apps</h1>
          <p className="text-muted-foreground">
            {apps.length} {apps.length === 1 ? "aplicacion" : "aplicaciones"}
          </p>
        </div>
        <Link href="/dashboard/apps/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva App
          </Button>
        </Link>
      </div>

      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-center">
          <Box className="mb-4 h-16 w-16 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold mb-2">No tienes apps todavia</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Describe lo que quieres construir y nuestra IA generara una aplicacion SaaS completa en minutos.
          </p>
          <Link href="/dashboard/apps/new">
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" />
              Crear mi primera app
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <AppCard
              key={app.id}
              id={app.id}
              name={app.name}
              blueprintId={app.blueprintId}
              status={app.status}
              deployUrl={app.deployUrl}
              createdAt={app.createdAt}
              updatedAt={app.updatedAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
