"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, Loader2 } from "lucide-react";
import type { WizardState } from "./wizard-container";

interface StepPreviewProps {
  state: WizardState;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function StepPreview({ state, onSubmit, onBack, isSubmitting }: StepPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          Listo para generar!
        </CardTitle>
        <CardDescription>
          Revisa tu especificacion antes de generar la aplicacion.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Nombre</span>
            <span className="font-semibold">{state.appName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Blueprint</span>
            <Badge>{state.blueprint.toUpperCase()}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Industria</span>
            <Badge variant="outline">{state.industry}</Badge>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Descripcion</p>
          <p className="text-sm text-muted-foreground bg-gray-50 rounded-lg p-3">
            {state.description}
          </p>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">
            Entidades ({state.entities.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {state.entities.map((e) => (
              <Badge key={e.name} variant="secondary">
                {e.display_name} ({e.fields.length} campos)
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">
            Roles ({state.roles.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {state.roles.map((r) => (
              <Badge key={r.name} variant="outline">{r.display_name}</Badge>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
          <p className="font-medium mb-1">Que se va a generar:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Base de datos PostgreSQL con esquema completo</li>
            <li>API REST con CRUD para cada entidad</li>
            <li>Frontend con listados, formularios y detalle</li>
            <li>Autenticacion y control de acceso por rol</li>
            <li>Multi-tenancy con aislamiento de datos</li>
            <li>Dockerfile para deploy</li>
          </ul>
          <p className="mt-2 text-xs">Tiempo estimado: 5-10 minutos</p>
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          Atras
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting} size="lg">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando y generando...
            </>
          ) : (
            <>
              <Rocket className="mr-2 h-4 w-4" />
              Generar mi App
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
