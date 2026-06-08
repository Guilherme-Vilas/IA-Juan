import type { LeadRow, Slots } from "./db.js";

export type LeadScore = {
  score: number;
  label: "frio" | "morno" | "quente" | "pronto";
  reasons: string[];
};

function hasMoneySignal(slots: Slots): boolean {
  return !!slots.renda_aproximada || !!slots.capacidade_mensal || slots.entrada_disponivel !== undefined;
}

export function calculateLeadScore(lead: Pick<LeadRow, "state" | "slots">): LeadScore {
  const s = lead.slots ?? {};
  let score = 0;
  const reasons: string[] = [];

  if (s.nome) {
    score += 5;
    reasons.push("nome identificado");
  }
  if (s.profissao) {
    score += 10;
    reasons.push("profissao mapeada");
  }
  if (s.interesse || s.tipo_imovel || s.finalidade) {
    score += 15;
    reasons.push("interesse claro");
  }
  if (hasMoneySignal(s)) {
    score += 20;
    reasons.push("capacidade financeira sinalizada");
  }
  if (s.valor_bem) {
    score += 10;
    reasons.push("valor pretendido informado");
  }
  if (s.prazo_decisao || s.prazo_meses) {
    score += 10;
    reasons.push("prazo/timing identificado");
  }
  if (s.intencao_lance !== undefined || s.entrada_disponivel !== undefined || s.usa_fgts !== undefined) {
    score += 10;
    reasons.push("entrada/lance/FGTS mapeado");
  }
  if (s.fecha_se_proposta_boa || s.ja_visitou_imovel) {
    score += 10;
    reasons.push("sinal de decisao ou visita");
  }
  if (s.decisao_com_conjuge !== undefined) {
    score += 5;
    reasons.push("decisor conhecido");
  }
  if (lead.state === "S4_AGENDAMENTO" || lead.state === "S5_CONFIRMADO") {
    score += 10;
    reasons.push("avancou para agendamento");
  }

  score = Math.max(0, Math.min(100, score));
  const label: LeadScore["label"] =
    score >= 80 ? "pronto" : score >= 60 ? "quente" : score >= 35 ? "morno" : "frio";

  return { score, label, reasons };
}
