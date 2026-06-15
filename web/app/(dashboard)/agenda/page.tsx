import { Header } from "@/components/layout/header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { pool } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { Phone, Video } from "lucide-react";
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

async function getAppointments(tenantId: number): Promise<Appointment[]> {
  const { rows } = await pool.query<Appointment>(
    `SELECT a.id, a.scheduled_at, a.ends_at, a.calendar_provider, a.meeting_channel, a.status,
            l.wa_id, l.nome, l.slots
       FROM appointments a
       JOIN leads l ON l.id = a.lead_id
      WHERE a.tenant_id = $1
        AND a.scheduled_at > now() - interval '2 days'
      ORDER BY a.scheduled_at ASC`,
    [tenantId],
  );
  return rows;
}

async function getWorkingHours(tenantId: number): Promise<WorkingHour[]> {
  const { rows } = await pool.query<WorkingHour>(
    `SELECT id, tenant_id, weekday, start_time::text, end_time::text, active
       FROM tenant_working_hours
      WHERE tenant_id = $1
      ORDER BY weekday ASC`,
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
      WHERE tenant_id = $1
        AND ends_at > now() - interval '1 day'
      ORDER BY starts_at ASC
      LIMIT 50`,
    [tenantId],
  );
  return rows.map((r) => ({
    ...r,
    starts_at: r.starts_at.toISOString(),
    ends_at: r.ends_at.toISOString(),
    created_at: r.created_at.toISOString(),
  }));
}

export default async function AgendaPage() {
  const tenant = await getCurrentTenant();
  const items = await getAppointments(tenant.id);
  const workingHours = await getWorkingHours(tenant.id);
  const blocks = await getBlocks(tenant.id);
  const byDay = items.reduce<Record<string, Appointment[]>>((acc, a) => {
    const day = new Date(a.scheduled_at).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    (acc[day] ??= []).push(a);
    return acc;
  }, {});
  return (
    <>
      <Header title="Agenda" subtitle={`${tenant.name} · ${items.length} agendamentos`} />
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        <GoogleCalendarCard tenantSlug={tenant.slug} />
        <InternalCalendarCard tenantSlug={tenant.slug} workingHours={workingHours} blocks={blocks} />

        {Object.entries(byDay).map(([day, list]) => (
          <Card key={day}>
            <CardHeader>
              <h2 className="text-sm font-semibold capitalize">{day}</h2>
            </CardHeader>
            <CardBody className="divide-y divide-line">
              {list.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2">
                  <div className="w-16 text-center">
                    <div className="text-lg font-semibold text-accent-bronze">
                      {new Date(a.scheduled_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{a.nome ?? a.wa_id}</div>
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
                  <Badge className="bg-success/15 text-success">{a.status}</Badge>
                  <Badge className="bg-canvas-surface-2 text-ink">{a.calendar_provider}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>
        ))}
        {items.length === 0 && (
          <div className="grid h-40 place-items-center text-sm text-ink-muted">
            Sem agendamentos por enquanto.
          </div>
        )}
      </div>
    </>
  );
}

