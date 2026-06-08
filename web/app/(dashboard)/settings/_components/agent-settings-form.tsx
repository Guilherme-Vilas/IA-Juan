"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, BookOpen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { AgentSettings, PlaybookTemplate } from "@/lib/types";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/admin-proxy${path}`, {
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

function join(values: string[]) {
  return values.join(", ");
}

function split(value: string) {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function AgentSettingsForm({
  tenantSlug,
  settings,
  playbookSlug,
  playbooks,
}: {
  tenantSlug: string;
  settings: AgentSettings;
  playbookSlug: string | null;
  playbooks: PlaybookTemplate[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    agent_name: settings.agent_name,
    tone: settings.tone,
    products: join(settings.products),
    regions: join(settings.regions),
    qualification_rules: settings.qualification_rules,
    handoff_rules: settings.handoff_rules,
    playbook_slug: playbookSlug ?? "",
  });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/tenants/${tenantSlug}/agent-settings`, {
        method: "PATCH",
        body: JSON.stringify({
          agent_name: form.agent_name,
          tone: form.tone,
          products: split(form.products),
          regions: split(form.regions),
          qualification_rules: form.qualification_rules,
          handoff_rules: form.handoff_rules,
        }),
      });
      if (form.playbook_slug) {
        await api(`/tenants/${tenantSlug}/playbook`, {
          method: "PATCH",
          body: JSON.stringify({ playbook_slug: form.playbook_slug }),
        });
      }
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  const selected = playbooks.find((p) => p.slug === form.playbook_slug);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-brand-700" />
            <h2 className="text-sm font-semibold">Configuração do agente</h2>
          </div>
          <Button onClick={() => void save()} disabled={busy}>
            <Save size={15} /> Salvar
          </Button>
        </CardHeader>
        <CardBody className="grid gap-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Nome do agente</span>
            <input
              className="h-10 rounded-md border border-line px-3"
              value={form.agent_name}
              onChange={(e) => setForm((f) => ({ ...f, agent_name: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Tom de voz</span>
            <input
              className="h-10 rounded-md border border-line px-3"
              value={form.tone}
              onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Produtos</span>
              <input
                className="h-10 rounded-md border border-line px-3"
                value={form.products}
                onChange={(e) => setForm((f) => ({ ...f, products: e.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Regiões</span>
              <input
                className="h-10 rounded-md border border-line px-3"
                value={form.regions}
                onChange={(e) => setForm((f) => ({ ...f, regions: e.target.value }))}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Regras de qualificação</span>
            <textarea
              className="min-h-28 rounded-md border border-line px-3 py-2"
              value={form.qualification_rules}
              onChange={(e) => setForm((f) => ({ ...f, qualification_rules: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Regras de handoff</span>
            <textarea
              className="min-h-24 rounded-md border border-line px-3 py-2"
              value={form.handoff_rules}
              onChange={(e) => setForm((f) => ({ ...f, handoff_rules: e.target.value }))}
            />
          </label>
          {error && <p className="text-xs text-danger">{error}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-brand-700" />
            <h2 className="text-sm font-semibold">Playbook</h2>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <select
            className="h-10 w-full rounded-md border border-line px-3 text-sm"
            value={form.playbook_slug}
            onChange={(e) => setForm((f) => ({ ...f, playbook_slug: e.target.value }))}
          >
            {playbooks.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          {selected && (
            <div className="rounded-md border border-line bg-slate-50 p-3 text-sm">
              <div className="font-medium">{selected.segment}</div>
              <p className="mt-1 text-ink-muted">{selected.description}</p>
              <p className="mt-3 text-xs text-ink-muted">{selected.default_rules}</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
