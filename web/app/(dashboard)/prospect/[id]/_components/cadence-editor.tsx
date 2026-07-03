"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CampaignStep } from "@/lib/types";
import { Plus, Trash2, GitBranch, Save } from "lucide-react";

type EditStep = {
  wait_hours: number;
  template_text: string;
  variants: Array<{ label: string; template_text: string }>;
};

const FOLLOWUP_SUGGESTION =
  "Oi {{primeiro_nome}}, tudo bem? Só passando pra saber se você viu minha mensagem. Faz sentido conversarmos?";

function nextVariantLabel(variants: Array<{ label: string }>): string {
  // 'A' é o template base do passo — variantes começam em B.
  const used = new Set(variants.map((v) => v.label));
  for (const l of ["B", "C", "D"]) if (!used.has(l)) return l;
  return "B";
}

export function CadenceEditor({
  tenantSlug,
  campaignId,
  initial,
}: {
  tenantSlug: string;
  campaignId: number;
  initial: CampaignStep[];
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<EditStep[]>(
    initial.length > 0
      ? initial.map((s) => ({
          wait_hours: s.wait_hours,
          template_text: s.template_text,
          variants: s.variants.map((v) => ({ label: v.label, template_text: v.template_text })),
        }))
      : [{ wait_hours: 0, template_text: "", variants: [] }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function patchStep(i: number, patch: Partial<EditStep>) {
    setSaved(false);
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSaved(false);
    setSteps((prev) => [...prev, { wait_hours: 48, template_text: FOLLOWUP_SUGGESTION, variants: [] }]);
  }

  function removeStep(i: number) {
    setSaved(false);
    setSteps((prev) => prev.filter((_, j) => j !== i));
  }

  function addVariant(i: number) {
    setSaved(false);
    setSteps((prev) =>
      prev.map((s, j) =>
        j === i
          ? { ...s, variants: [...s.variants, { label: nextVariantLabel(s.variants), template_text: s.template_text }] }
          : s,
      ),
    );
  }

  function patchVariant(i: number, vi: number, text: string) {
    setSaved(false);
    setSteps((prev) =>
      prev.map((s, j) =>
        j === i
          ? { ...s, variants: s.variants.map((v, k) => (k === vi ? { ...v, template_text: text } : v)) }
          : s,
      ),
    );
  }

  function removeVariant(i: number, vi: number) {
    setSaved(false);
    setSteps((prev) =>
      prev.map((s, j) => (j === i ? { ...s, variants: s.variants.filter((_, k) => k !== vi) } : s)),
    );
  }

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/campaigns/${campaignId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro ao salvar cadência");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const valid = steps.length > 0 && steps.every((s) => s.template_text.trim());

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <GitBranch size={14} className="text-accent-bronze-soft" /> Cadência ({steps.length}{" "}
            {steps.length === 1 ? "toque" : "toques"})
          </h2>
          <Button size="sm" variant="bronze" onClick={save} disabled={busy || !valid}>
            <Save size={12} /> {busy ? "Salvando…" : saved ? "Salvo ✓" : "Salvar cadência"}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {steps.map((s, i) => (
          <div key={i} className="rounded-lg border border-line bg-canvas-deep/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="grid h-6 w-6 place-items-center rounded-full border border-accent-bronze/40 bg-accent-bronze/10 font-serif text-accent-bronze-soft">
                  {i + 1}
                </span>
                {i === 0 ? (
                  <span className="text-ink-muted">enviado imediatamente</span>
                ) : (
                  <label className="flex items-center gap-1.5 text-ink-muted">
                    espera
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={s.wait_hours}
                      onChange={(e) => patchStep(i, { wait_hours: Math.max(1, Number(e.target.value)) })}
                      className="w-16 rounded-md border border-line bg-canvas-deep px-2 py-1 text-xs text-ink focus:border-accent-bronze/50 focus:outline-none"
                    />
                    h após o passo anterior · <span className="text-ink-faint">para se o lead responder</span>
                  </label>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => addVariant(i)} title="Adicionar variante A/B">
                  <Plus size={12} /> A/B
                </Button>
                {steps.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => removeStep(i)} title="Remover passo">
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                {s.variants.length > 0 && (
                  <span className="mb-1 inline-block rounded bg-canvas-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                    Variante A
                  </span>
                )}
                <textarea
                  value={s.template_text}
                  onChange={(e) => patchStep(i, { template_text: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-line bg-canvas-deep px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-accent-bronze/50 focus:outline-none"
                  placeholder="Template do passo — use {{primeiro_nome}}, {{empresa}}…"
                />
              </div>
              {s.variants.map((v, vi) => (
                <div key={vi}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="inline-block rounded bg-accent-bronze/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-bronze-soft">
                      Variante {v.label}
                    </span>
                    <button
                      onClick={() => removeVariant(i, vi)}
                      className="text-[10px] text-ink-faint hover:text-danger"
                    >
                      remover
                    </button>
                  </div>
                  <textarea
                    value={v.template_text}
                    onChange={(e) => patchVariant(i, vi, e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-accent-bronze/20 bg-canvas-deep px-3 py-2 font-mono text-xs text-ink focus:border-accent-bronze/50 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between">
          <Button size="sm" variant="outline" onClick={addStep} disabled={steps.length >= 10}>
            <Plus size={12} /> Adicionar follow-up
          </Button>
          <p className="text-[11px] text-ink-faint">
            Resposta do lead cancela os próximos passos automaticamente.
          </p>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
      </CardBody>
    </Card>
  );
}
