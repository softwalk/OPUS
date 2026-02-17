import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { mvsSchema } from "@/lib/mvs/schema";

const createAppSchema = z.object({
  mvs: mvsSchema,
});

// GET /api/v1/apps - List apps for current org
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apps = await prisma.app.findMany({
    where: { orgId: session.user.orgId },
    orderBy: { createdAt: "desc" },
    include: {
      generations: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json(apps);
}

// POST /api/v1/apps - Create a new app
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mvs } = createAppSchema.parse(body);

    const slug = slugify(mvs.app_name);

    // Check for duplicate slug
    const existing = await prisma.app.findUnique({
      where: { orgId_slug: { orgId: session.user.orgId, slug } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An app with this name already exists" },
        { status: 409 }
      );
    }

    const app = await prisma.app.create({
      data: {
        orgId: session.user.orgId,
        name: mvs.app_name,
        slug,
        blueprintId: mvs.blueprint,
        industryOverlay: mvs.industry !== "general" ? mvs.industry : null,
        mvs: mvs as any,
        status: "DRAFT",
      },
    });

    return NextResponse.json(app, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid MVS", details: error.issues }, { status: 400 });
    }
    console.error("Create app error:", error);
    return NextResponse.json({ error: "Failed to create app" }, { status: 500 });
  }
}
