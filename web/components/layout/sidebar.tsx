"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  KanbanSquare,
  Calendar,
  BarChart3,
  Settings,
  Inbox,
  Send,
  Server,
  Building2,
  BookOpen,
  Sparkles,
  Zap,
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
    items: [{ href: "/leads", label: "Pipeline", icon: KanbanSquare }],
  },
  {
    label: "Operação",
    items: [
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/agenda", label: "Agenda", icon: Calendar },
      { href: "/properties", label: "Imóveis", icon: Building2 },
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
      { href: "/automations", label: "Automações", icon: Zap },
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
    <aside className="relative flex h-full w-[248px] shrink-0 flex-col border-r border-line/80 bg-canvas-deep/70 px-3 py-5 backdrop-blur-2xl">
      {/* véu bronze no topo — a marca irradia */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-bronze-veil"
      />

      {/* Marca — Vita OS */}
      <div className="relative flex items-center gap-2.5 px-2 pb-6">
        <LogoMark className="brand-halo h-9 w-9 border border-accent-bronze/30" />
        <div className="leading-none">
          <div className="font-serif text-[16px] tracking-tight text-ink">Vita OS</div>
          <div className="mt-1 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.22em] text-ink-faint">
            <span className="inline-block h-1 w-1 rounded-full bg-accent-bronze animate-pulse-soft" />
            Platform
          </div>
        </div>
      </div>

      <nav className="stagger relative flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {groups.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.label && (
              <div className="px-2.5 pb-1 pt-4 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">
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
                    "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-all duration-200",
                    active
                      ? "bg-gradient-to-r from-canvas-surface to-canvas-surface/20 text-ink"
                      : "text-ink-muted hover:translate-x-[2px] hover:bg-canvas-surface/60 hover:text-ink",
                  )}
                >
                  {/* indicador bronze incandescente da rota ativa */}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent-bronze shadow-[0_0_10px_rgba(176,141,87,0.9)]"
                    />
                  )}
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    className={cn(
                      "transition-colors duration-200",
                      active
                        ? "text-accent-bronze-soft drop-shadow-[0_0_6px_rgba(176,141,87,0.5)]"
                        : "text-ink-muted group-hover:text-ink-soft",
                    )}
                  />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="relative mt-2 pt-3">
        {/* hairline bronze separando o rodapé */}
        <div aria-hidden className="absolute inset-x-1 top-0 h-px bg-bronze-line opacity-60" />
        <div className="flex items-center gap-2.5 px-1.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-accent-bronze/30 bg-gradient-to-b from-canvas-surface-2 to-canvas-surface text-[11px] font-semibold text-accent-bronze-soft">
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
