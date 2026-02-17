import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { classifyIntent } from "@/lib/ai/discovery-agent";
import { z } from "zod";

const classifySchema = z.object({
  description: z.string().min(5).max(1000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { description } = classifySchema.parse(body);

    const classification = await classifyIntent(description);

    return NextResponse.json(classification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    console.error("Discovery classification error:", error);
    return NextResponse.json({ error: "Classification failed" }, { status: 500 });
  }
}
