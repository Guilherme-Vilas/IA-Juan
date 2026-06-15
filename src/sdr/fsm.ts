import { chat, type ChatMessage } from "../core/llm.js";
import { SDR_TOOLS } from "./tools.js";
import { sanitizeReply, type ExtractedCall } from "./sanitize.js";
import { loadPrompts, contextFor, type TenantPrompts } from "./prompts/loader.js";
import { lookupPricing, type PricingTipo } from "./pricing.js";
import { getPlaybookConfig, type PlaybookConfig } from "../core/playbooks.js";
import {
  closeConversation,
  getLead,
  reopenConversation,
  updateLead,
  upsertLead,
  type ClosedReason,
  type LeadRow,
  type LeadState,
  type Slots,
} from "../core/db.js";
import { redis, keys } from "../core/redis.js";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { executeHandoff, pauseAi } from "./handoff.js";
import { confirmSlot, fetchAndCacheSlots, formatOffer, getOfferedSlots } from "./scheduler.js";
import type { TenantRow } from "../core/tenants.js";
import { getAgentSettings, type AgentSettingsRow } from "../core/agent-settings.js";

const HISTORY_LIMIT = 10;

async function pushHistory(tenantSlug: string, waId: string, role: "user" | "assistant", content: string) {
  const k = keys.leadHistory(tenantSlug, waId);
  await redis.rpush(k, JSON.stringify({ role, content }));
  await redis.ltrim(k, -HISTORY_LIMIT, -1);
  await redis.expire(k, config.LEAD_STATE_TTL_SECONDS);
}

async function loadHistory(tenantSlug: string, waId: string): Promise<ChatMessage[]> {
  const items = await redis.lrange(keys.leadHistory(tenantSlug, waId), 0, -1);
  return items
    .map((x) => {
      try {
        return JSON.parse(x) as ChatMessage;
      } catch {
        return null;
      }
    })
    .filter((x): x is ChatMessage => !!x);
}

function buildSystemPrompt(
  prompts: TenantPrompts,
  lead: LeadRow,
  agentSettings?: AgentSettingsRow | null,
  reopenedFrom?: ClosedReason | null,
): string {
  const extra = contextFor(prompts, lead.state);
  const parts = [prompts.system];
  if (extra) {
    parts.push("", "---", "", "# Contexto adicional pra este estado", extra);
  }
  if (agentSettings) {
    parts.push(
      "",
      "---",
      "",
      "# Configuracao comercial do tenant",
      `- agente: ${agentSettings.agent_name}`,
      `- tom: ${agentSettings.tone}`,
      `- produtos: ${agentSettings.products.join(", ") || "nao configurado"}`,
      `- regioes: ${agentSettings.regions.join(", ") || "nao configurado"}`,
      `- regras de qualificacao: ${agentSettings.qualification_rules || "seguir prompt base"}`,
      `- regras de handoff: ${agentSettings.handoff_rules || "seguir prompt base"}`,
    );
  }
  parts.push(
    "",
    "---",
    "",
    "# Contexto do lead",
    `- estado (meta atual): ${lead.state}`,
    `- slots: ${JSON.stringify(lead.slots)}`,
    lead.nome ? `- nome: ${lead.nome}` : "- nome: ainda não sei",
  );

  if (reopenedFrom) {
    const motivos: Record<ClosedReason, string> = {
      scheduled:
        "AGENDADA. Lead voltou a falar — pode ser dúvida pré-call, pedido pra remarcar, ou continuação da conversa. Reconheça o agendamento e responda o que ele trouxer.",
      not_interested:
        "Lead havia dito que NÃO TINHA INTERESSE. Voltou agora. Recebe com naturalidade e curiosidade ('que bom te ver de volta — mudou algo no seu cenário?'). Não force a venda; descubra o gatilho que o trouxe.",
      postponed:
        "Lead havia pedido pra CONVERSAR DEPOIS. Voltou agora. Retoma de onde parou com leveza ('oi! pronto pra retomar?') e relembra o último contexto se necessário.",
      handoff:
        "Conversa havia ido pra HANDOFF humano. Lead voltou. Se a IA não estiver pausada manualmente, retome a conversa com naturalidade e contexto.",
      no_response:
        "Lead tinha ficado SEM RESPONDER e a conversa foi fechada por inatividade. Voltou agora. Recebe sem cobrança ('oi! que bom que apareceu — em que posso te ajudar?').",
    };
    parts.push(
      "",
      "## ⚠️ RETORNO de conversa fechada",
      `Esta conversa estava fechada com motivo: \`${reopenedFrom}\`.`,
      motivos[reopenedFrom] ?? "Lead voltou. Recebe com naturalidade.",
    );
  }

  parts.push(
    "",
    "Curto. Consultora, não formulário. Nunca escreva <function> ou JSON no texto.",
  );
  return parts.join("\n");
}

function normalizeInteresse(v: unknown): Slots["interesse"] | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (!s) return undefined;
  if (s.includes("imov") || s.includes("casa") || s.includes("apart")) return "imovel";
  if (s.includes("auto") || s.includes("carro") || s.includes("moto") || s.includes("veic"))
    return "auto";
  if (s.includes("invest") || s.includes("patrim") || s.includes("renda")) return "investimento";
  if (["imovel", "auto", "investimento", "outro"].includes(s))
    return s as Slots["interesse"];
  return "outro";
}

function normalizeFinalidade(v: unknown): Slots["finalidade"] | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (!s) return undefined;
  if (s.includes("morar") || s.includes("moradia") || s.includes("residenc")) return "moradia";
  if (s.includes("aluga") || s.includes("locac") || s.includes("renda")) return "renda_locacao";
  if (s.includes("invest") || s.includes("flip") || s.includes("revenda")) return "investimento";
  if (["moradia", "investimento", "renda_locacao"].includes(s)) return s as Slots["finalidade"];
  return undefined;
}

function normalizeTipoImovel(v: unknown): Slots["tipo_imovel"] | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (!s) return undefined;
  if (s.includes("lanc") || s.includes("planta") || s.includes("novo")) return "lancamento";
  if (s.includes("usado") || s.includes("revenda") || s.includes("seminovo")) return "usado";
  if (s.includes("comerc") || s.includes("sala") || s.includes("loja")) return "comercial";
  if (["lancamento", "usado", "comercial"].includes(s)) return s as Slots["tipo_imovel"];
  return undefined;
}

function cleanSlotsPayload(raw: Record<string, unknown>): Partial<Slots> {
  const out: Partial<Slots> = {};
  if (typeof raw.nome === "string" && raw.nome.trim()) out.nome = raw.nome.trim();
  if (typeof raw.profissao === "string" && raw.profissao.trim())
    out.profissao = raw.profissao.trim();
  if (typeof raw.renda_aproximada === "string" && raw.renda_aproximada.trim())
    out.renda_aproximada = raw.renda_aproximada.trim();
  if (typeof raw.modelo_carro === "string" && raw.modelo_carro.trim())
    out.modelo_carro = raw.modelo_carro.trim();
  const i = normalizeInteresse(raw.interesse);
  if (i) out.interesse = i;
  if (typeof raw.capacidade_mensal === "number" && raw.capacidade_mensal > 0)
    out.capacidade_mensal = raw.capacidade_mensal;
  if (typeof raw.valor_bem === "number" && raw.valor_bem > 0) out.valor_bem = raw.valor_bem;
  if (typeof raw.prazo_meses === "number" && raw.prazo_meses > 0) out.prazo_meses = raw.prazo_meses;
  if (typeof raw.intencao_lance === "boolean") out.intencao_lance = raw.intencao_lance;
  if (typeof raw.sabe_consorcio === "boolean") out.sabe_consorcio = raw.sabe_consorcio;
  if (typeof raw.prazo_decisao === "string" && raw.prazo_decisao.trim())
    out.prazo_decisao = raw.prazo_decisao.trim();
  if (typeof raw.fecha_se_proposta_boa === "boolean")
    out.fecha_se_proposta_boa = raw.fecha_se_proposta_boa;
  if (typeof raw.decisao_com_conjuge === "boolean")
    out.decisao_com_conjuge = raw.decisao_com_conjuge;
  if (typeof raw.mora_exterior === "boolean") out.mora_exterior = raw.mora_exterior;
  // ===== Imobiliarios (Facilita/Apolar) =====
  if (typeof raw.entrada_disponivel === "number" && raw.entrada_disponivel >= 0)
    out.entrada_disponivel = raw.entrada_disponivel;
  if (typeof raw.usa_fgts === "boolean") out.usa_fgts = raw.usa_fgts;
  const fin = normalizeFinalidade(raw.finalidade);
  if (fin) out.finalidade = fin;
  const tip = normalizeTipoImovel(raw.tipo_imovel);
  if (tip) out.tipo_imovel = tip;
  if (typeof raw.regiao_interesse === "string" && raw.regiao_interesse.trim())
    out.regiao_interesse = raw.regiao_interesse.trim();
  if (typeof raw.pretende_financiar === "boolean")
    out.pretende_financiar = raw.pretende_financiar;
  if (typeof raw.ja_visitou_imovel === "boolean") out.ja_visitou_imovel = raw.ja_visitou_imovel;

  if (typeof raw.observacoes === "string" && raw.observacoes.trim())
    out.observacoes = raw.observacoes.trim();
  return out;
}

function mergeSlots(current: Slots, incoming: Partial<Slots>): Slots {
  return { ...current, ...incoming };
}

async function applyExtractedCalls(
  tenant: TenantRow,
  calls: ExtractedCall[],
  slots: Slots,
  state: LeadState,
  lead: LeadRow,
  waId: string,
  playbook: PlaybookConfig,
): Promise<{ slots: Slots; state: LeadState; closedReason: ClosedReason | null; handoff: boolean }> {
  let workingSlots = slots;
  let workingState = state;
  let closedReason: ClosedReason | null = null;
  let handoff = false;

  for (const c of calls) {
    if (c.name === "save_slots") {
      const cleaned = cleanSlotsPayload(c.args);
      if (Object.keys(cleaned).length > 0) {
        workingSlots = mergeSlots(workingSlots, cleaned);
        workingState = autoAdvance(workingState, workingSlots, playbook);
      }
    } else if (c.name === "advance_state") {
      const to = c.args.to as LeadState | undefined;
      if (to) workingState = to;
    } else if (c.name === "request_handoff") {
      handoff = true;
      closedReason = "handoff";
      await executeHandoff(tenant, { ...lead, state: "HANDOFF", slots: workingSlots }, String(c.args.motivo ?? "handoff"));
      await pauseAi(tenant, waId);
    } else if (c.name === "close_conversation") {
      closedReason = c.args.reason === "postponed" ? "postponed" : "not_interested";
    }
  }

  return { slots: workingSlots, state: workingState, closedReason, handoff };
}

// Avanca o estado a partir das regras do PLAYBOOK (vindas do banco), nao mais
// de condicionais hardcoded por cliente.
function slotPresent(slots: Slots, key: string): boolean {
  const v = (slots as Record<string, unknown>)[key];
  return v !== undefined && v !== null && v !== "";
}

function autoAdvance(state: LeadState, slots: Slots, cfg: PlaybookConfig): LeadState {
  if (state === "S0_ABERTURA" && slots.nome) return "S1_DESCOBERTA";
  if (state === "S1_DESCOBERTA" && cfg.advance_s1_to_s2_any.some((k) => slotPresent(slots, k)))
    return "S2_QUALIFICACAO";
  if (state === "S2_QUALIFICACAO") {
    const ready = cfg.advance_s2_to_s3_groups.some((group) =>
      group.every((k) => slotPresent(slots, k)),
    );
    if (ready) return "S3_EDUCACAO";
  }
  return state;
}

export type FsmOutput = {
  replyText: string | null;
  newState: LeadState;
  closedReason: ClosedReason | null;
  closedByHandoff?: boolean;
  // Se setado: o worker deve agendar um retry-turn em retryAfterMs.
  // Usado pra falhas transitorias (LLM, OpenAI 500, etc.) — Stella ja mandou
  // "um minuto" como replyText, retry roda sem o lead precisar repetir.
  retryAfterMs?: number;
  // Numero da tentativa atual (incrementado pelo retry.worker antes de chamar)
  attemptUsed?: number;
};

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 30_000, 60_000, 120_000]; // index = attempt; attempt 0 nao usa

// Frases de "aguarda um momento" — usadas quando da erro e vamos retentar.
const WAIT_PHRASES = [
  "Um minuto, deixa eu organizar uma coisa aqui e já te respondo 🙏",
  "Ó, me dá só um instante — vou conferir uma coisa e já volto 🙏",
  "Espera só um pouquinho, já te respondo 🙏",
];
// Prefixos pra quando voltarmos com a resposta certa após retry.
const COMEBACK_PHRASES = [
  "Pronto, voltei! ",
  "Aqui de novo — desculpa a espera. ",
  "Voltei! ",
];

function pickPhrase(list: string[], seed: number): string {
  return list[seed % list.length]!;
}

export async function runTurn(
  tenant: TenantRow,
  waId: string,
  userText: string,
  pushName?: string,
  retryContext?: { attempt: number },
): Promise<FsmOutput> {
  const isRetry = !!retryContext;
  const currentAttempt = retryContext?.attempt ?? 0;

  const lead =
    (await getLead(tenant.id, waId)) ??
    (await upsertLead(tenant.id, waId, { nome: pushName ?? null }));

  // ÚNICA condição que silencia a IA: pause manual do owner.
  if (lead.paused) {
    logger.info({ tenant: tenant.slug, waId, state: lead.state }, "skip: lead paused by owner");
    return { replyText: null, newState: lead.state, closedReason: null };
  }

  // auto-reopen se estava fechada — lead voltou a engajar
  let reopenedFrom: ClosedReason | null = null;
  if (lead.status === "closed") {
    reopenedFrom = lead.closed_reason;
    await reopenConversation(tenant.id, waId);
    logger.info({ tenant: tenant.slug, waId, reopenedFrom }, "auto-reopened: lead voltou após fechamento");
    lead.status = "open";
    lead.closed_reason = null;
    lead.closed_at = null;
  }

  const prompts = await loadPrompts(tenant.id);
  const agentSettings = await getAgentSettings(tenant.id);
  const playbook = await getPlaybookConfig(tenant.playbook_slug);

  // No retry, o user message ja foi gravado no histórico no turno original
  // que falhou. Pular pra nao duplicar.
  if (!isRetry) {
    await pushHistory(tenant.slug, waId, "user", userText);
  }

  const history = await loadHistory(tenant.slug, waId);
  const systemPrompt = buildSystemPrompt(prompts, lead, agentSettings, reopenedFrom);

  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...history];

  let workingSlots = { ...lead.slots };
  let workingState: LeadState = lead.state;
  let replyText: string | null = null;
  let closedReason: ClosedReason | null = null;
  let closedByHandoff = false;

  const MAX_STEPS = 3;
  for (let step = 0; step < MAX_STEPS; step++) {
    const useTools = step < MAX_STEPS - 1;
    let choice;
    try {
      choice = await chat({
        model: "main",
        messages,
        tools: useTools ? SDR_TOOLS : undefined,
        temperature: 0.4,
        maxTokens: 350,
      });
    } catch (err) {
      const errMsg = String((err as Error)?.message ?? err ?? "");
      const isRateLimit = errMsg.includes("rate_limit_exceeded") || (err as { status?: number })?.status === 429;
      logger.error({ err, tenant: tenant.slug, waId, step, isRateLimit }, "fsm: chat failed");

      if (errMsg.includes("tool_use_failed") && step < MAX_STEPS - 1) {
        messages.push({
          role: "system",
          content:
            "Sua última tool call foi rejeitada pelo validador. Responda ao lead em texto natural agora, sem tools. Não envie JSON nem tags.",
        });
        continue;
      }

      // Falha transitória → graceful recovery: pede 1min e agenda retry.
      // Apos RETRY_MAX_ATTEMPTS sem sucesso, escala pro Juan via handoff.
      const nextAttempt = currentAttempt + 1;
      if (nextAttempt < RETRY_MAX_ATTEMPTS) {
        const wait = pickPhrase(WAIT_PHRASES, nextAttempt);
        const delay = RETRY_DELAYS_MS[nextAttempt] ?? 60_000;
        logger.warn(
          { tenant: tenant.slug, waId, attempt: nextAttempt, delayMs: delay },
          "fsm: scheduling humanized retry",
        );
        return {
          replyText: isRetry ? null : wait, // no retry, nao manda "um minuto" de novo
          newState: lead.state,
          closedReason: null,
          retryAfterMs: delay,
          attemptUsed: nextAttempt,
        };
      }
      // Esgotou retries → handoff pro humano
      logger.error(
        { tenant: tenant.slug, waId, attempts: currentAttempt },
        "fsm: max retries reached, handing off",
      );
      await executeHandoff(
        tenant,
        { ...lead, state: "HANDOFF" },
        `IA falhou ${currentAttempt}x após instabilidade técnica`,
      ).catch(() => undefined);
      await pauseAi(tenant, waId);
      replyText =
        "Desculpa a demora — tô com uma instabilidade aqui. Vou pedir pro " +
        tenant.owner_name +
        " te chamar direto, ok?";
      closedReason = "handoff";
      closedByHandoff = true;
      break;
    }
    const msg = choice.message;
    const toolCalls = (
      msg as { tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }
    ).tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      // Preserva tool_calls na mensagem do assistant — OpenAI exige isso pra
      // permitir as mensagens 'tool' subsequentes referenciarem os tool_call_ids.
      messages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: toolCalls,
      } as ChatMessage);

      for (const tc of toolCalls) {
        const name = tc.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }
        let toolResult = "ok";

        if (name === "save_slots") {
          const cleaned = cleanSlotsPayload(args);
          if (Object.keys(cleaned).length === 0) {
            toolResult =
              "no_slots_extracted — você chamou save_slots sem valores válidos. NÃO chame essa tool de novo sem dados concretos; responda ao lead em texto.";
          } else {
            workingSlots = mergeSlots(workingSlots, cleaned);
            workingState = autoAdvance(workingState, workingSlots, playbook);
            toolResult = `slots_saved:${JSON.stringify(workingSlots)} state:${workingState}`;
          }
        } else if (name === "advance_state") {
          const to = args.to as LeadState;
          if (to) workingState = to;
          toolResult = `state:${workingState}`;
        } else if (name === "consultar_parcela") {
          const valor = Number(args.valor_carta);
          const argTipo = args.tipo as PricingTipo | undefined;
          const tipo: PricingTipo | undefined =
            argTipo ??
            (workingSlots.interesse === "auto"
              ? "auto"
              : workingSlots.interesse === "imovel"
                ? "imovel"
                : undefined);
          const result = lookupPricing(valor, tipo, playbook.pricing);
          if (result.ok) {
            toolResult =
              `pricing_check: faixa de R$ ${valor.toLocaleString("pt-BR")} (${result.row.tipo}) CABE no perfil. ` +
              `REGRA: NÃO mencione valor de parcela ao lead. Apenas confirme qualitativamente ` +
              `(ex.: "cabe bem", "é uma faixa comum", "trabalho bastante nesse range") ` +
              `e CONDUZA pro agendamento se já tiver as 2 perguntas BANT mínimas.`;
          } else if (result.reason === "fora_da_tabela") {
            const muitoBaixo = valor < 60_000;
            toolResult = muitoBaixo
              ? `pricing_check: R$ ${valor.toLocaleString("pt-BR")} ESTÁ ABAIXO da faixa típica. ` +
                `Auto novo hoje começa em ~R$ 80k. Não confirme essa faixa baixa. ` +
                `Pergunte o modelo/perfil de carro e ajude o lead a calibrar pra cima (popular: 80-110k, médio: 110-180k, SUV: 180k+).`
              : `pricing_check: R$ ${valor.toLocaleString("pt-BR")} está fora da tabela mas pode estar dentro do escopo. ` +
                `Não confirme valor; pergunte se faz sentido o range e direciona pro especialista validar.`;
          } else {
            toolResult = `pricing_invalido (${result.reason}) — peça o valor da carta novamente em R$.`;
          }
        } else if (name === "request_handoff") {
          closedByHandoff = true;
          closedReason = "handoff";
          const motivo = String(args.motivo ?? "handoff solicitado");
          await executeHandoff(tenant, { ...lead, state: "HANDOFF", slots: workingSlots }, motivo);
          await pauseAi(tenant, waId);
          replyText =
            (msg.content && sanitizeReply(msg.content).clean) ||
            `Beleza! Vou chamar o ${tenant.owner_name} agora pra falar com você. Assim que ele puder, te responde por aqui mesmo 🙌`;
          break;
        } else if (name === "close_conversation") {
          const reason = args.reason === "postponed" ? "postponed" : "not_interested";
          closedReason = reason;
          replyText =
            (msg.content && sanitizeReply(msg.content).clean) ||
            (reason === "postponed"
              ? "Tranquilo! Fico no aguardo. Quando quiser, só me chamar aqui que a gente retoma 🙌"
              : "Beleza, sem problema! Se mudar de ideia é só me chamar. Boa sorte 🙌");
          break;
        } else if (name === "propose_schedule") {
          workingState = "S4_AGENDAMENTO";
          const slots = await fetchAndCacheSlots(tenant, waId);
          toolResult = `slots:${JSON.stringify(slots.map((s, i) => ({ i, label: s.label })))}`;
          messages.push({ role: "tool", tool_call_id: tc.id, name, content: toolResult } as ChatMessage);
          messages.push({
            role: "system",
            content:
              `Agora ofereça os horários ao lead. Formato sugerido (mas adapte ao tom):\n\n` +
              formatOffer(tenant, slots),
          });
          continue;
        } else if (name === "confirm_schedule") {
          const idx = Number(args.slot_index ?? -1);
          const channel = args.channel === "video" ? "video" : "ligacao";
          const leadForConfirm: LeadRow = {
            ...lead,
            slots: workingSlots,
            nome: workingSlots.nome ?? lead.nome,
          };
          const pick = await confirmSlot(tenant, leadForConfirm, idx, channel);
          if (pick) {
            workingState = "S5_CONFIRMADO";
            closedReason = "scheduled";
            const channelLabel = channel === "video" ? "vídeo chamada 📹" : "ligação 📞";
            toolResult = `confirmed:${pick.label} channel:${channel}`;
            messages.push({ role: "tool", tool_call_id: tc.id, name, content: toolResult } as ChatMessage);
            messages.push({
              role: "system",
              content: `Confirme ao lead que está marcado para ${pick.label} via ${channelLabel}, e diga que o ${tenant.owner_name} chama no horário.`,
            });
            continue;
          }
          const offered = await getOfferedSlots(tenant, waId);
          toolResult = `invalid_index:available:${JSON.stringify(offered.map((s, i) => ({ i, label: s.label })))}`;
        }

        messages.push({ role: "tool", tool_call_id: tc.id, name, content: toolResult } as ChatMessage);
      }
      if (replyText) break;
      continue;
    }

    const rawContent = (msg.content ?? "").trim();
    const { clean, calls } = sanitizeReply(rawContent);

    if (calls.length > 0) {
      logger.warn(
        { tenant: tenant.slug, waId, count: calls.length, names: calls.map((c) => c.name) },
        "sanitize: extracted inline tool calls",
      );
      const sideEffects = await applyExtractedCalls(tenant, calls, workingSlots, workingState, lead, waId, playbook);
      workingSlots = sideEffects.slots;
      workingState = sideEffects.state;
      if (sideEffects.closedReason && !closedReason) closedReason = sideEffects.closedReason;
      if (sideEffects.handoff) closedByHandoff = true;
    }

    replyText = clean || null;

    if (!replyText && calls.length > 0) {
      messages.push({ role: "assistant", content: rawContent } as ChatMessage);
      messages.push({
        role: "system",
        content: "Agora responda ao lead em linguagem natural, em português, 1-3 linhas. NÃO use tags <function>, NÃO escreva JSON. Apenas o texto que o lead vai ler.",
      });
      const retry = await chat({ model: "main", messages, temperature: 0.4, maxTokens: 300 });
      const retryText = (retry.message.content ?? "").trim();
      replyText = sanitizeReply(retryText).clean || null;
    }

    break;
  }

  if (!replyText) {
    logger.warn({ tenant: tenant.slug, waId, state: workingState }, "fsm: no reply produced — using fallback");
    replyText = "Deixa eu só organizar aqui — pode me contar um pouquinho mais do que você busca?";
  }

  workingState = autoAdvance(workingState, workingSlots, playbook);

  // Se estamos num retry e a chamada deu certo, prefixa um "Voltei!" simpático
  // pra o lead saber que a IA retomou — soa muito mais humano que mandar a
  // resposta seca depois de ter pedido "1min".
  if (isRetry && replyText && !closedByHandoff) {
    const prefix = pickPhrase(COMEBACK_PHRASES, currentAttempt);
    replyText = prefix + replyText;
  }

  await updateLead(tenant.id, waId, {
    state: workingState,
    slots: workingSlots,
    nome: workingSlots.nome ?? lead.nome ?? null,
  });

  if (replyText) {
    await pushHistory(tenant.slug, waId, "assistant", replyText);
  }

  if (closedReason) {
    await closeConversation(tenant.id, waId, closedReason);
  }

  return { replyText, newState: workingState, closedReason, closedByHandoff };
}
