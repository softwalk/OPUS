"use client";

import { Badge } from "@/components/ui/badge";
import type { AppStatus } from "@/generated/prisma/client";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  DRAFT: { label: "Borrador", variant: "outline" },
  GENERATING: { label: "Generando...", variant: "warning" },
  GENERATED: { label: "Generado", variant: "secondary" },
  DEPLOYING: { label: "Desplegando...", variant: "warning" },
  DEPLOYED: { label: "Desplegado", variant: "success" },
  ERROR: { label: "Error", variant: "destructive" },
  ARCHIVED: { label: "Archivado", variant: "outline" },
};

export function StatusBadge({ status }: { status: AppStatus | string }) {
  const config = STATUS_CONFIG[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
