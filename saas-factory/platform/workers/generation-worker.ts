import { createGenerationWorker, type GenerationJobData } from "../src/lib/queue";
import { PipelineRunner } from "../src/lib/pipeline/runner";
import type { PipelineContext } from "../src/lib/pipeline/types";
import type { MVS } from "../src/types/mvs";
import type { Job } from "bullmq";

console.log("Starting generation worker...");

const worker = createGenerationWorker(async (job: Job<GenerationJobData>) => {
  console.log(`Processing generation job ${job.id} for app ${job.data.appId}`);

  const ctx: PipelineContext = {
    generationId: job.data.generationId,
    appId: job.data.appId,
    orgId: job.data.orgId,
    mvs: job.data.mvs as unknown as MVS,
    blueprintId: job.data.blueprintId,
    industryOverlay: job.data.industryOverlay,
    stageResults: [],
    startedAt: new Date(),
    totalTokensUsed: 0,
    totalCostUsd: 0,
  };

  const runner = new PipelineRunner();

  runner.onEvent((event) => {
    console.log(`[${event.type}] Stage: ${event.stage || "N/A"} | ${event.error || ""}`);
    // Update job progress
    if (event.stageIndex !== undefined && event.totalStages) {
      const progress = Math.round(((event.stageIndex + 1) / event.totalStages) * 100);
      job.updateProgress(progress);
    }
  });

  await runner.run(ctx);
  console.log(`Generation ${job.data.generationId} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
});
