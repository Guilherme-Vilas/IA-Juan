import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { pool } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getLeadScope, scopeSql } from "@/lib/lead-scope";
import { CalendarDays, ChevronLeft, ChevronRight, List, Phone, Video } from "lucide-react";
import { AppointmentActions } from "./_components/appointment-actions";
import { GoogleCalendarCard } from "./_components/google-calendar-card";
import { InternalCalendarCard } from "./_components/internal-calendar-card";
import type { CalendarBlock, WorkingHour } from "@/lib/types";

export const dynamic = "force-dynamic";

type Appointment = {
  id: number;
  scheduled_at: string;
  ends_at: string;
  calendar_provider: "internal" | "google";
  meeting_channel: "ligacao" | "video" | null;
  status: string;
  wa_id: string;
  nome: string | null;
  slots: { valor_bem?: number; interesse?: string };
};

const STATUS_UI: Record<string, { label: string; cls: string; dot: string }> = {
  scheduled: { label: "Agendada", cls: "bg-info/15 text-info", dot: "#60A5FA" },
  confirmed: { label: "Confirmada", cls: "bg-success/15 text-success", dot: "#4ADE80" },
  completed: { label: "Realizada", cls: "bg-success/20 text-success", dot: "#4ADE80" },
  no_show: { label: "Não compareceu", cls: "bg-warning/15 text-warning", dot: "#FBBF24" },
  cancelled: { label: "Cancelada", cls: "bg-danger/15 text-danger", dot: "#F87171" },
};
const PROVIDER_LABEL: Record<string, string> = { internal: "Agenda interna", google: "Google Calendar" };
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Dia local do tenant em YYYY-MM-DD (chave de agrupamento da grade).
function dayKey(iso: string | Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function fmtTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

// Segunda-feira da semana atual (no fuso do tenant) + deslocamento em semanas.
function weekStart(timezone: string, offsetWeeks: number): Date {
  const now = new Date();
  const todayKey = dayKey(now, timezone);
  const todayUtcMidnight = new Date(`${todayKey}T00:00:00Z`);
  const dow = (todayUtcMidnight.getUTCDay() + 6) % 7; // 0 = segunda
  todayUtcMidnight.setUTCDate(todayUtcMidnight.getUTCDate() - dow + offsetWeeks * 7);
  return todayUtcMidnight; // meia-noite UTC do dia-chave; usamos só como gerador de chaves
}

const APPOINTMENT_SELECT = `SELECT a.id, a.scheduled_at, a.ends_at, a.calendar_provider, a.meeting_channel, a.status,
       l.wa_id, l.nome, l.slots
  FROM appointments a
  JOIN leads l ON l.id = a.lead_id`;

// Semana: busca a janela da grade (com 1 dia de folga pra diferença de fuso).
// Lista: últimos 14 dias em diante, como antes. Ambas respeitam o escopo do papel.
async function getAppointments(tenantId: number, weekStartKey: string | null): Promise<Appointment[]> {
  const scope = await getLeadScope(tenantId);
  if (weekStartKey) {
    const sc = scopeSql(scope, "l", 3);
    const { rows } = await pool.query<Appointment>(
      `${APPOINTMENT_SELECT}
        WHERE a.tenant_id = $1
          AND a.scheduled_at >= $2::date - interval '1 day'
          AND a.scheduled_at < $2::date + interval '8 days'${sc.sql}
        ORDER BY a.scheduled_at ASC`,
      [tenantId, weekStartKey, ...sc.params],
    );
    return rows;
  }
  const sc = scopeSql(scope, "l", 2);
  const { rows } = await pool.query<Appointment>(
    `${APPOINTMENT_SELECT}
      WHERE a.tenant_id = $1
        AND a.scheduled_at > now() - interval '14 days'${sc.sql}
      ORDER BY a.scheduled_at ASC`,
    [tenantId, ...sc.params],
  );
  return rows;
}

async function getTimezone(tenantId: number): Promise<string> {
  const { rows } = await pool.query<{ timezone: string }>(`SELECT timezone FROM tenants WHERE id = $1`, [tenantId]);
  return rows[0]?.timezone || "America/Sao_Paulo";
}

async function getWorkingHours(tenantId: number): Promise<WorkingHour[]> {
  const { rows } = await pool.query<WorkingHour>(
    `SELECT id, tenant_id, weekday, start_time::text, end_time::text, active
       FROM tenant_working_hours WHERE tenant_id = $1 ORDER BY weekday ASC`,
    [tenantId],
  );
  return rows;
}

async function getBlocks(tenantId: number): Promise<CalendarBlock[]> {
  const { rows } = await pool.query<{
    id: number;
    tenant_id: number;
    starts_at: Date;
    ends_at: Date;
    reason: string | null;
    created_at: Date;
  }>(
    `SELECT * FROM tenant_calendar_blocks
      WHERE tenant_id = $1 AND ends_at > now() - interval '1 day'
      ORDER BY starts_at ASC LIMIT 50`,
    [tenantId],
  );
  return rows.map((r) => ({
    ...r,
    starts_at: r.starts_at.toISOString(),
    ends_at: r.ends_at.toISOString(),
    created_at: r.created_at.toISOString(),
  }));
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams?: { view?: string; w?: string };
}) {
  const tenant = await getCurrentTenant();
  const view = searchParams?.view === "lista" ? "lista" : "semana";
  const w = Number.isFinite(Number(searchParams?.w)) ? Number(searchParams?.w) : 0;

  const timezone = await getTimezone(tenant.id);
  const start = weekStart(timezone, w);
  const startKey = start.toISOString().slice(0, 10);

  const [items, workingHours, blocks] = await Promise.all([
    getAppointments(tenant.id, view === "semana" ? startKey : null),
    getWorkingHours(tenant.id),
    getBlocks(tenant.id),
  ]);

  // 7 dias da semana exibida, com os compromissos de cada dia (fuso do tenant).
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      weekday: WEEKDAYS[i]!,
      dayNum: Number(key.slice(8, 10)),
      isToday: key === dayKey(new Date(), timezone),
      items: items.filter((a) => dayKey(a.scheduled_at, timezone) === key),
    };
  });

  const monthLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(days[3]!.key + "T12:00:00Z"),
  );

  const byDay = items.reduce<Record<string, Appointment[]>>((acc, a) => {
    const day = new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(new Date(a.scheduled_at));
    (acc[day] ??= []).push(a);
    return acc;
  }, {});

  return (
    <>
      <Header
        title="Agenda"
        subtitle={`${tenant.name} · ${items.length} na ${view === "semana" ? "semana" : "lista"}`}
        action={
          <div className="flex items-center gap-2">
            {view === "semana" && (
              <div className="flex items-center rounded-md border border-line p-0.5" role="group" aria-label="Navegar semanas">
                <Link href={`/agenda?view=semana&w=${w - 1}`} aria-label="Semana anterior" className="rounded p-1.5 text-ink-muted hover:text-ink">
                  <ChevronLeft size={14} />
                </Link>
                <Link
                  href="/agenda?view=semana&w=0"
                  className={`rounded px-2 py-1 text-xs ${w === 0 ? "text-ink" : "text-ink-muted hover:text-ink"}`}
                >
                  Hoje
                </Link>
                <Link href={`/agenda?view=semana&w=${w + 1}`} aria-label="Próxima semana" className="rounded p-1.5 text-ink-muted hover:text-ink">
                  <ChevronRight size={14} />
                </Link>
              </div>
            )}
            <div className="flex rounded-md border border-line p-0.5" role="group" aria-label="Modo de visualização">
              <Link
                href="/agenda?view=semana"
                aria-current={view === "semana" ? "page" : undefined}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${view === "semana" ? "bg-canvas-surface-2 text-ink" : "text-ink-muted hover:text-ink"}`}
              >
                <CalendarDays size={12} /> Semana
              </Link>
              <Link
                href="/agenda?view=lista"
                aria-current={view === "lista" ? "page" : undefined}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${view === "lista" ? "bg-canvas-surface-2 text-ink" : "text-ink-muted hover:text-ink"}`}
              >
                <List size={12} /> Lista
              </Link>
            </div>
          </div>
        }
      />
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6">
        {view === "semana" ? (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold capitalize">{monthLabel}</h2>
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              <div className="grid min-w-[720px] grid-cols-7 divide-x divide-line/60">
                {days.map((d) => (
                  <div key={d.key} className={`min-h-[220px] p-2 ${d.isToday ? "bg-accent-bronze/[0.05]" : ""}`}>
                    <div className="mb-2 flex items-baseline gap-1.5 px-1">
                      <span className="text-[10px] uppercase tracking-wide text-ink-faint">{d.weekday}</span>
                      <span
                        className={`font-serif text-base ${
                          d.isToday ? "text-accent-bronze-soft" : "text-ink-soft"
                        }`}
                      >
                        {d.dayNum}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {d.items.map((a) => {
                        const st = STATUS_UI[a.status] ?? STATUS_UI.scheduled!;
                        return (
                          <Link
                            key={a.id}
                            href={`/leads?lead=${encodeURIComponent(a.wa_id)}`}
                            title={`${fmtTime(a.scheduled_at, timezone)} · ${a.nome ?? a.wa_id} · ${st.label}`}
                            className="block rounded-md border border-line bg-canvas-deep/70 px-2 py-1.5 transition-colors hover:border-accent-bronze/40"
                          >
                            <div className="flex items-center gap-1.5 text-[11px] text-ink">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: st.dot }} />
                              <span className="font-semibold">{fmtTime(a.scheduled_at, timezone)}</span>
                              {a.meeting_channel === "video" ? (
                                <Video size={10} className="text-ink-muted" />
                              ) : (
                                <Phone size={10} className="text-ink-muted" />
                              )}
                            </div>
                            <div className="truncate text-[11px] text-ink-soft">{a.nome ?? a.wa_id}</div>
                          </Link>
                        );
                      })}
                      {d.items.length === 0 && <div className="px-1 text-[10px] text-ink-faint">—</div>}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        ) : (
          <>
            {Object.entries(byDay).map(([day, list]) => (
              <Card key={day}>
                <CardHeader>
                  <h2 className="text-sm font-semibold capitalize">{day}</h2>
                </CardHeader>
                <CardBody className="divide-y divide-line">
                  {list.map((a) => {
                    const st = STATUS_UI[a.status] ?? STATUS_UI.scheduled!;
                    return (
                      <div key={a.id} className="flex flex-wrap items-center gap-3 py-2">
                        <div className="w-16 text-center">
                          <div className="text-lg font-semibold text-accent-bronze">
                            {fmtTime(a.scheduled_at, timezone)}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/leads?lead=${encodeURIComponent(a.wa_id)}`}
                            className="font-medium text-ink hover:text-accent-bronze-soft"
                          >
                            {a.nome ?? a.wa_id}
                          </Link>
                          <div className="text-xs text-ink-muted">{a.wa_id}</div>
                        </div>
                        <Badge className="bg-canvas-surface-2 text-ink">
                          {a.meeting_channel === "video" ? (
                            <>
                              <Video size={11} /> Vídeo
                            </>
                          ) : (
                            <>
                              <Phone size={11} /> Ligação
                            </>
                          )}
                        </Badge>
                        <Badge className={st.cls}>{st.label}</Badge>
                        <Badge className="hidden bg-canvas-surface-2 text-ink md:inline-flex">
                          {PROVIDER_LABEL[a.calendar_provider] ?? a.calendar_provider}
                        </Badge>
                        <AppointmentActions tenantSlug={tenant.slug} appointmentId={a.id} status={a.status} />
                      </div>
                    );
                  })}
                </CardBody>
              </Card>
            ))}
            {items.length === 0 && (
              <div className="grid h-40 place-items-center text-sm text-ink-muted">
                Sem agendamentos por enquanto.
              </div>
            )}
          </>
        )}

        {view === "semana" && items.length > 0 && (
          <p className="text-[11px] text-ink-faint">
            Pra marcar o desfecho de uma reunião (realizada / não compareceu), use a visão{" "}
            <Link href="/agenda?view=lista" className="text-ink-soft underline">
              Lista
            </Link>
            .
          </p>
        )}

        {/* Configuração da agenda fica DEPOIS dos compromissos — o dia a dia primeiro. */}
        <GoogleCalendarCard tenantSlug={tenant.slug} />
        <InternalCalendarCard tenantSlug={tenant.slug} workingHours={workingHours} blocks={blocks} />
      </div>
    </>
  );
}
