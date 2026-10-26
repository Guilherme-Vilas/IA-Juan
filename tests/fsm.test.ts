import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { autoAdvance, buildSystemPrompt } from "../src/sdr/fsm.js";
import { contextFor, type TenantPrompts } from "../src/sdr/prompts/loader.js";
import type { LeadRow } from "../src/core/db.js";
import type { PlaybookConfig } from "../src/core/playbooks.js";

const playbook: PlaybookConfig = {
  pricing: [],
  advance_s1_to_s2_any: ["interesse", "finalidade", "tipo_imovel"],
  advance_s2_to_s3_groups: [["capacidade_mensal", "valor_bem"]],
  required_slots_to_schedule: ["nome"],
};

// ===== Transições da máquina de estados =====

test("autoAdvance: S0 → S1 quando o nome chega", () => {
  assert.equal(autoAdvance("S0_ABERTURA", { nome: "João" }, playbook), "S1_DESCOBERTA");
  assert.equal(autoAdvance("S0_ABERTURA", {}, playbook), "S0_ABERTURA");
});

test("autoAdvance: S1 → S2 com QUALQUER slot de descoberta", () => {
  assert.equal(autoAdvance("S1_DESCOBERTA", { interesse: "imovel" }, playbook), "S2_QUALIFICACAO");
  assert.equal(autoAdvance("S1_DESCOBERTA", { nome: "João" }, playbook), "S1_DESCOBERTA");
});

test("autoAdvance: S2 → S3 exige o GRUPO completo", () => {
  assert.equal(autoAdvance("S2_QUALIFICACAO", { capacidade_mensal: 3000 }, playbook), "S2_QUALIFICACAO");
  assert.equal(
    autoAdvance("S2_QUALIFICACAO", { capacidade_mensal: 3000, valor_bem: 400000 }, playbook),
    "S3_EDUCACAO",
  );
});

test("autoAdvance: estados finais não se movem sozinhos", () => {
  for (const st of ["S4_AGENDAMENTO", "S5_CONFIRMADO", "HANDOFF"] as const) {
    assert.equal(autoAdvance(st, { nome: "x", interesse: "auto" }, playbook), st);
  }
});

// ===== Composição do prompt (o que a IA realmente recebe) =====

const prompts: TenantPrompts = {
  system: "# Persona base do agente",
  knowledge: "## 2. Os dois perfis de lead\nconteudo perfis\n## 3. Como ler capacidade mensal\nconteudo renda\n## 4. Outro",
  objections: "## Objeções\ncomo responder objeções",
  examples: "Lead: oi\nAgente: olá! exemplo de estilo",
};

function lead(partial: Partial<LeadRow>): LeadRow {
  return {
    id: 1,
    tenant_id: 1,
    wa_id: "5511999998888",
    nome: null,
    source: null,
    state: "S1_DESCOBERTA",
    slots: {},
    score: 0,
    score_label: "frio",
    score_reasons: [],
    paused: false,
    status: "open",
    closed_reason: null,
    closed_at: null,
    last_user_at: null,
    last_assistant_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...partial,
  } as LeadRow;
}

test("prompt: lead de campanha recebe o bloco de contexto de campanha", () => {
  const p = buildSystemPrompt(prompts, lead({ source: "campaign:7" }));
  assert.match(p, /LEAD DE CAMPANHA DE PROSPECÇÃO/);
  assert.match(p, /TOM LEVE, SEM CARA DE VENDA/);
});

test("prompt: lead orgânico NÃO recebe o bloco de campanha", () => {
  const p = buildSystemPrompt(prompts, lead({ source: null }));
  assert.doesNotMatch(p, /LEAD DE CAMPANHA/);
});

test("prompt: calibração pela classe da resposta entra no começo da conversa", () => {
  const p = buildSystemPrompt(
    prompts,
    lead({ source: "campaign:7", state: "S1_DESCOBERTA" }),
    null,
    null,
    "",
    "",
    "nao_interessado",
  );
  assert.match(p, /LEITURA DA RESPOSTA À CAMPANHA: \*nao_interessado\*/);
  assert.match(p, /NÃO tente contornar a objeção/);
});

test("prompt: calibração NÃO entra em fase avançada (a conversa já diz mais)", () => {
  const p = buildSystemPrompt(
    prompts,
    lead({ source: "campaign:7", state: "S3_EDUCACAO" }),
    null,
    null,
    "",
    "",
    "interessado",
  );
  assert.doesNotMatch(p, /LEITURA DA RESPOSTA À CAMPANHA/);
});

test("prompt: SEM classe explícita não há calibração — ela é one-shot do turno da resposta", () => {
  // Regressão: a classe era relida do banco a cada turno e prendia a IA na
  // postura da 1ª reação (re-apresentação eterna / tentar encerrar sempre).
  const p = buildSystemPrompt(prompts, lead({ source: "campaign:7", state: "S1_DESCOBERTA" }));
  assert.doesNotMatch(p, /LEITURA DA RESPOSTA À CAMPANHA/);
});

test("contextFor: lead de campanha NÃO recebe exemplos de primeiro contato", () => {
  assert.equal(contextFor(prompts, "S1_DESCOBERTA", { campaignLead: true }), "");
  assert.match(contextFor(prompts, "S1_DESCOBERTA", { campaignLead: false }), /exemplo de estilo/);
});

test("prompt: lead de campanha em S1 fica sem o few-shot orgânico", () => {
  const p = buildSystemPrompt(prompts, lead({ source: "campaign:7", state: "S1_DESCOBERTA" }));
  assert.doesNotMatch(p, /exemplo de estilo/);
  const organico = buildSystemPrompt(prompts, lead({ source: null, state: "S1_DESCOBERTA" }));
  assert.match(organico, /exemplo de estilo/);
});

test("prompt: retorno de conversa fechada recebe o contexto do motivo", () => {
  const p = buildSystemPrompt(prompts, lead({}), null, "not_interested");
  assert.match(p, /RETORNO de conversa fechada/);
  assert.match(p, /NÃO TINHA INTERESSE/);
});

test("prompt: persona (system do tenant) está sempre presente", () => {
  for (const state of ["S0_ABERTURA", "S2_QUALIFICACAO", "S5_CONFIRMADO"] as const) {
    const p = buildSystemPrompt(prompts, lead({ state }));
    assert.match(p, /Persona base do agente/, state);
  }
});

// ===== Seções por estado (contextFor) =====

test("contextFor: exemplos de conversa entram no COMEÇO (S0/S1)", () => {
  assert.match(contextFor(prompts, "S0_ABERTURA"), /exemplo de estilo/);
  assert.match(contextFor(prompts, "S1_DESCOBERTA"), /siga este estilo/);
});

test("contextFor: S2 recebe leitura de renda; S3 recebe perfis + objeções", () => {
  assert.match(contextFor(prompts, "S2_QUALIFICACAO"), /conteudo renda/);
  const s3 = contextFor(prompts, "S3_EDUCACAO");
  assert.match(s3, /conteudo perfis/);
  assert.match(s3, /como responder objeções/);
});

test("contextFor: exemplos gigantes são truncados (proteção de tokens)", () => {
  const huge = { ...prompts, examples: "x".repeat(10_000) };
  const out = contextFor(huge, "S0_ABERTURA");
  assert.ok(out.length < 7_000, `esperado < 7000, veio ${out.length}`);
  assert.match(out, /exemplos truncados/);
});
