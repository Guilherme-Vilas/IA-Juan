"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Clock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { CalendarBlock, WorkingHour } from "@/lib/types";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

async function api(tenantSlug: string, path: string, init?: RequestInit) {
  const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}${path}`, {
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

export function InternalCalendarCard({
  tenantSlug,
  workingHours,
  blocks,
}: {
  tenantSlug: string;
  workingHours: WorkingHour[];
  blocks: CalendarBlock[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [block, setBlock] = useState({ starts_at: "", ends_at: "", reason: "" });

  async function saveHour(hour: WorkingHour) {
    setBusy(true);
    setError(null);
    try {
      await api(tenantSlug, `/working-hours/${hour.weekday}`, {
        method: "PATCH",
        body: JSON.stringify(hour),
      });
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function createBlock() {
    if (!block.starts_at || !block.ends_at) return;
    setBusy(true);
    setError(null);
    try {
      await api(tenantSlug, "/calendar-blocks", {
        method: "POST",
        body: JSON.stringify({
          starts_at: new Date(block.starts_at).toISOString(),
          ends_at: new Date(block.ends_at).toISOString(),
          reason: block.reason,
        }),
      });
      setBlock({ starts_at: "", ends_at: "", reason: "" });
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteBlock(id: number) {
    setBusy(true);
    setError(null);
    try {
      await api(tenantSlug, `/calendar-blocks/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-brand-400" />
          <h2 className="text-sm font-semibold">Agenda interna</h2>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="grid gap-2">
          {workingHours.map((h) => (
            <div key={h.weekday} className="grid grid-cols-[44px_70px_1fr_1fr_auto] items-center gap-2 text-sm">
              <span className="font-medium">{DAYS[h.weekday - 1]}</span>
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  defaultChecked={h.active}
                  disabled={busy}
                  onChange={(e) => void saveHour({ ...h, active: e.target.checked })}
                />
                ativo
              </label>
              <input
                className="h-9 rounded-md border border-line px-2"
                type="time"
                defaultValue={h.start_time.slice(0, 5)}
                disabled={busy}
                onBlur={(e) => void saveHour({ ...h, start_time: e.target.value })}
              />
              <input
                className="h-9 rounded-md border border-line px-2"
                type="time"
                defaultValue={h.end_time.slice(0, 5)}
                disabled={busy}
                onBlur={(e) => void saveHour({ ...h, end_time: e.target.value })}
              />
              <span className="text-xs text-ink-muted">expediente</span>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            <Ban size={15} className="text-amber-600" />
            <h3 className="text-sm font-semibold">Bloqueios</h3>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
            <input
              className="h-9 rounded-md border border-line px-2 text-sm"
              type="datetime-local"
              value={block.starts_at}
              onChange={(e) => setBlock((b) => ({ ...b, starts_at: e.target.value }))}
            />
            <input
              className="h-9 rounded-md border border-line px-2 text-sm"
              type="datetime-local"
              value={block.ends_at}
              onChange={(e) => setBlock((b) => ({ ...b, ends_at: e.target.value }))}
            />
            <input
              className="h-9 rounded-md border border-line px-2 text-sm"
              placeholder="Motivo"
              value={block.reason}
              onChange={(e) => setBlock((b) => ({ ...b, reason: e.target.value }))}
            />
            <Button onClick={() => void createBlock()} disabled={busy || !block.starts_at || !block.ends_at}>
              <Plus size={15} /> Bloquear
            </Button>
          </div>
          <div className="divide-y divide-line">
            {blocks.map((b) => (
              <div key={b.id} className="flex items-center gap-3 py-2 text-sm">
                <div className="flex-1">
                  <div className="font-medium">{b.reason ?? "Bloqueio"}</div>
                  <div className="text-xs text-ink-muted">
                    {new Date(b.starts_at).toLocaleString("pt-BR")} ate {new Date(b.ends_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => void deleteBlock(b.id)} disabled={busy}>
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            {blocks.length === 0 && <div className="py-2 text-sm text-ink-muted">Nenhum bloqueio ativo.</div>}
          </div>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </CardBody>
    </Card>
  );
}
