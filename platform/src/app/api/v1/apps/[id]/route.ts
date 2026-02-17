import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/v1/apps/:id
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  if (!app) {
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }

  return NextResponse.json(app);
}

// PATCH /api/v1/apps/:id
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const app = await prisma.app.findFirst({
    where: { id, orgId: session.user.orgId },
  });

  if (!app) {
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }

  const updated = await prisma.app.update({
    where: { id },
    data: {
      name: body.name,
      mvs: body.mvs,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/v1/apps/:id
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const app = await prisma.app.findFirst({
    where: { id, orgId: session.user.orgId },
  });

  if (!app) {
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }

  await prisma.app.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  return NextResponse.json({ success: true });
}
