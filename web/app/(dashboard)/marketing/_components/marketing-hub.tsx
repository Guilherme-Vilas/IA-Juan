"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  Megaphone,
  Users,
  Send,
  Trash2,
  FlaskConical,
  Plus,
  CheckCircle2,
  Loader2,
} from "lucide-react";

type Contact = {
  id: number;
  email: string;
  name: string | null;
  source: string | null;
  subscribed: boolean;
  created_at: string;
};

type MktCampaign = {
  id: number;
  subject: string;
  title: string;
  body_text: string;
  cta_label: string | null;
  cta_url: string | null;
  status: "draft" | "sending" | "done" | "failed";
  total: number;
  sent: number;
  failed: number;
  created_at: string;
};

const STATUS_STYLE: Record<MktCampaign["status"], string> = {
  draft: "bg-canvas-surface-2 text-ink-soft",
  sending: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success",
  failed: "bg-danger/15 text-danger",
};
const STATUS_LABEL: Record<MktCampaign["status"], string> = {
  draft: "Rascunho",
  sending: "Enviando…",
  done: "Enviada",
  failed: "Falhou",
};

export function MarketingHub() {
  const [tab, setTab] = useState<"campaigns" | "contacts">("campaigns");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [subscribed, setSubscribed] = useState(0);
  const [campaigns, setCampaigns] = useState<MktCampaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c1, c2] = await Promise.all([
        fetch("/api/admin-proxy/marketing/campaigns", { cache: "no-store" }),
        fetch("/api/admin-proxy/marketing/contacts", { cache: "no-store" }),
      ]);
      if (c1.ok) setCampaigns((await c1.json()).campaigns ?? []);
      if (c2.ok) {
        const d = await c2.json();
        setContacts(d.contacts ?? []);
        setSubscribed(d.subscribed ?? 0);
      }
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Resumo + tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-line bg-canvas-surface p-1">
          {(
            [
              ["campaigns", "Campanhas", Megaphone],
              ["contacts", `Contatos (${subscribed})`, Users],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] transition-colors ${
                tab === id ? "bg-canvas-surface-2 text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink-faint">
          {subscribed} inscritos · descadastro automático em todo e-mail (LGPD)
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
      )}

      {tab === "campaigns" ? (
        <CampaignsTab campaigns={campaigns} subscribed={subscribed} onChanged={load} onError={setError} />
      ) : (
        <ContactsTab contacts={contacts} onChanged={load} onError={setError} />
      )}
    </div>
  );
}

// ===== Campanhas =====

function CampaignsTab({
  campaigns,
  subscribed,
  onChanged,
  onError,
}: {
  campaigns: MktCampaign[];
  subscribed: number;
  onChanged: () => void;
  onError: (e: string | null) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [confirmSend, setConfirmSend] = useState<number | null>(null);

  const create = async () => {
    setBusy(true);
    onError(null);
    try {
      const res = await fetch("/api/admin-proxy/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, title, body_text: body, cta_label: ctaLabel, cta_url: ctaUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro ao criar");
      setCreating(false);
      setSubject("");
      setTitle("");
      setBody("");
      setCtaLabel("");
      setCtaUrl("");
      onChanged();
    } catch (e) {
      onError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const test = async (id: number) => {
    if (!testTo.includes("@")) {
      onError("informe o seu e-mail no campo de teste");
      return;
    }
    onError(null);
    try {
      const res = await fetch(`/api/admin-proxy/marketing/campaigns/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro no teste");
      onError(null);
    } catch (e) {
      onError(String(e instanceof Error ? e.message : e));
    }
  };

  const send = async (id: number) => {
    setBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/admin-proxy/marketing/campaigns/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro no envio");
      setConfirmSend(null);
      onChanged();
    } catch (e) {
      onError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    await fetch(`/api/admin-proxy/marketing/campaigns/${id}`, { method: "DELETE" }).catch(() => undefined);
    onChanged();
  };

  return (
    <div className="space-y-3">
      {creating ? (
        <Card>
          <CardHeader>
            <h2 className="font-serif text-[15px] text-ink">Nova campanha</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Assunto do e-mail">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A IA que atende seu WhatsApp 24h" />
              </Field>
              <Field label="Título (dentro do e-mail)">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pare de perder lead por demora" />
              </Field>
            </div>
            <Field label="Corpo" hint="texto simples — linha em branco separa parágrafos">
              <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder={"Oi!\n\nSabia que 70% dos leads fecham com quem responde primeiro?\n\nA Vita OS responde em segundos, 24/7…"} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Botão (opcional)">
                <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Testar a IA agora" />
              </Field>
              <Field label="Link do botão">
                <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://systemvita.com.br#demo" />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
              <Button variant="bronze" onClick={create} disabled={busy || !subject.trim() || !title.trim() || !body.trim()}>
                Salvar rascunho
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <Field label="" hint="">
            <Input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="seu e-mail pra receber os testes"
              className="w-72"
            />
          </Field>
          <Button variant="bronze" onClick={() => setCreating(true)}>
            <Plus size={14} /> Nova campanha
          </Button>
        </div>
      )}

      {campaigns.length === 0 && !creating ? (
        <Card>
          <CardBody>
            <div className="grid place-items-center gap-2 py-12 text-center">
              <Megaphone size={26} className="text-accent-bronze/50" />
              <p className="font-serif text-lg text-ink">Nenhuma campanha ainda.</p>
              <p className="text-xs text-ink-muted">Escreva a primeira e teste no seu e-mail antes de disparar.</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        campaigns.map((c) => (
          <Card key={c.id}>
            <CardBody className="space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-serif text-[15px] text-ink">{c.subject}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[c.status]}`}>
                      {c.status === "sending" && <Loader2 size={9} className="mr-1 inline animate-spin" />}
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">{c.title} — {c.body_text.slice(0, 90)}…</p>
                </div>
                {c.status !== "sending" && (
                  <button onClick={() => remove(c.id)} className="p-1 text-ink-faint hover:text-danger" title="Excluir">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {(c.status === "sending" || c.status === "done" || c.status === "failed") && (
                <div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-canvas-surface-2">
                    <div
                      className="h-full rounded-full bg-bronze-metal transition-all duration-700"
                      style={{ width: `${c.total ? Math.round(((c.sent + c.failed) / c.total) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    {c.sent} enviados{c.failed > 0 && <span className="text-danger"> · {c.failed} falhas</span>} de {c.total}
                  </p>
                </div>
              )}

              {c.status === "draft" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => test(c.id)}>
                    <FlaskConical size={12} /> Enviar teste
                  </Button>
                  {confirmSend === c.id ? (
                    <>
                      <Button size="sm" variant="danger" onClick={() => send(c.id)} disabled={busy}>
                        <CheckCircle2 size={12} /> Confirmar: enviar pra {subscribed} pessoas
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmSend(null)}>Cancelar</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="bronze" onClick={() => setConfirmSend(c.id)}>
                      <Send size={12} /> Disparar ({subscribed})
                    </Button>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );
}

// ===== Contatos =====

function ContactsTab({
  contacts,
  onChanged,
  onError,
}: {
  contacts: Contact[];
  onChanged: () => void;
  onError: (e: string | null) => void;
}) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const importContacts = async () => {
    setBusy(true);
    onError(null);
    setReport(null);
    try {
      const res = await fetch("/api/admin-proxy/marketing/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw, source: "import" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "erro ao importar");
      setReport(`${data.added} adicionados · ${data.duplicates} já existiam · ${data.invalid} inválidos`);
      setRaw("");
      onChanged();
    } catch (e) {
      onError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    await fetch(`/api/admin-proxy/marketing/contacts/${id}`, { method: "DELETE" }).catch(() => undefined);
    onChanged();
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <h2 className="font-serif text-[15px] text-ink">Adicionar contatos</h2>
          <p className="mt-1 text-[11px] text-ink-muted">
            Cole e-mails separados por vírgula ou um por linha. Aceita o formato {"“Nome <email>”"}.
          </p>
        </CardHeader>
        <CardBody className="space-y-3">
          <Textarea
            rows={4}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"joao@imobiliariax.com.br\nMaria Souza <maria@consorciosy.com.br>"}
          />
          <div className="flex items-center justify-between gap-3">
            {report ? <p className="text-[12px] text-success">{report}</p> : <span />}
            <Button variant="bronze" onClick={importContacts} disabled={busy || !raw.trim()}>
              <Plus size={13} /> {busy ? "Importando…" : "Importar"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {contacts.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">Nenhum contato ainda.</p>
          ) : (
            <div className="max-h-[55vh] divide-y divide-line/50 overflow-y-auto">
              {contacts.map((ct) => (
                <div key={ct.id} className="flex items-center gap-3 px-4 py-2.5 text-[12.5px]">
                  <span className="min-w-0 flex-1">
                    <span className="text-ink">{ct.email}</span>
                    {ct.name && <span className="ml-2 text-ink-faint">{ct.name}</span>}
                  </span>
                  {ct.subscribed ? (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">inscrito</span>
                  ) : (
                    <span className="rounded-full bg-canvas-surface-2 px-2 py-0.5 text-[10px] text-ink-faint">
                      descadastrado
                    </span>
                  )}
                  <button onClick={() => remove(ct.id)} className="p-1 text-ink-faint hover:text-danger" title="Remover">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
