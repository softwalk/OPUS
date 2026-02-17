import type { StageHandler } from "../types";
import { reviewCode } from "@/lib/ai/reviewer-agent";

export const validateCodeStage: StageHandler = {
  name: "validate_code",
  async execute(ctx) {
    if (!ctx.prd) throw new Error("PRD not available");
    if (!ctx.files || ctx.files.length === 0) throw new Error("No generated files to validate");

    const result = await reviewCode(ctx.prd, ctx.files);

    ctx.reviewResult = {
      passed: result.passed,
      score: result.score,
      issues: result.issues,
    };

    if (!result.passed) {
      const errorCount = result.issues.filter((i) => i.severity === "error").length;
      throw new Error(
        `Code review failed (score: ${result.score}/100, ${errorCount} errors): ${result.summary}`
      );
    }

    return ctx;
  },
};
