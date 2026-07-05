import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { pool, getLead, logMessage, markLastActivity } from "../core/db.js";
import { redis } from "../core/redis.js";
import { getTenantBySlug } from "../core/tenants.js";
import { calculateLeadScore } from "../core/lead-score.js";
import { ingestLead } from "../core/ingest.js";
import { runTurn } from "../sdr/fsm.js";

// ============================================================================
// Demo pública da landing: o visitante conversa com a Stella REAL (tenant
// demo isolado, sessão efêmera) e vê o painel-CRM reagindo em tempo real.
//
// Endurecimento: teto de mensagens por sessão, sessões por IP/dia, teto
// global diário e limpeza de leads da demo após 24h. Nada aqui exige auth —
// é a vitrine — então TUDO é limitado e isolado no tenant demo.
// ============================================================================

type Scenario = "imovel" | "consorcio" | "cetico";

// Mensagem inicial do "cliente" (o visitante escolhe o cenário e a conversa
// já nasce andando — zero cold start).
const OPENERS: Record<Scenario, string> = {
  imovel: "Oi! Vi um apartamento de 2 quartos no anúncio de vocês. Ainda tá disponível?",
  consorcio: "Oi! Quero entender como usar consórcio pra investir. Como funciona?",
  cetico: "Vou ser sincero: acho que robô no WhatsApp não convence cliente nenhum. Me prova o contrário?",
};

function isScenario(x: unknown): x is Scenario {
  return x === "imovel" || x === "consorcio" || x === "cetico";
}

function clientIp(req: FastifyRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.ip;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ===== Sugestões estilo Gemini — derivadas do estado REAL do FSM =====
// Sempre inclui uma objeção: ver a Stella tratando objeção é o que mais vende.
function suggestionsFor(state: string, slots: Record<string, unknown>, scenario: Scenario): string[] {
  switch (state) {
    case "S0_ABERTURA":
      return scenario === "cetico"
        ? ["Pode me chamar de Ricardo", "Antes do meu nome: você é um robô?", "Por que quer saber meu nome?"]
        : ["Me chamo Ricardo", "Ana, prazer!", "Por que quer saber meu nome?"];
    case "S1_DESCOBERTA":
      if (scenario === "consorcio")
        return ["Quero alavancar patrimônio", "É pra comprar um carro", "Consórcio demora pra contemplar, né?"];
      if (scenario === "cetico")
        return ["Tô procurando um apê de 2 quartos", "Joga teu melhor argumento", "Quanto custa esse sistema?"];
      return ["É pra morar, saindo do aluguel", "Quero investir pra alugar", "Ainda tô só pesquisando"];
    case "S2_QUALIFICACAO": {
      const hasRenda = !!slots["renda_aproximada"] || !!slots["capacidade_mensal"];
      if (!hasRenda)
        return ["Ganho entre 8 e 15 mil", "Prefiro não falar de renda agora", "Por que precisa saber isso?"];
      return scenario === "consorcio"
        ? ["Tenho uma reserva pra dar lance", "Só consigo pagar o mensal", "Quanto tempo até contemplar?"]
        : ["Tenho uns 50 mil de entrada", "Posso usar meu FGTS?", "Achei os preços salgados"];
    }
    case "S3_EDUCACAO":
      return scenario === "consorcio"
        ? ["Financiamento não é melhor?", "E se eu atrasar uma parcela?", "Faz sentido, quero seguir"]
        : ["E se aparecer mais barato depois?", "Vou pensar e te retorno", "Faz sentido, quero ver de perto"];
    case "S4_AGENDAMENTO":
      return ["Pode ser amanhã de manhã", "Quinta à tarde fica melhor", "Prefiro uma ligação antes"];
    default:
      return [];
  }
}

// Fim da sessão: agendou, pediu humano ou estourou o teto de mensagens.
function isDone(state: string, remaining: number): boolean {
  return state === "S5_CONFIRMADO" || state === "HANDOFF" || remaining <= 0;
}

async function takeSessionSlot(ip: string): Promise<string | null> {
  const day = today();
  const [global, perIp] = await Promise.all([
    redis.incr(`demo:day:${day}`),
    redis.incr(`demo:ip:${ip}:${day}`),
  ]);
  await Promise.all([
    redis.expire(`demo:day:${day}`, 86_400),
    redis.expire(`demo:ip:${ip}:${day}`, 86_400),
  ]);
  if (global > config.DEMO_MAX_SESSIONS_PER_DAY) return "a demonstração atingiu o limite de hoje — volte amanhã ou agende com a gente 👇";
  if (perIp > config.DEMO_MAX_SESSIONS_PER_IP_DAY) return "muitas sessões de teste hoje — agende uma demonstração completa com a gente 👇";
  return null;
}

export async function registerDemoRoutes(app: FastifyInstance) {
  // Inicia a sessão: cria o lead efêmero, roda o 1º turno REAL da Stella.
  app.post("/demo/start", async (req, reply) => {
    const body = req.body as { scenario?: string };
    if (!isScenario(body?.scenario)) return reply.code(400).send({ error: "scenario inválido" });
    const scenario = body.scenario;

    const tenant = await getTenantBySlug(config.DEMO_TENANT_SLUG);
    if (!tenant) return reply.code(503).send({ error: "demo não configurada" });

    const blocked = await takeSessionSlot(clientIp(req));
    if (blocked) return reply.code(429).send({ error: blocked });

    const waId = `demo${crypto.randomBytes(6).toString("hex")}`;
    const opener = OPENERS[scenario];

    try {
      const result = await runTurn(tenant, waId, opener);
      const lead = await getLead(tenant.id, waId);
      if (!lead) throw new Error("lead da demo não foi criado");

      await pool.query(`UPDATE leads SET source = $1 WHERE id = $2`, [`demo:${scenario}`, lead.id]);
      await logMessage(lead.id, "in", "user", opener);
      if (result.replyText) await logMessage(lead.id, "out", "assistant", result.replyText);
      await markLastActivity(tenant.id, waId, "assistant");
      await redis.set(`demo:sess:${waId}`, scenario, "EX", 3_600);

      const score = calculateLeadScore({ state: lead.state, slots: lead.slots });
      const remaining = config.DEMO_MAX_MESSAGES - 1;
      logger.info({ waId, scenario, state: result.newState }, "demo: sessão iniciada");
      return reply.send({
        sessionId: waId,
        opener,
        replies: (result.replyText ?? "").split("\n\n").filter(Boolean),
        state: result.newState,
        slots: lead.slots ?? {},
        score,
        suggestions: suggestionsFor(result.newState, lead.slots ?? {}, scenario),
        remaining,
        done: isDone(result.newState, remaining),
        captureEnabled: !!config.DEMO_CAPTURE_INGEST_TOKEN,
      });
    } catch (err) {
      logger.error({ err, waId }, "demo: start falhou");
      return reply.code(500).send({ error: "a Stella tropeçou agora — tenta de novo em instantes" });
    }
  });

  // Turno da conversa.
  app.post("/demo/message", async (req, reply) => {
    const body = req.body as { sessionId?: string; text?: string };
    const waId = (body?.sessionId ?? "").trim();
    const text = (body?.text ?? "").trim().slice(0, 300);
    if (!waId.startsWith("demo") || waId.length < 10) return reply.code(400).send({ error: "sessão inválida" });
    if (!text) return reply.code(400).send({ error: "mensagem vazia" });

    const tenant = await getTenantBySlug(config.DEMO_TENANT_SLUG);
    if (!tenant) return reply.code(503).send({ error: "demo não configurada" });
    const scenarioRaw = await redis.get(`demo:sess:${waId}`);
    if (!scenarioRaw) return reply.code(410).send({ error: "sessão expirada — recomece a demo" });
    const scenario = isScenario(scenarioRaw) ? scenarioRaw : "imovel";

    // Teto de mensagens + trava anti-duplo-clique (1 turno por vez por sessão).
    const count = await redis.incr(`demo:count:${waId}`);
    await redis.expire(`demo:count:${waId}`, 3_600);
    if (count >= config.DEMO_MAX_MESSAGES) {
      return reply.code(429).send({ error: "fim da sessão de teste — agende a demonstração completa 👇", done: true });
    }
    const lock = await redis.set(`demo:lock:${waId}`, "1", "EX", 30, "NX");
    if (!lock) return reply.code(409).send({ error: "aguarde a resposta anterior" });

    try {
      const lead = await getLead(tenant.id, waId);
      if (!lead) return reply.code(410).send({ error: "sessão expirada — recomece a demo" });

      await logMessage(lead.id, "in", "user", text);
      await markLastActivity(tenant.id, waId, "user");

      const result = await runTurn(tenant, waId, text);
      const fresh = await getLead(tenant.id, waId);
      if (result.replyText && fresh) {
        await logMessage(fresh.id, "out", "assistant", result.replyText);
        await markLastActivity(tenant.id, waId, "assistant");
      }

      const score = calculateLeadScore({ state: fresh?.state ?? result.newState, slots: fresh?.slots ?? {} });
      const remaining = config.DEMO_MAX_MESSAGES - 1 - count;
      return reply.send({
        replies: (result.replyText ?? "").split("\n\n").filter(Boolean),
        state: result.newState,
        slots: fresh?.slots ?? {},
        score,
        suggestions: suggestionsFor(result.newState, fresh?.slots ?? {}, scenario),
        remaining,
        done: isDone(result.newState, remaining),
      });
    } catch (err) {
      logger.error({ err, waId }, "demo: turno falhou");
      return reply.code(500).send({ error: "a Stella tropeçou agora — manda de novo?" });
    } finally {
      await redis.del(`demo:lock:${waId}`).catch(() => undefined);
    }
  });

  // Captura suave ao final: o visitante vira lead no tenant comercial da Vita OS.
  app.post("/demo/capture", async (req, reply) => {
    if (!config.DEMO_CAPTURE_INGEST_TOKEN) return reply.code(503).send({ error: "captura desativada" });
    const body = req.body as { sessionId?: string; name?: string; phone?: string };
    const phone = (body?.phone ?? "").replace(/\D/g, "");
    if (phone.length < 10) return reply.code(400).send({ error: "informe um WhatsApp válido com DDD" });
    const waId = (body?.sessionId ?? "").trim();
    const scenario = waId ? await redis.get(`demo:sess:${waId}`) : null;

    const result = await ingestLead(config.DEMO_CAPTURE_INGEST_TOKEN, {
      phone,
      name: body?.name?.trim() || undefined,
      source: "demo-landing",
      utm: { origem: "demo-landing", cenario: scenario ?? "desconhecido" },
    });
    if (!result.ok) return reply.code(400).send({ error: result.error ?? "não foi possível registrar" });
    logger.info({ phone: `${phone.slice(0, 4)}…`, scenario }, "demo: visitante capturado como lead");
    return reply.send({ ok: true });
  });
}

// Sessões da demo são efêmeras: leads do tenant demo somem após 24h.
// Chamado pelo tick periódico dos workers.
export async function cleanupDemoLeads(): Promise<void> {
  const tenant = await getTenantBySlug(config.DEMO_TENANT_SLUG);
  if (!tenant) return;
  const { rowCount } = await pool.query(
    `DELETE FROM leads WHERE tenant_id = $1 AND created_at < now() - interval '24 hours'`,
    [tenant.id],
  );
  if (rowCount && rowCount > 0) logger.info({ removed: rowCount }, "demo: leads efêmeros limpos");
}
