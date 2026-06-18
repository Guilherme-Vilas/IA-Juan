"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  Settings,
  Inbox,
  Send,
  Server,
  BookOpen,
  Sparkles,
  Library,
  Users,
  Ticket,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/ui/logo";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; superadmin?: boolean };
type NavGroup = { label?: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    items: [{ href: "/leads", label: "Visão geral", icon: LayoutDashboard }],
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
    label: "Inteligência",
    items: [
      { href: "/personalization", label: "Personalização da IA", icon: Sparkles },
      { href: "/knowledge", label: "Base de conhecimento", icon: Library },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { href: "/tenants", label: "Instâncias", icon: Server, superadmin: true },
      { href: "/users", label: "Usuários", icon: Users, superadmin: true },
      { href: "/invites", label: "Convites", icon: Ticket, superadmin: true },
      { href: "/playbooks", label: "Playbooks", icon: BookOpen },
      { href: "/settings", label: "Configurações", icon: Settings },
    ],
  },
];

export function Sidebar({
  isSuperadmin = false,
  userLabel = "Usuário",
  userRole = "—",
}: {
  isSuperadmin?: boolean;
  userLabel?: string;
  userRole?: string;
}) {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-[244px] shrink-0 flex-col border-r border-line bg-canvas-deep px-3 py-5">
      {/* Marca — Vita OS */}
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <LogoMark className="h-8 w-8 border border-line" />
        <div className="leading-none">
          <div className="font-serif text-[15px] text-ink">Vita OS</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-ink-faint">
            Platform
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {groups.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.label && (
              <div className="px-2.5 pb-1 pt-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                {group.label}
              </div>
            )}
            {group.items
              .filter((it) => !it.superadmin || isSuperadmin)
              .map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                    active
                      ? "bg-canvas-surface text-ink"
                      : "text-ink-muted hover:bg-canvas-surface/60 hover:text-ink",
                  )}
                >
                  <Icon size={16} strokeWidth={1.75} className={active ? "text-ink" : "text-ink-muted"} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-2 border-t border-line pt-3">
        <div className="flex items-center gap-2.5 px-1.5">
          <div className="grid h-7 w-7 place-items-center rounded-md border border-line bg-canvas-surface text-[11px] font-semibold text-ink">
            {userLabel.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[12px] text-ink">{userLabel}</div>
            <div className="text-[10px] text-ink-faint">{userRole}</div>
          </div>
          <a
            href="/api/auth/logout"
            title="Sair"
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-canvas-surface-2 hover:text-danger"
          >
            <LogOut size={14} />
          </a>
        </div>
      </div>
    </aside>
  );
}
