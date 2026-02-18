"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { MvsEntity, BlueprintType } from "@/types/mvs";

interface StepEntitiesProps {
  entities: MvsEntity[];
  blueprint: BlueprintType;
  onChange: (entities: MvsEntity[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepEntities({ entities, onChange, onNext, onBack }: StepEntitiesProps) {
  function toggleEntity(entityName: string) {
    const exists = entities.find((e) => e.name === entityName);
    if (exists) {
      onChange(entities.filter((e) => e.name !== entityName));
    } else {
      // Re-add with minimal fields
      onChange([
        ...entities,
        {
          name: entityName,
          display_name: entityName,
          fields: [{ name: "name", type: "string", display_name: "Nombre", required: true }],
        },
      ]);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Que entidades necesita tu app?</CardTitle>
        <CardDescription>
          Basado en tu blueprint, pre-seleccionamos las entidades mas comunes. Puedes agregar o quitar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entities.map((entity) => (
          <div key={entity.name} className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              checked={true}
              onCheckedChange={() => toggleEntity(entity.name)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{entity.display_name}</span>
                <span className="text-xs text-muted-foreground">({entity.name})</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {entity.fields.map((f) => (
                  <Badge key={f.name} variant="outline" className="text-xs">
                    {f.display_name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ))}

        {entities.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay entidades seleccionadas. El blueprint custom requiere que definas tus entidades manualmente.
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onBack}>Atras</Button>
        <Button onClick={onNext} disabled={entities.length === 0}>
          Continuar ({entities.length} entidades)
        </Button>
      </CardFooter>
    </Card>
  );
}
