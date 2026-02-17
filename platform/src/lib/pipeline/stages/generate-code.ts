import type { StageHandler } from "../types";
import { generateAllCode } from "@/lib/ai/codegen-agent";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";

export const generateCodeStage: StageHandler = {
  name: "generate_code",
  async execute(ctx) {
    if (!ctx.prd) throw new Error("PRD not available - run generate_prd first");

    const files = await generateAllCode(ctx.prd);

    // Write files to disk
    const outputDir = join(
      process.env.GENERATED_APPS_PATH || "./generated",
      ctx.appId,
      String(Date.now())
    );

    for (const file of files) {
      const filePath = join(outputDir, file.path);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, file.content, "utf-8");
    }

    ctx.files = files;
    return ctx;
  },
};
