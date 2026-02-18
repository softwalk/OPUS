"use client";

import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {session?.user?.email}
        </span>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">
            {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
