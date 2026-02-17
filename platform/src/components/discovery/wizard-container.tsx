"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepDescribe } from "./step-describe";
import { StepClassification } from "./step-classification";
import { StepName } from "./step-name";
import { StepEntities } from "./step-entities";
import { StepRoles } from "./step-roles";
import { StepPreview } from "./step-preview";
import { Progress } from "@/components/ui/progress";
import type { BlueprintType, IndustryType, MvsEntity, MvsRole, DiscoveryClassification } from "@/types/mvs";

export interface WizardState {
  description: string;
  classification: DiscoveryClassification | null;
  appName: string;
  blueprint: BlueprintType;
  industry: IndustryType;
  entities: MvsEntity[];
  roles: MvsRole[];
}

const STEPS = [
  "Descripcion",
  "Clasificacion",
  "Nombre",
  "Entidades",
  "Roles",
  "Confirmacion",
];

export function WizardContainer() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    description: "",
    classification: null,
    appName: "",
    blueprint: "custom",
    industry: "general",
    entities: [],
    roles: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progress = ((step + 1) / STEPS.length) * 100;

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function updateState(partial: Partial<WizardState>) {
    setState((s) => ({ ...s, ...partial }));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      // Build the MVS
      const mvs = {
        app_name: state.appName,
        blueprint: state.blueprint,
        industry: state.industry,
        description: state.description,
        entities: state.entities,
        roles: state.roles,
      };

      // Create the app
      const res = await fetch("/api/v1/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mvs }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al crear la app");
        setIsSubmitting(false);
        return;
      }

      const app = await res.json();

      // Start generation
      const genRes = await fetch("/api/v1/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: app.id }),
      });

      if (!genRes.ok) {
        // App created but generation failed - still redirect
        router.push(`/dashboard/apps/${app.id}`);
        return;
      }

      router.push(`/dashboard/apps/${app.id}`);
    } catch {
      alert("Error de conexion");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Paso {step + 1} de {STEPS.length}</span>
          <span>{STEPS[step]}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Steps */}
      {step === 0 && (
        <StepDescribe
          value={state.description}
          onChange={(description) => updateState({ description })}
          onNext={next}
        />
      )}
      {step === 1 && (
        <StepClassification
          description={state.description}
          classification={state.classification}
          onClassified={(classification, entities, roles) =>
            updateState({
              classification,
              blueprint: classification.suggested_blueprint,
              industry: classification.industry,
              entities,
              roles,
            })
          }
          onNext={next}
          onBack={back}
        />
      )}
      {step === 2 && (
        <StepName
          value={state.appName}
          onChange={(appName) => updateState({ appName })}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 3 && (
        <StepEntities
          entities={state.entities}
          blueprint={state.blueprint}
          onChange={(entities) => updateState({ entities })}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 4 && (
        <StepRoles
          roles={state.roles}
          onChange={(roles) => updateState({ roles })}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 5 && (
        <StepPreview
          state={state}
          onSubmit={handleSubmit}
          onBack={back}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
