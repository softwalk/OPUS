"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import type { MvsRole } from "@/types/mvs";

interface StepRolesProps {
  roles: MvsRole[];
  onChange: (roles: MvsRole[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepRoles({ roles, onChange, onNext, onBack }: StepRolesProps) {
  const [newRole, setNewRole] = useState("");

  function addRole() {
    if (!newRole.trim()) return;
    const name = newRole.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z_]/g, "");
    if (roles.find((r) => r.name === name)) return;

    onChange([
      ...roles,
      {
        name,
        display_name: newRole.trim().charAt(0).toUpperCase() + newRole.trim().slice(1),
      },
    ]);
    setNewRole("");
  }

  function removeRole(name: string) {
    onChange(roles.filter((r) => r.name !== name));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipos de usuario</CardTitle>
        <CardDescription>
          Define los roles que tendra tu aplicacion. Cada rol tendra permisos diferentes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {roles.map((role) => (
          <div key={role.name} className="flex items-center gap-3 rounded-lg border p-3">
            <Checkbox checked={true} onCheckedChange={() => removeRole(role.name)} />
            <div className="flex-1">
              <span className="font-medium">{role.display_name}</span>
              <span className="text-xs text-muted-foreground ml-2">({role.name})</span>
            </div>
            {role.name !== "admin" && (
              <Button variant="ghost" size="icon" onClick={() => removeRole(role.name)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <Input
            placeholder="Nombre del nuevo rol..."
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRole()}
          />
          <Button variant="outline" onClick={addRole} disabled={!newRole.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onBack}>Atras</Button>
        <Button onClick={onNext} disabled={roles.length === 0}>
          Continuar ({roles.length} roles)
        </Button>
      </CardFooter>
    </Card>
  );
}
