"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CampaignStep } from "@/lib/types";
import { Plus, Trash2, GitBranch, Save, Paperclip, Film, Mic, Image as ImageIcon, FileText, X } from "lucide-react";

type StepMedia = { type: "image" | "video" | "audio" | "document"; ref: string; name: string };

type EditStep = {
  wait_hours: number;
  template_text: string;
  media: StepMedia | null;
  variants: Array<{ label: string; template_text: string }>;
};

const MEDIA_ICON = { image: ImageIcon, video: Film, audio: Mic, document: FileText } as const;

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
          media:
            s.media_ref && s.media_type
              ? { type: s.media_type, ref: s.media_ref, name: s.media_name ?? "arquivo" }
              : null,
          variants: s.variants.map((v) => ({ label: v.label, template_text: v.template_text })),
        }))
      : [{ wait_hours: 0, template_text: "", media: null, variants: [] }],
  );
  const [uploadingStep, setUploadingStep] = useState<number | null>(null);

  // Upload de mídia do passo (vídeo/áudio/imagem/PDF até 16MB).
  const uploadMedia = async (i: number, file: File) => {
    if (file.size > 16 * 1024 * 1024) {
      setError("arquivo grande demais — o WhatsApp aceita até 16MB");
      return;
    }
    setUploadingStep(i);
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = () => reject(new Error("falha ao ler o arquivo"));
        r.readAsDataURL(file);
      });
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/campaigns/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro no upload");
      patchStep(i, { media: { type: data.media_type, ref: data.media_ref, name: data.media_name } });
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setUploadingStep(null);
    }
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function patchStep(i: number, patch: Partial<EditStep>) {
    setSaved(false);
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSaved(false);
    setSteps((prev) => [...prev, { wait_hours: 48, template_text: FOLLOWUP_SUGGESTION, media: null, variants: [] }]);
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
        body: JSON.stringify({
          steps: steps.map((s) => ({
            wait_hours: s.wait_hours,
            template_text: s.template_text,
            media_type: s.media?.type ?? null,
            media_ref: s.media?.ref ?? null,
            media_name: s.media?.name ?? null,
            variants: s.variants,
          })),
        }),
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
                <label
                  className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs text-ink-muted transition-colors hover:bg-canvas-surface-2 hover:text-ink ${
                    uploadingStep === i ? "pointer-events-none opacity-50" : ""
                  }`}
                  title="Anexar mídia (vídeo/áudio/imagem/PDF)"
                >
                  <Paperclip size={12} /> {uploadingStep === i ? "Subindo…" : "Mídia"}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.mp4,.3gp,.mov,.mp3,.ogg,.opus,.m4a,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadMedia(i, f);
                      e.target.value = "";
                    }}
                  />
                </label>
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

            {/* chip da mídia anexada */}
            {s.media && (
              <div className="mb-2 flex items-center gap-2 rounded-md border border-accent-bronze/25 bg-accent-bronze/[0.07] px-2.5 py-1.5 text-[11.5px] text-accent-bronze-soft">
                {(() => {
                  const Icon = MEDIA_ICON[s.media.type];
                  return <Icon size={12} />;
                })()}
                <span className="min-w-0 flex-1 truncate">{s.media.name}</span>
                <span className="text-ink-faint">
                  {s.media.type === "audio" ? "voz + texto separado" : "vai com o texto de legenda"}
                </span>
                <button
                  onClick={() => patchStep(i, { media: null })}
                  className="text-ink-faint hover:text-danger"
                  title="Remover mídia"
                >
                  <X size={12} />
                </button>
              </div>
            )}

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
