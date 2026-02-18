"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Brain } from "lucide-react";
import type { DiscoveryClassification, MvsEntity, MvsRole } from "@/types/mvs";

interface StepClassificationProps {
  description: string;
  classification: DiscoveryClassification | null;
  onClassified: (
    classification: DiscoveryClassification,
    entities: MvsEntity[],
    roles: MvsRole[]
  ) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepClassification({
  description,
  classification,
  onClassified,
  onNext,
  onBack,
}: StepClassificationProps) {
  const [loading, setLoading] = useState(!classification);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (classification) return;

    async function classify() {
      setLoading(true);
      setError(null);
      try {
        // Classify intent via AI
        const classRes = await fetch("/api/v1/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description }),
        });

        if (!classRes.ok) throw new Error("Classification failed");
        const classData: DiscoveryClassification = await classRes.json();

        // Fetch blueprint defaults
        const bpRes = await fetch(`/api/v1/blueprints?id=${classData.suggested_blueprint}`);
        const bpData = bpRes.ok ? await bpRes.json() : null;

        const defaultEntities: MvsEntity[] = bpData?.entityDefaults || [];
        const defaultRoles: MvsRole[] = (bpData?.default_roles || ["admin", "member"]).map(
          (r: string) => ({
            name: r,
            display_name: r.charAt(0).toUpperCase() + r.slice(1).replace(/_/g, " "),
          })
        );

        onClassified(classData, defaultEntities, defaultRoles);
      } catch (err) {
        setError("No se pudo clasificar. Intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    }

    classify();
  }, [description, classification, onClassified]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Brain className="h-12 w-12 text-primary mb-4 animate-pulse" />
          <Loader2 className="h-6 w-6 animate-spin text-primary mb-3" />
          <p className="text-muted-foreground">Analizando tu descripcion con IA...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button variant="outline" onClick={onBack}>Volver e intentar de nuevo</Button>
        </CardContent>
      </Card>
    );
  }

  if (!classification) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Entendimos tu idea
        </CardTitle>
        <CardDescription>
          Nuestra IA clasifico tu solicitud. Confirma o ajusta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tipo de App</span>
            <Badge>{classification.suggested_blueprint.toUpperCase()}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Industria</span>
            <Badge variant="outline">{classification.industry}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Confianza</span>
            <span className="text-sm">
              {Math.round(classification.confidence * 100)}%
            </span>
          </div>
        </div>

        {classification.detected_entities.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Entidades detectadas:</p>
            <div className="flex flex-wrap gap-1">
              {classification.detected_entities.map((e) => (
                <Badge key={e} variant="secondary">{e}</Badge>
              ))}
            </div>
          </div>
        )}

        {classification.detected_features.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Features detectadas:</p>
            <div className="flex flex-wrap gap-1">
              {classification.detected_features.map((f) => (
                <Badge key={f} variant="outline">{f}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onBack}>Atras</Button>
        <Button onClick={onNext}>Confirmar y continuar</Button>
      </CardFooter>
    </Card>
  );
}
