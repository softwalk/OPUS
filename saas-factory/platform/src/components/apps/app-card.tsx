"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./status-badge";
import { Box, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AppCardProps {
  id: string;
  name: string;
  blueprintId: string;
  status: string;
  deployUrl?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export function AppCard({ id, name, blueprintId, status, deployUrl, createdAt, updatedAt }: AppCardProps) {
  return (
    <Link href={`/dashboard/apps/${id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Box className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <p className="text-xs text-muted-foreground capitalize">{blueprintId}</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Actualizado {formatDate(new Date(updatedAt))}</span>
            {deployUrl && (
              <span className="flex items-center gap-1 text-green-600">
                <ExternalLink className="h-3 w-3" />
                En linea
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
