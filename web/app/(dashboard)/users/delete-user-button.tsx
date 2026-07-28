"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

// Exclusão com confirmação em 2 cliques (sem modal): clica → vira "confirmar?" → clica de novo.
export function DeleteUserButton({ userId, label }: { userId: number; label: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const doDelete = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/auth/users/${userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "erro ao excluir");
      router.refresh();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {confirming ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={doDelete}
            disabled={busy}
            className="rounded-md border border-danger/40 bg-danger/15 px-2.5 py-1 text-[11px] font-medium text-danger transition-colors hover:bg-danger/25 disabled:opacity-50"
          >
            {busy ? "Excluindo…" : `Confirmar exclusão de ${label}?`}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-md border border-line px-2 py-1 text-[11px] text-ink-muted hover:text-ink"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          title="Excluir usuário"
          className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={14} />
        </button>
      )}
      {err && <span className="text-[10px] text-danger">{err}</span>}
    </div>
  );
}
