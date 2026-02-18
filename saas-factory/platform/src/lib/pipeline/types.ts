import type { MVS } from "@/types/mvs";
import type { PRD } from "@/types/prd";
import type { GeneratedFile, PipelineStage, StageResult } from "@/types/generation";

export interface PipelineContext {
  generationId: string;
  appId: string;
  orgId: string;
  mvs: MVS;
  blueprintId: string;
  industryOverlay?: string;

  // Populated during pipeline execution
  prd?: PRD;
  designDoc?: Record<string, unknown>;
  files?: GeneratedFile[];
  reviewResult?: {
    passed: boolean;
    score: number;
    issues: Array<{ severity: string; file: string; message: string }>;
  };
  deployUrl?: string;
  deployPort?: number;
  containerId?: string;

  // Tracking
  stageResults: StageResult[];
  startedAt: Date;
  totalTokensUsed: number;
  totalCostUsd: number;
}

export interface StageHandler {
  name: PipelineStage;
  execute(ctx: PipelineContext): Promise<PipelineContext>;
}

export type PipelineEventType =
  | "stage_start"
  | "stage_complete"
  | "stage_failed"
  | "pipeline_complete"
  | "pipeline_failed";

export interface PipelineEvent {
  type: PipelineEventType;
  generationId: string;
  stage?: PipelineStage;
  stageIndex?: number;
  totalStages?: number;
  result?: StageResult;
  error?: string;
  timestamp: Date;
}

export type PipelineEventListener = (event: PipelineEvent) => void;
