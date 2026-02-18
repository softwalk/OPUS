"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Box,
  PlusCircle,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Mis Apps", href: "/dashboard/apps", icon: Box },
  { name: "Nueva App", href: "/dashboard/apps/new", icon: PlusCircle },
  { name: "Configuracion", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-gray-50/50">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Box className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">SaaS Factory</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <form action="/api/auth/signout" method="POST">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </Button>
        </form>
      </div>
    </div>
  );
}
