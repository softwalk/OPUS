import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { slugify } from "@/lib/utils";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  orgName: z.string().min(2).max(100),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, orgName } = registerSchema.parse(body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const orgSlug = slugify(orgName);

    // Create org and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug: orgSlug + "-" + Date.now().toString(36),
          plan: "FREE",
        },
      });

      const user = await tx.user.create({
        data: {
          orgId: org.id,
          email,
          name,
          role: "OWNER",
          passwordHash,
        },
      });

      return { org, user };
    });

    return NextResponse.json(
      { message: "Account created successfully", userId: result.user.id },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    console.error("Register error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
