"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, UserX, XCircle } from "lucide-react";
import { toastError, toastSuccess } from "@/lib/toast";

// Desfecho da reunião direto da Agenda. "Não veio" reabre a conversa e volta o
// lead pra fase de agendamento (a IA tenta remarcar quando ele responder).
const ACTIONS = [
  { status: "confirmed", label: "Confirmada", icon: Check, cls: "text-info hover:bg-info/10" },
  { status: "completed", label: "Realizada", icon: CheckCheck, cls: "text-success hover:bg-success/10" },
  { status: "no_show", label: "Não veio", icon: UserX, cls: "text-warning hover:bg-warning/10" },
  { status: "cancelled", label: "Cancelar", icon: XCircle, cls: "text-danger hover:bg-danger/10" },
] as const;

export function AppointmentActions({
  tenantSlug,
  appointmentId,
  status,
}: {
  tenantSlug: string;
  appointmentId: number;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (status !== "scheduled" && status !== "confirmed") return null;

  async function setStatus(next: string, label: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      toastSuccess(`Reunião marcada como "${label}".`);
      router.refresh();
    } catch {
      toastError("Não consegui atualizar a reunião — tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {ACTIONS.filter((a) => !(status === "confirmed" && a.status === "confirmed")).map((a) => (
        <button
          key={a.status}
          disabled={busy}
          onClick={() => setStatus(a.status, a.label)}
          title={a.label}
          className={`flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] transition-colors disabled:opacity-50 ${a.cls}`}
        >
          <a.icon size={12} />
          <span className="hidden lg:inline">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
