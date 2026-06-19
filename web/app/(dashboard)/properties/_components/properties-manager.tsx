"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Plus, Upload, Trash2, Pencil, Copy, Check, Link2, Home } from "lucide-react";

const inputCls =
  "w-full rounded-md border border-line bg-canvas-deep px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none";
const labelCls = "mb-1 block text-[11px] font-medium text-ink-soft";

const TYPES = ["apartamento", "casa", "terreno", "comercial", "sala", "cobertura"];
const STATUS_LABEL: Record<Property["status"], string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  inativo: "Inativo",
};

type Draft = Partial<Property> & { _priceReais?: string };

function toDraft(p?: Property): Draft {
  return p
    ? { ...p, _priceReais: p.price_cents != null ? String(p.price_cents / 100) : "" }
    : { transaction: "venda", type: "apartamento", status: "disponivel", _priceReais: "" };
}

export function PropertiesManager({
  initial,
  feedUrl,
  error,
}: {
  initial: Property[];
  feedUrl: string;
  error: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyFeed = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Remover este imóvel?")) return;
    await fetch(`/api/properties/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Feed XML pros portais */}
      <div className="rounded-lg border border-line bg-canvas-surface p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
          <Link2 size={14} /> Feed XML pros portais (ZAP / VivaReal / OLX)
        </div>
        <p className="mt-1 text-[11px] text-ink-faint">
          Cole esta URL na área de “integração via XML” do portal. Ele puxa os imóveis disponíveis sozinho.
        </p>
        <div className="mt-2 flex items-stretch gap-2">
          <input
            readOnly
            value={feedUrl}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 rounded-md border border-line bg-canvas px-2.5 py-2 text-[12px] text-ink-soft"
          />
          <button
            onClick={copyFeed}
            className="flex items-center gap-1 rounded-md border border-line px-2.5 text-[12px] text-ink-soft hover:bg-canvas-surface-2"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">{initial.length} imóveis no catálogo</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
            <Upload size={14} /> Importar CSV
          </Button>
          <Button size="sm" onClick={() => setEditing(toDraft())}>
            <Plus size={14} /> Novo imóvel
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas-surface text-left text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3 font-medium">Imóvel</th>
              <th className="px-4 py-3 font-medium">Local</th>
              <th className="px-4 py-3 font-medium">Preço</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {initial.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-muted">
                  <Home size={20} className="mx-auto mb-2 text-ink-faint" />
                  Nenhum imóvel ainda. Adicione ou importe um CSV.
                </td>
              </tr>
            )}
            {initial.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3">
                  <div className="text-ink">{p.title}</div>
                  <div className="text-xs text-ink-faint">
                    {p.ref ? `${p.ref} · ` : ""}
                    {p.type} · {p.transaction}
                    {p.bedrooms ? ` · ${p.bedrooms}q` : ""}
                    {p.parking ? ` · ${p.parking}vg` : ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {[p.neighborhood, p.city].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-ink">
                  {p.price_cents != null ? formatCurrency(p.price_cents / 100) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-xs ${
                      p.status === "disponivel"
                        ? "border-success/40 bg-success/10 text-success"
                        : "border-line bg-canvas-surface-2 text-ink-muted"
                    }`}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(toDraft(p))} className="p-1 text-ink-muted hover:text-ink">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => remove(p.id)} className="p-1 text-ink-muted hover:text-danger">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <PropertyForm draft={editing} onClose={() => setEditing(null)} onSaved={() => router.refresh()} />}
      {importing && <CsvImport onClose={() => setImporting(false)} onDone={() => router.refresh()} />}
    </div>
  );
}

function PropertyForm({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));

  async function save() {
    setBusy(true);
    setErr(null);
    const body: Record<string, unknown> = {
      ref: d.ref ?? "",
      title: d.title ?? "",
      description: d.description ?? "",
      transaction: d.transaction ?? "venda",
      type: d.type ?? "apartamento",
      status: d.status ?? "disponivel",
      price_cents: d._priceReais ? Math.round(Number(d._priceReais.replace(",", ".")) * 100) : null,
      bedrooms: d.bedrooms ?? null,
      bathrooms: d.bathrooms ?? null,
      parking: d.parking ?? null,
      area_m2: d.area_m2 ?? null,
      neighborhood: d.neighborhood ?? "",
      city: d.city ?? "",
      state: d.state ?? "",
      address: d.address ?? "",
      features: d.features ?? [],
      photos: d.photos ?? [],
    };
    try {
      const res = d.id
        ? await fetch(`/api/properties/${d.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/properties", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "falha ao salvar");
      onSaved();
      onClose();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  const numField = (label: string, key: keyof Draft) => (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        type="number"
        value={(d[key] as number) ?? ""}
        onChange={(e) => set({ [key]: e.target.value ? Number(e.target.value) : null } as Partial<Draft>)}
        className={inputCls}
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-canvas-surface shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-serif text-lg text-ink">{d.id ? "Editar imóvel" : "Novo imóvel"}</h2>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          <label className="block">
            <span className={labelCls}>Título *</span>
            <input value={d.title ?? ""} onChange={(e) => set({ title: e.target.value })} className={inputCls} />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className={labelCls}>Código (ref)</span>
              <input value={d.ref ?? ""} onChange={(e) => set({ ref: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Transação</span>
              <select
                value={d.transaction ?? "venda"}
                onChange={(e) => set({ transaction: e.target.value as Property["transaction"] })}
                className={inputCls}
              >
                <option value="venda">Venda</option>
                <option value="locacao">Locação</option>
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Tipo</span>
              <select value={d.type ?? "apartamento"} onChange={(e) => set({ type: e.target.value })} className={inputCls}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className={labelCls}>Preço (R$)</span>
              <input
                value={d._priceReais ?? ""}
                onChange={(e) => set({ _priceReais: e.target.value })}
                inputMode="decimal"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Status</span>
              <select
                value={d.status ?? "disponivel"}
                onChange={(e) => set({ status: e.target.value as Property["status"] })}
                className={inputCls}
              >
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {numField("Área (m²)", "area_m2")}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {numField("Quartos", "bedrooms")}
            {numField("Banheiros", "bathrooms")}
            {numField("Vagas", "parking")}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className={labelCls}>Bairro</span>
              <input value={d.neighborhood ?? ""} onChange={(e) => set({ neighborhood: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Cidade</span>
              <input value={d.city ?? ""} onChange={(e) => set({ city: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>UF</span>
              <input value={d.state ?? ""} onChange={(e) => set({ state: e.target.value })} maxLength={2} className={inputCls} />
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>Descrição</span>
            <textarea
              value={d.description ?? ""}
              onChange={(e) => set({ description: e.target.value })}
              rows={3}
              className={inputCls + " resize-none"}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Diferenciais (separados por vírgula)</span>
            <input
              value={(d.features ?? []).join(", ")}
              onChange={(e) => set({ features: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Fotos (uma URL por linha)</span>
            <textarea
              value={(d.photos ?? []).join("\n")}
              onChange={(e) => set({ photos: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              rows={2}
              className={inputCls + " resize-none"}
            />
          </label>
          {err && <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-6 py-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy || !d.title?.trim()}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CsvImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/properties/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "falha");
      setResult(`Importados: ${data.imported} · Ignorados: ${data.skipped}`);
      onDone();
    } catch (e) {
      setResult(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-line bg-canvas-surface p-5 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-lg text-ink">Importar CSV</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Primeira linha = cabeçalho. Colunas aceitas: titulo, ref, transacao, tipo, preco, quartos, banheiros, vagas,
          area, bairro, cidade, uf, descricao.
        </p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          placeholder="titulo,preco,quartos,bairro,cidade,uf&#10;Apto Centro,450000,3,Centro,Curitiba,PR"
          className="mt-3 w-full resize-none rounded-md border border-line bg-canvas-deep px-3 py-2 font-mono text-xs text-ink focus:border-line-strong focus:outline-none"
        />
        {result && <div className="mt-2 rounded-md border border-line bg-canvas-deep px-3 py-2 text-sm text-ink-soft">{result}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={run} disabled={busy || !csv.trim()}>
            {busy ? "Importando…" : "Importar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
