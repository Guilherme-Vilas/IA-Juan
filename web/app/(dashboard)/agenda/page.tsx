import { Header } from "@/components/layout/header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { pool } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { Phone, Video } from "lucide-react";

export const dynamic = "force-dynamic";

type Appointment = {
  id: number;
  scheduled_at: string;
  meeting_channel: "ligacao" | "video" | null;
  status: string;
  wa_id: string;
  nome: string | null;
  slots: { valor_bem?: number; interesse?: string };
};

async function getAppointments(tenantId: number): Promise<Appointment[]> {
  const { rows } = await pool.query<Appointment>(
    `SELECT a.id, a.scheduled_at, a.meeting_channel, a.status,
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

export default async function AgendaPage() {
  const tenant = await getCurrentTenant();
  const items = await getAppointments(tenant.id);
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
        {Object.entries(byDay).map(([day, list]) => (
          <Card key={day}>
            <CardHeader>
              <h2 className="text-sm font-semibold capitalize">{day}</h2>
            </CardHeader>
            <CardBody className="divide-y divide-line">
              {list.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2">
                  <div className="w-16 text-center">
                    <div className="text-lg font-semibold text-brand-700">
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
                  <Badge className="bg-slate-100 text-slate-700">
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
                  <Badge className="bg-emerald-100 text-emerald-700">{a.status}</Badge>
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
