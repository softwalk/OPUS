export type PipelineStage =
  | "validate_mvs"
  | "generate_prd"
  | "generate_design"
  | "generate_code"
  | "validate_code"
  | "deploy"
  | "configure_billing";

export interface StageResult {
  stage: PipelineStage;
  status: "completed" | "failed" | "retrying" | "skipped";
  durationSeconds: number;
  tokensUsed: number;
  outputSummary: string;
  error?: string;
}

export interface GenerationProgress {
  generationId: string;
  appId: string;
  currentStage: PipelineStage;
  stageIndex: number;
  totalStages: number;
  stageResults: StageResult[];
  status: "running" | "completed" | "failed";
  startedAt: string;
  estimatedRemainingSeconds?: number;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface CodeGenOutput {
  files: GeneratedFile[];
  module: string;
}
