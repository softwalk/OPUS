import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enqueueGeneration } from "@/lib/queue";
import { z } from "zod";

const generateSchema = z.object({
  appId: z.string().uuid(),
});

// POST /api/v1/generate - Start generation pipeline
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { appId } = generateSchema.parse(body);

    // Verify app belongs to user's org
    const app = await prisma.app.findFirst({
      where: { id: appId, orgId: session.user.orgId },
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    if (app.status === "GENERATING") {
      return NextResponse.json({ error: "App is already being generated" }, { status: 409 });
    }

    // Create generation record
    const generation = await prisma.generation.create({
      data: {
        appId: app.id,
        mvsSnapshot: app.mvs as any,
        status: "PENDING",
      },
    });

    // Update app status
    await prisma.app.update({
      where: { id: appId },
      data: { status: "GENERATING" },
    });

    // Enqueue generation job
    await enqueueGeneration({
      generationId: generation.id,
      appId: app.id,
      orgId: session.user.orgId,
      mvs: app.mvs as Record<string, unknown>,
      blueprintId: app.blueprintId,
      industryOverlay: app.industryOverlay || undefined,
    });

    return NextResponse.json({
      generationId: generation.id,
      status: "PENDING",
    }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    console.error("Generate error:", error);
    return NextResponse.json({ error: "Failed to start generation" }, { status: 500 });
  }
}
