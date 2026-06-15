"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, ExternalLink, RefreshCw, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type Status = {
  connected: boolean;
  connect_url: string;
  owner_email: string | null;
  calendar_id: string;
  expires_at: string | null;
  updated_at: string | null;
};

type CalendarItem = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
  selected: boolean;
};

export function GoogleCalendarCard({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/google${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "erro");
    return data;
  }

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const s = (await api("/status")) as Status;
      setStatus(s);
      if (s.connected) {
        const c = (await api("/calendars")) as { calendars: CalendarItem[] };
        setCalendars(c.calendars);
      } else {
        setCalendars([]);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  async function chooseCalendar(calendarId: string) {
    setBusy(true);
    setError(null);
    try {
      await api("/calendar", {
        method: "PATCH",
        body: JSON.stringify({ calendar_id: calendarId }),
      });
      await load();
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Desconectar Google Calendar deste tenant?")) return;
    setBusy(true);
    setError(null);
    try {
      await api("", { method: "DELETE" });
      await load();
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck size={16} className="text-accent-bronze" />
          <h2 className="text-sm font-semibold">Google Calendar</h2>
          {status?.connected ? (
            <Badge className="bg-success/15 text-success">Conectado</Badge>
          ) : (
            <Badge className="bg-canvas-surface-2 text-ink">Não conectado</Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => void load()} disabled={busy} title="Atualizar status">
          <RefreshCw size={15} />
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        {!status?.connected ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm text-ink-muted">
              Conecte a conta Google deste tenant para a IA consultar horários livres e criar eventos automaticamente.
            </p>
            <Button
              onClick={() => {
                if (status?.connect_url) window.location.href = status.connect_url;
              }}
              disabled={busy || !status?.connect_url}
            >
              <ExternalLink size={15} /> Conectar Google
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-2 text-sm sm:grid-cols-[160px_1fr]">
              <span className="text-ink-muted">Conta</span>
              <span className="font-medium">{status.owner_email ?? "Conta Google conectada"}</span>
              <span className="text-ink-muted">Calendário usado</span>
              <select
                className="h-9 rounded-md border border-line bg-canvas-surface px-3 text-sm"
                value={status.calendar_id}
                disabled={busy || calendars.length === 0}
                onChange={(e) => void chooseCalendar(e.target.value)}
              >
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.summary}
                    {c.primary ? " (principal)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => void disconnect()} disabled={busy}>
                <Unplug size={15} /> Desconectar
              </Button>
            </div>
          </>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </CardBody>
    </Card>
  );
}
