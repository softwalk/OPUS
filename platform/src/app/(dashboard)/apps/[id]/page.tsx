import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/apps/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Zap, Clock, DollarSign, FileCode } from "lucide-react";
import Link from "next/link";
import { AppActions } from "./app-actions";

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const { id } = await params;

  const app = await prisma.app.findFirst({
    where: { id, orgId: session.user.orgId },
    include: {
      generations: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!app) notFound();

  const mvs = app.mvs as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/apps">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{app.name}</h1>
            <StatusBadge status={app.status} />
          </div>
          <p className="text-muted-foreground">
            {app.blueprintId} | Creado {formatDate(app.createdAt)}
          </p>
        </div>
        <AppActions appId={app.id} status={app.status} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileCode className="h-4 w-4" /> Blueprint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">{app.blueprintId}</p>
            {app.industryOverlay && (
              <Badge variant="outline" className="mt-1">{app.industryOverlay}</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" /> Generaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{app.generations.length}</p>
            <p className="text-xs text-muted-foreground">Version {app.version}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ExternalLink className="h-4 w-4" /> Deploy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {app.deployUrl ? (
              <a
                href={app.deployUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-blue-600 hover:underline"
              >
                {app.deployUrl}
              </a>
            ) : (
              <p className="text-muted-foreground text-sm">No desplegado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MVS Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Especificacion (MVS)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium text-sm mb-2">Descripcion</h4>
              <p className="text-sm text-muted-foreground">
                {(mvs.description as string) || "Sin descripcion"}
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2">Entidades</h4>
              <div className="flex flex-wrap gap-1">
                {((mvs.entities as Array<{ name: string }>) || []).map((e) => (
                  <Badge key={e.name} variant="secondary">{e.name}</Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2">Roles</h4>
              <div className="flex flex-wrap gap-1">
                {((mvs.roles as Array<{ display_name: string }>) || []).map((r) => (
                  <Badge key={r.display_name} variant="outline">{r.display_name}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generations History */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Generaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {app.generations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay generaciones todavia
            </p>
          ) : (
            <div className="space-y-3">
              {app.generations.map((gen) => (
                <div key={gen.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={gen.status} />
                      {gen.stage && (
                        <span className="text-xs text-muted-foreground">
                          Etapa: {gen.stage}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(gen.createdAt)}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {gen.durationSeconds && <p>{gen.durationSeconds}s</p>}
                    {gen.errorMessage && (
                      <p className="text-red-500 max-w-xs truncate">{gen.errorMessage}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
