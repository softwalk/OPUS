import type { StageHandler } from "../types";
import { generatePRD } from "@/lib/ai/architect-agent";

export const generatePrdStage: StageHandler = {
  name: "generate_prd",
  async execute(ctx) {
    const prd = await generatePRD(ctx.mvs);

    // Validate PRD has required sections
    if (!prd.database_schema) throw new Error("PRD missing database_schema");
    if (!prd.api_routes || prd.api_routes.length === 0) throw new Error("PRD missing api_routes");
    if (!prd.permissions_matrix) throw new Error("PRD missing permissions_matrix");
    if (!prd.ui_pages || prd.ui_pages.length === 0) throw new Error("PRD missing ui_pages");

    ctx.prd = prd;
    return ctx;
  },
};
