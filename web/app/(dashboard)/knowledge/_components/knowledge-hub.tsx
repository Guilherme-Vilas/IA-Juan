"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, Table, Trash2, RefreshCw, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea, Field } from "@/components/ui/input";
import { StatusDot } from "@/components/ui/badge";

type KnowledgeDoc = {
  id: number;
  title: string;
  description: string;
  source_type: "text" | "csv";
  status: "pending" | "indexing" | "ready" | "failed";
  chunk_count: number;
  error_msg: string | null;
  created_at: string;
};

const STATUS: Record<KnowledgeDoc["status"], { label: string; dot: string; text: string }> = {
  pending: { label: "Pendente", dot: "bg-ink-faint", text: "text-ink-faint" },
  indexing: { label: "Indexando", dot: "bg-warning", text: "text-warning" },
  ready: { label: "Pronto", dot: "bg-success", text: "text-success" },
  failed: { label: "Falhou", dot: "bg-danger", text: "text-danger" },
};

export function KnowledgeHub({
  tenantSlug,
  initial,
  error,
}: {
  tenantSlug: string;
  initial: KnowledgeDoc[];
  error: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(`/api/admin-proxy/${path}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      ...init,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "erro");
    return data;
  };

  const remove = async (id: number) => {
    if (!confirm("Remover este material da base de conhecimento?")) return;
    await call(`tenants/${tenantSlug}/knowledge/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const reindex = async (id: number) => {
    await call(`tenants/${tenantSlug}/knowledge/${id}/reindex`, { method: "POST" });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="max-w-2xl text-[13px] text-ink-muted">
          Cadastre materiais (tabelas de empreendimentos, condições, FAQs…). O agente busca o
          trecho certo e usa na conversa. Atualizou? É só editar — o conhecimento acompanha.
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus size={15} /> Adicionar material
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {initial.length === 0 && !error ? (
        <div className="grid h-64 place-items-center rounded-xl border border-line bg-canvas-surface text-center">
          <div>
            <BookOpen size={30} className="mx-auto mb-3 text-ink-faint" strokeWidth={1.5} />
            <p className="text-[13px] text-ink-muted">Nenhum material cadastrado ainda.</p>
            <p className="mt-1 text-[12px] text-ink-faint">
              Adicione planilhas, condições e FAQs pro agente consultar.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {initial.map((d) => {
            const st = STATUS[d.status];
            const Icon = d.source_type === "csv" ? Table : FileText;
            return (
              <div key={d.id} className="rounded-xl border border-line bg-canvas-surface p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-canvas-surface-2">
                      <Icon size={16} className="text-accent-bronze-soft" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-serif text-[15px] text-ink">{d.title}</h3>
                      {d.description && (
                        <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-muted">{d.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => reindex(d.id)}
                      title="Reindexar"
                      className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-canvas-surface-2 hover:text-ink"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => remove(d.id)}
                      title="Remover"
                      className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-danger/15 hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3 text-[11px]">
                  <span className={`inline-flex items-center gap-1.5 ${st.text}`}>
                    <StatusDot className={st.dot} /> {st.label}
                  </span>
                  <span className="text-ink-faint">·</span>
                  <span className="text-ink-faint">{d.chunk_count} trechos</span>
                  <span className="text-ink-faint">·</span>
                  <span className="text-ink-faint capitalize">{d.source_type}</span>
                </div>
                {d.error_msg && <p className="mt-2 text-[11px] text-danger">{d.error_msg}</p>}
              </div>
            );
          })}
        </div>
      )}

      <AddModal
        tenantSlug={tenantSlug}
        open={open}
        onClose={() => setOpen(false)}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

function AddModal({
  tenantSlug,
  open,
  onClose,
  onDone,
}: {
  tenantSlug: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState<"text" | "csv">("text");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, source_type: sourceType, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro");
      setTitle("");
      setDescription("");
      setContent("");
      onDone();
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Adicionar material" subtitle="O agente vai indexar e consultar quando relevante">
      <div className="space-y-4">
        <Field label="Título" hint="ex: Tabela de empreendimentos — Junho/2026">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do material" />
        </Field>
        <Field label="Descrição" hint="O que é este material, em uma frase">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ex: Preços, plantas e disponibilidade dos lançamentos ativos"
          />
        </Field>
        <Field label="Formato">
          <div className="flex gap-2">
            {(["text", "csv"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSourceType(t)}
                className={`flex-1 rounded-md border px-3 py-2 text-[13px] transition-colors ${
                  sourceType === t
                    ? "border-accent-bronze bg-accent-bronze/10 text-accent-bronze-soft"
                    : "border-line bg-canvas-deep text-ink-muted hover:text-ink"
                }`}
              >
                {t === "text" ? "Texto livre" : "Planilha (CSV)"}
              </button>
            ))}
          </div>
        </Field>
        <Field
          label="Conteúdo"
          hint={
            sourceType === "csv"
              ? "Cole o CSV (primeira linha = cabeçalho). Cada linha vira um item pesquisável."
              : "Cole o texto. Pode ser longo — o sistema quebra em trechos automaticamente."
          }
        >
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-56 font-mono text-[12px]"
            placeholder={
              sourceType === "csv"
                ? "empreendimento,bairro,preco,quartos\nResidencial X,Centro,420000,2\n..."
                : "Cole aqui as informações que o agente precisa saber…"
            }
          />
        </Field>

        {err && <p className="text-[13px] text-danger">{err}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy || !title.trim() || !content.trim()}>
            {busy ? "Indexando…" : "Adicionar e indexar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
