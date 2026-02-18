"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface StepNameProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepName({ value, onChange, onNext, onBack }: StepNameProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Como se llamara tu app?</CardTitle>
        <CardDescription>
          Elige un nombre para tu aplicacion. Podras cambiarlo despues.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="appName">Nombre de la aplicacion</Label>
          <Input
            id="appName"
            placeholder="Mi CRM, ClinicApp, EduPro..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-lg"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Minimo 2 caracteres, maximo 50. Solo letras, numeros, espacios y guiones.
          </p>
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onBack}>Atras</Button>
        <Button onClick={onNext} disabled={value.length < 2}>Continuar</Button>
      </CardFooter>
    </Card>
  );
}
