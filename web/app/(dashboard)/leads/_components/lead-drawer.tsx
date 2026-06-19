"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Lead, Message } from "@/lib/types";
import { Conversation } from "./conversation";
import { SlotsPanel } from "./slots-panel";
import { ActionsBar } from "./actions-bar";
import { StageTimeline } from "./stage-timeline";
import { LeadCrmBar, NotesPanel, TasksPanel, CustomFieldsValues } from "./crm-panels";
import { Badge } from "@/components/ui/badge";
import { STATE_COLORS, STATE_LABELS, type TenantMember, type CustomFieldDef } from "@/lib/types";
import { Hand } from "lucide-react";

export function LeadDrawer({
  waId,
  onClose,
  onChange,
  members = [],
  fieldDefs = [],
}: {
  waId: string | null;
  onClose: () => void;
  onChange: () => void;
  members?: TenantMember[];
  fieldDefs?: CustomFieldDef[];
}) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    if (!waId) return;
    setLoading(true);
    try {
      const [lr, mr] = await Promise.all([
        fetch(`/api/leads/${waId}`, { cache: "no-store" }),
        fetch(`/api/leads/${waId}/messages`, { cache: "no-store" }),
      ]);
      if (lr.ok) setLead(await lr.json());
      if (mr.ok) setMessages(await mr.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!waId) return;
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waId]);

  return (
    <Sheet open={!!waId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent>
        {!lead ? (
          <div className="grid flex-1 place-items-center text-sm text-ink-muted">
            {loading ? "Carregando…" : "Lead não encontrado"}
          </div>
        ) : (
          <>
            <div className="border-b border-line px-6 pb-3 pt-5">
              <SheetTitle>{lead.nome ?? lead.slots.nome ?? lead.wa_id}</SheetTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <a className="hover:underline" href={`https://wa.me/${lead.wa_id}`} target="_blank">
                  {lead.wa_id}
                </a>
                <Badge className={`${STATE_COLORS[lead.state]} text-white`}>
                  {STATE_LABELS[lead.state]}
                </Badge>
                <Badge
                  className={
                    lead.status === "open"
                      ? "bg-success/15 text-success"
                      : "bg-danger/15 text-danger"
                  }
                >
                  {lead.status}
                </Badge>
                {lead.paused && (
                  <Badge className="bg-warning/15 text-warning">IA pausada</Badge>
                )}
              </div>
            </div>

            <ActionsBar lead={lead} onAction={() => { refresh(); onChange(); }} />

            <LeadCrmBar lead={lead} members={members} onChange={() => { refresh(); onChange(); }} />

            {lead.stage_manual && (
              <div className="flex items-center gap-2 border-b border-line bg-canvas-surface-2/40 px-6 py-2 text-xs text-ink-muted">
                <Hand size={13} className="text-accent-bronze" />
                <span>Fora da automação — você posicionou este lead manualmente.</span>
                <button
                  onClick={async () => {
                    await fetch(`/api/leads/${lead.wa_id}/return-to-auto`, { method: "POST" });
                    refresh();
                    onChange();
                  }}
                  className="ml-auto rounded-md border border-line px-2 py-1 text-[11px] text-ink-soft hover:bg-canvas-surface-2 hover:text-ink"
                >
                  Voltar à automação
                </button>
              </div>
            )}

            <Tabs defaultValue="conversa" className="flex flex-1 flex-col overflow-hidden px-6">
              <TabsList>
                <TabsTrigger value="conversa">Conversa</TabsTrigger>
                <TabsTrigger value="slots">Qualificação</TabsTrigger>
                <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
                <TabsTrigger value="notas">Notas</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
                <TabsTrigger value="info">Info</TabsTrigger>
              </TabsList>

              <TabsContent value="conversa" className="flex-1 overflow-hidden">
                <Conversation
                  lead={lead}
                  messages={messages}
                  onSent={() => { refresh(); onChange(); }}
                />
              </TabsContent>
              <TabsContent value="slots" className="flex-1 overflow-y-auto">
                <SlotsPanel lead={lead} />
              </TabsContent>
              <TabsContent value="tarefas" className="flex-1 overflow-hidden">
                <TasksPanel waId={lead.wa_id} />
              </TabsContent>
              <TabsContent value="notas" className="flex-1 overflow-hidden">
                <NotesPanel waId={lead.wa_id} />
              </TabsContent>
              <TabsContent value="historico" className="flex-1 overflow-y-auto">
                <StageTimeline waId={lead.wa_id} />
              </TabsContent>
              <TabsContent value="info" className="flex-1 overflow-y-auto text-sm">
                <CustomFieldsValues lead={lead} defs={fieldDefs} onChange={refresh} />
                <Info lead={lead} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ lead }: { lead: Lead }) {
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-center justify-between border-b border-line py-2">
      <span className="text-xs uppercase text-ink-muted">{k}</span>
      <span className="text-sm">{v}</span>
    </div>
  );
  return (
    <div className="space-y-1 pb-4">
      {row("WhatsApp", lead.wa_id)}
      {row("Source", lead.source ?? "—")}
      {row("Estado FSM", lead.state)}
      {row("Status", lead.status)}
      {row("Closed reason", lead.closed_reason ?? "—")}
      {row("Criado em", new Date(lead.created_at).toLocaleString("pt-BR"))}
      {row("Atualizado", new Date(lead.updated_at).toLocaleString("pt-BR"))}
      {row("Última msg lead", lead.last_user_at ? new Date(lead.last_user_at).toLocaleString("pt-BR") : "—")}
      {row("Última msg IA", lead.last_assistant_at ? new Date(lead.last_assistant_at).toLocaleString("pt-BR") : "—")}
    </div>
  );
}
