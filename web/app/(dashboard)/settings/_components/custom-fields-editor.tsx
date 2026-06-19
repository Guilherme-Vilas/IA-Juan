"use client";

import { useState } from "react";
import type { CustomFieldDef, CustomFieldType } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

type Draft = { id?: number; key: string; label: string; type: CustomFieldType; options: string[] };

const TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "select", label: "Seleção" },
  { value: "date", label: "Data" },
  { value: "boolean", label: "Sim/Não" },
];

const slugKey = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "")
    .slice(0, 40);

export function CustomFieldsEditor({ initial }: { initial: CustomFieldDef[] }) {
  const [drafts, setDrafts] = useState<Draft[]>(
    initial.map((d) => ({ id: d.id, key: d.key, label: d.label, type: d.type, options: d.options })),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const upd = (i: number, patch: Partial<Draft>) =>
    setDrafts((d) => d.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) =>
    setDrafts((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const c = [...d];
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });
  const remove = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i));
  const add = () => setDrafts((d) => [...d, { key: "", label: "", type: "text", options: [] }]);

  async function save() {
    setBusy(true);
    setMsg(null);
    // chave derivada do rótulo quando vazia.
    const payload = drafts.map((d) => ({
      key: d.key.trim() || slugKey(d.label),
      label: d.label.trim(),
      type: d.type,
      options: d.options,
    }));
    try {
      const res = await fetch("/api/custom-fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "falha ao salvar");
      setDrafts((data.fields as CustomFieldDef[]).map((d) => ({ ...d })));
      setMsg({ kind: "ok", text: "Campos salvos." });
    } catch (e) {
      setMsg({ kind: "err", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold">Campos customizados</h2>
        <p className="text-xs text-ink-muted">Campos próprios que aparecem em cada lead (aba Info).</p>
      </CardHeader>
      <CardBody className="space-y-2">
        {drafts.map((d, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas-deep p-2.5">
            <input
              value={d.label}
              onChange={(e) => upd(i, { label: e.target.value })}
              placeholder="Rótulo (ex: Origem do lead)"
              className="min-w-[160px] flex-1 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
            />
            <select
              value={d.type}
              onChange={(e) => upd(i, { type: e.target.value as CustomFieldType })}
              className="rounded-md border border-line bg-canvas px-2 py-1.5 text-xs text-ink-soft focus:border-line-strong focus:outline-none"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {d.type === "select" && (
              <input
                value={d.options.join(", ")}
                onChange={(e) => upd(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                placeholder="opções separadas por vírgula"
                className="min-w-[160px] flex-1 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink focus:border-line-strong focus:outline-none"
              />
            )}
            <div className="flex items-center">
              <button onClick={() => move(i, -1)} className="rounded p-1 text-ink-muted hover:text-ink">
                <ArrowUp size={14} />
              </button>
              <button onClick={() => move(i, 1)} className="rounded p-1 text-ink-muted hover:text-ink">
                <ArrowDown size={14} />
              </button>
              <button onClick={() => remove(i)} className="rounded p-1 text-ink-muted hover:text-danger">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={add}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2.5 text-[13px] text-ink-muted hover:border-line-strong hover:text-ink"
        >
          <Plus size={15} /> Adicionar campo
        </button>
        {msg && (
          <div
            className={
              msg.kind === "ok"
                ? "rounded-md border border-success/30 bg-success/10 px-3 py-2 text-[13px] text-success"
                : "rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger"
            }
          >
            {msg.text}
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>
            {busy ? "Salvando…" : "Salvar campos"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
