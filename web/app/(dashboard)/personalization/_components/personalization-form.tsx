"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Check } from "lucide-react";

type Prompts = { system: string; knowledge: string; objections: string; examples: string };

const SECTIONS: { key: keyof Prompts; label: string; hint: string }[] = [
  {
    key: "system",
    label: "Identidade e regras do agente",
    hint: "Quem é o agente, tom de voz, o que pode e não pode fazer, como conduzir a conversa.",
  },
  {
    key: "knowledge",
    label: "Conhecimento do produto",
    hint: "O que o agente sabe sobre seus produtos, faixas de preço, perfis de cliente, critérios de qualificação.",
  },
  {
    key: "objections",
    label: "Tratamento de objeções",
    hint: "Como responder às dúvidas e resistências mais comuns dos leads.",
  },
  {
    key: "examples",
    label: "Exemplos de conversa",
    hint: "Diálogos modelo que mostram o estilo ideal de atendimento.",
  },
];

export function PersonalizationForm({
  tenantSlug,
  initial,
  error,
}: {
  tenantSlug: string;
  initial: Prompts;
  error: string | null;
}) {
  const [prompts, setPrompts] = useState<Prompts>(initial);
  const [active, setActive] = useState<keyof Prompts>("system");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(error);

  const save = async () => {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin-proxy/tenants/${tenantSlug}/prompts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompts),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro ao salvar");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center justify-between">
        <p className="max-w-2xl text-[13px] text-ink-muted">
          Edite o "cérebro" do seu agente. As mudanças entram em vigor em até 5 minutos (ou na
          próxima conversa). Use linguagem clara, como se estivesse treinando um vendedor novo.
        </p>
        <Button onClick={save} disabled={busy}>
          {saved ? (
            <>
              <Check size={15} /> Salvo
            </>
          ) : (
            <>
              <Save size={15} /> {busy ? "Salvando…" : "Salvar"}
            </>
          )}
        </Button>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">
          {err}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        {/* Navegação das seções */}
        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                active === s.key
                  ? "bg-canvas-surface text-ink"
                  : "text-ink-muted hover:bg-canvas-surface/60 hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* Editor da seção ativa */}
        {SECTIONS.filter((s) => s.key === active).map((s) => (
          <Card key={s.key}>
            <CardHeader>
              <h2 className="font-serif text-lg text-ink">{s.label}</h2>
              <p className="mt-1 text-xs text-ink-muted">{s.hint}</p>
            </CardHeader>
            <CardBody>
              <textarea
                value={prompts[s.key]}
                onChange={(e) => setPrompts((p) => ({ ...p, [s.key]: e.target.value }))}
                spellCheck={false}
                className="h-[60vh] w-full resize-none rounded-md border border-line bg-canvas-deep p-4 font-serif text-[14px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-white/20"
                placeholder="Escreva aqui as instruções do agente…"
              />
              <div className="mt-2 text-[11px] text-ink-faint">
                {prompts[s.key].length.toLocaleString("pt-BR")} caracteres
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
