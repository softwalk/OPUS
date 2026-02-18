import type { PipelineContext, StageHandler, PipelineEventListener, PipelineEvent } from "./types";
import type { PipelineStage, StageResult } from "@/types/generation";
import { validateMvsStage } from "./stages/validate-mvs";
import { generatePrdStage } from "./stages/generate-prd";
import { generateCodeStage } from "./stages/generate-code";
import { validateCodeStage } from "./stages/validate-code";
import { deployStage } from "./stages/deploy";
import { prisma } from "../db";

const STAGES: StageHandler[] = [
  validateMvsStage,
  generatePrdStage,
  generateCodeStage,
  validateCodeStage,
  deployStage,
];

const MAX_RETRIES = 3;

export class PipelineRunner {
  private listeners: PipelineEventListener[] = [];

  onEvent(listener: PipelineEventListener): void {
    this.listeners.push(listener);
  }

  private emit(event: PipelineEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("Pipeline event listener error:", err);
      }
    }
  }

  async run(ctx: PipelineContext): Promise<PipelineContext> {
    // Update generation status to running
    await prisma.generation.update({
      where: { id: ctx.generationId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        stage: STAGES[0].name,
      },
    });

    await prisma.app.update({
      where: { id: ctx.appId },
      data: { status: "GENERATING" },
    });

    for (let i = 0; i < STAGES.length; i++) {
      const stage = STAGES[i];
      const stageStart = Date.now();

      this.emit({
        type: "stage_start",
        generationId: ctx.generationId,
        stage: stage.name,
        stageIndex: i,
        totalStages: STAGES.length,
        timestamp: new Date(),
      });

      // Update current stage in DB
      await prisma.generation.update({
        where: { id: ctx.generationId },
        data: { stage: stage.name },
      });

      let lastError: Error | undefined;
      let stageResult: StageResult | undefined;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          ctx = await stage.execute(ctx);

          const durationSeconds = Math.round((Date.now() - stageStart) / 1000);
          stageResult = {
            stage: stage.name,
            status: "completed",
            durationSeconds,
            tokensUsed: 0,
            outputSummary: `Stage ${stage.name} completed successfully`,
          };

          ctx.stageResults.push(stageResult);

          this.emit({
            type: "stage_complete",
            generationId: ctx.generationId,
            stage: stage.name,
            stageIndex: i,
            totalStages: STAGES.length,
            result: stageResult,
            timestamp: new Date(),
          });

          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.error(`Stage ${stage.name} failed (attempt ${attempt + 1}/${MAX_RETRIES}):`, lastError.message);

          if (attempt < MAX_RETRIES - 1) {
            this.emit({
              type: "stage_failed",
              generationId: ctx.generationId,
              stage: stage.name,
              stageIndex: i,
              totalStages: STAGES.length,
              error: `Retrying (attempt ${attempt + 2}/${MAX_RETRIES}): ${lastError.message}`,
              timestamp: new Date(),
            });
          }
        }
      }

      if (!stageResult) {
        // All retries failed
        const durationSeconds = Math.round((Date.now() - stageStart) / 1000);
        stageResult = {
          stage: stage.name,
          status: "failed",
          durationSeconds,
          tokensUsed: 0,
          outputSummary: lastError?.message || "Unknown error",
          error: lastError?.message,
        };
        ctx.stageResults.push(stageResult);

        // Update generation as failed
        await prisma.generation.update({
          where: { id: ctx.generationId },
          data: {
            status: "FAILED",
            errorMessage: lastError?.message,
            completedAt: new Date(),
            durationSeconds: Math.round((Date.now() - ctx.startedAt.getTime()) / 1000),
            logs: ctx.stageResults as unknown as any,
          },
        });

        await prisma.app.update({
          where: { id: ctx.appId },
          data: { status: "ERROR" },
        });

        this.emit({
          type: "pipeline_failed",
          generationId: ctx.generationId,
          stage: stage.name,
          error: lastError?.message,
          timestamp: new Date(),
        });

        return ctx;
      }
    }

    // Pipeline completed successfully
    const totalDuration = Math.round((Date.now() - ctx.startedAt.getTime()) / 1000);

    await prisma.generation.update({
      where: { id: ctx.generationId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        durationSeconds: totalDuration,
        logs: ctx.stageResults as unknown as any,
      },
    });

    const appUpdate: Record<string, unknown> = {
      status: ctx.deployUrl ? "DEPLOYED" : "GENERATED",
      prd: ctx.prd as unknown as any,
    };
    if (ctx.deployUrl) appUpdate.deployUrl = ctx.deployUrl;
    if (ctx.deployPort) appUpdate.deployPort = ctx.deployPort;
    if (ctx.containerId) appUpdate.containerId = ctx.containerId;

    await prisma.app.update({
      where: { id: ctx.appId },
      data: appUpdate,
    });

    this.emit({
      type: "pipeline_complete",
      generationId: ctx.generationId,
      timestamp: new Date(),
    });

    return ctx;
  }
}

export const pipelineRunner = new PipelineRunner();
