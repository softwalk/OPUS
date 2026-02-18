"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GenerationProgress } from "@/components/apps/generation-progress";
import { Zap, Trash2 } from "lucide-react";

interface AppActionsProps {
  appId: string;
  status: string;
}

export function AppActions({ appId, status }: AppActionsProps) {
  const router = useRouter();
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al iniciar generacion");
        return;
      }

      const data = await res.json();
      setGenerationId(data.generationId);
    } catch {
      alert("Error de conexion");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Seguro que quieres archivar esta app?")) return;

    await fetch(`/api/v1/apps/${appId}`, { method: "DELETE" });
    router.push("/dashboard/apps");
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          onClick={handleGenerate}
          disabled={loading || status === "GENERATING"}
        >
          <Zap className="mr-2 h-4 w-4" />
          {status === "GENERATING" ? "Generando..." : "Generar / Re-generar"}
        </Button>
        <Button variant="outline" onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Archivar
        </Button>
      </div>

      {generationId && (
        <GenerationProgress
          generationId={generationId}
          onComplete={() => router.refresh()}
        />
      )}
    </div>
  );
}
