import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/v1/generate/:id/status
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const generation = await prisma.generation.findFirst({
    where: { id },
    include: {
      app: {
        select: { orgId: true, name: true, status: true, deployUrl: true },
      },
    },
  });

  if (!generation || generation.app.orgId !== session.user.orgId) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: generation.id,
    appId: generation.appId,
    appName: generation.app.name,
    status: generation.status,
    stage: generation.stage,
    logs: generation.logs,
    costUsd: generation.costUsd,
    tokensUsed: generation.tokensUsed,
    durationSeconds: generation.durationSeconds,
    errorMessage: generation.errorMessage,
    deployUrl: generation.app.deployUrl,
    startedAt: generation.startedAt,
    completedAt: generation.completedAt,
  });
}
