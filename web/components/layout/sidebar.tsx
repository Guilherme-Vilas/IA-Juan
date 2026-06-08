"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Calendar,
  BarChart3,
  Settings,
  Inbox,
  Send,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Users };
type NavGroup = { label?: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    items: [{ href: "/leads", label: "Leads", icon: LayoutDashboard }],
  },
  {
    label: "Operação",
    items: [
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/agenda", label: "Agenda", icon: Calendar },
      { href: "/prospect", label: "Prospecção", icon: Send },
    ],
  },
  {
    label: "Análise",
    items: [{ href: "/metrics", label: "Métricas", icon: BarChart3 }],
  },
  {
    label: "Sistema",
    items: [{ href: "/settings", label: "Config", icon: Settings }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="flex h-full w-[248px] shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-canvas-surface to-[#100b18] px-3.5 py-5 text-ink"
      style={{ borderRight: "1px solid #2a2235" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary-gradient text-sm font-bold text-white">
          S
        </div>
        <span className="text-base font-bold tracking-tight text-ink">Stella</span>
        <span className="ml-1 rounded-md bg-brand-600/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-400">
          SaaS
        </span>
      </div>

      {/* Nav groups */}
      <nav className="flex flex-1 flex-col gap-1">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div className="px-3 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-ink-faint">
                {group.label}
              </div>
            )}
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "mx-0 flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-nav-active text-white shadow-glow"
                      : "text-ink-muted hover:bg-canvas-surface-2 hover:text-ink",
                  )}
                >
                  <Icon size={17} className={active ? "opacity-100" : "opacity-80"} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-3 border-t border-line pt-3.5">
        <div className="flex items-center gap-2.5 rounded-[10px] bg-canvas-surface-2 px-2.5 py-2">
          <div className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-primary-gradient text-sm font-bold text-canvas">
            J
          </div>
          <div className="min-w-0 flex-1 overflow-hidden leading-tight">
            <div className="truncate text-[13px] font-semibold text-ink">Juan Monteiro</div>
            <div className="text-[11px] text-ink-muted">Admin</div>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-ink-faint">powered by stella.ai</div>
      </div>
    </aside>
  );
}
