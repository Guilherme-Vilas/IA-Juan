"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toastError, toastSuccess } from "@/lib/toast";

// Excluir campanha (criada por engano / antiga). Exclusão é definitiva: apaga
// a lista de contatos, cadência e métricas DELA. Leads que já responderam
// continuam no pipeline. Campanha rodando precisa ser pausada antes (o backend
// também bloqueia).
export function DeleteCampaignButton({
  tenantSlug,
  campaignId,
  name,
  status,
  afterDelete = "refresh",
}: {
  tenantSlug: string;
  campaignId: number;
  name: string;
  status: string;
  afterDelete?: "refresh" | "back";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove(e: React.MouseEvent) {
    // o botão vive dentro do <Link> do card — não deixa navegar
    e.preventDefault();
    e.stopPropagation();
    if (status === "running") {
      toastError("Pause a campanha antes de excluir.");
      return;
    }
    if (
      !confirm(
        `Excluir a campanha "${name}"?\n\nIsso apaga a lista, a cadência e as métricas dela — não dá pra desfazer. Leads que já responderam continuam no pipeline.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "falha ao excluir");
      toastSuccess(`Campanha "${name}" excluída.`);
      if (afterDelete === "back") router.push("/prospect");
      router.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Não consegui excluir a campanha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      aria-label={`Excluir campanha ${name}`}
      title="Excluir campanha"
      className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
    >
      <Trash2 size={14} />
    </button>
  );
}
