"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Calendar, BarChart3, Settings, Inbox, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/prospect", label: "Prospecção", icon: Send },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/metrics", label: "Métricas", icon: BarChart3 },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/settings", label: "Config", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-brand-700 text-white">
      <div className="flex h-14 items-center gap-2 border-b border-brand-800 px-4">
        <div className="grid h-7 w-7 place-items-center rounded bg-white/15 font-bold">S</div>
        <span className="text-sm font-semibold">Stella CRM</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10",
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-brand-800 px-4 py-3 text-xs text-white/60">
        Juan Monteiro · Consórcio
      </div>
    </aside>
  );
}
