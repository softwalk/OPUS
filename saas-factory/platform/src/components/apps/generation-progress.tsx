"use client";

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2, XCircle, Circle } from "lucide-react";

interface GenerationProgressProps {
  generationId: string;
  onComplete?: () => void;
}

interface GenerationStatus {
  id: string;
  status: string;
  stage: string | null;
  logs: Array<{ stage: string; status: string; outputSummary: string }>;
  durationSeconds: number | null;
  errorMessage: string | null;
  deployUrl: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  validate_mvs: "Validando especificacion",
  generate_prd: "Generando requisitos (PRD)",
  generate_code: "Generando codigo",
  validate_code: "Validando codigo",
  deploy: "Desplegando aplicacion",
};

const ALL_STAGES = ["validate_mvs", "generate_prd", "generate_code", "validate_code", "deploy"];

export function GenerationProgress({ generationId, onComplete }: GenerationProgressProps) {
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/generate/${generationId}/status`);
        if (!res.ok) throw new Error("Failed to fetch status");
        const data = await res.json();
        if (active) {
          setStatus(data);
          if (data.status === "COMPLETED" || data.status === "FAILED") {
            onComplete?.();
          }
        }
      } catch (err) {
        if (active) setError("Error al obtener estado");
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [generationId, onComplete]);

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-600 text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const completedStages = status.logs?.filter((l) => l.status === "completed") || [];
  const currentStageIdx = status.stage ? ALL_STAGES.indexOf(status.stage) : -1;
  const progress = status.status === "COMPLETED"
    ? 100
    : status.status === "FAILED"
      ? ((currentStageIdx) / ALL_STAGES.length) * 100
      : ((currentStageIdx + 0.5) / ALL_STAGES.length) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {status.status === "COMPLETED"
            ? "Generacion completada"
            : status.status === "FAILED"
              ? "Generacion fallida"
              : "Generando tu aplicacion..."}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progress} className="h-2" />

        <div className="space-y-2">
          {ALL_STAGES.map((stage, idx) => {
            const log = completedStages.find((l) => l.stage === stage);
            const isCurrent = status.stage === stage && status.status === "RUNNING";
            const isCompleted = !!log;
            const isFailed = status.stage === stage && status.status === "FAILED";

            return (
              <div key={stage} className="flex items-center gap-3 text-sm">
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : isFailed ? (
                  <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                )}
                <span className={isCurrent ? "font-medium text-blue-700" : isCompleted ? "text-green-700" : isFailed ? "text-red-600" : "text-muted-foreground"}>
                  {STAGE_LABELS[stage] || stage}
                </span>
              </div>
            );
          })}
        </div>

        {status.errorMessage && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 mt-2">
            {status.errorMessage}
          </div>
        )}

        {status.deployUrl && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 mt-2">
            App desplegada en:{" "}
            <a href={status.deployUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">
              {status.deployUrl}
            </a>
          </div>
        )}

        {status.durationSeconds && (
          <p className="text-xs text-muted-foreground">
            Duracion: {Math.floor(status.durationSeconds / 60)}m {status.durationSeconds % 60}s
          </p>
        )}
      </CardContent>
    </Card>
  );
}
