import { NextResponse } from "next/server";
import { getBlueprints, getBlueprintById, getBlueprintEntitiesWithDefaults } from "@/lib/blueprints/registry";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const blueprint = getBlueprintById(id as any);
    if (!blueprint) {
      return NextResponse.json({ error: "Blueprint not found" }, { status: 404 });
    }

    const entities = getBlueprintEntitiesWithDefaults(id as any);
    return NextResponse.json({ ...blueprint, entityDefaults: entities });
  }

  const blueprints = getBlueprints();
  return NextResponse.json(blueprints);
}
