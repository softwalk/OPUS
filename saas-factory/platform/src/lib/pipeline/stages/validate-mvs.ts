import type { StageHandler } from "../types";
import { validateMvs } from "@/lib/mvs/validator";
import type { MVS } from "@/types/mvs";

export const validateMvsStage: StageHandler = {
  name: "validate_mvs",
  async execute(ctx) {
    const result = validateMvs(ctx.mvs);

    if (!result.valid) {
      const errorMessages = result.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message)
        .join("; ");
      throw new Error(`MVS validation failed: ${errorMessages}`);
    }

    // Log warnings
    const warnings = result.issues.filter((i) => i.severity === "warning");
    if (warnings.length > 0) {
      console.log(`MVS validation warnings: ${warnings.map((w) => w.message).join("; ")}`);
    }

    ctx.mvs = result.mvs as MVS;
    return ctx;
  },
};
