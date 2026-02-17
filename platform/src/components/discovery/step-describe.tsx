"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface StepDescribeProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
}

export function StepDescribe({ value, onChange, onNext }: StepDescribeProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Que quieres construir?
        </CardTitle>
        <CardDescription>
          Describe tu aplicacion en tus propias palabras. Nuestra IA se encargara de inferir el resto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Ejemplo: Necesito un CRM para gestionar clientes y el pipeline de ventas de mi agencia de marketing..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          className="text-base"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "CRM para ventas",
            "Sistema de citas medicas",
            "Gestion de inventario",
            "Plataforma de cursos online",
            "Sistema de tickets de soporte",
          ].map((example) => (
            <button
              key={example}
              onClick={() => onChange(example)}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-gray-100 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={onNext} disabled={value.length < 10}>
          Continuar
        </Button>
      </CardFooter>
    </Card>
  );
}
