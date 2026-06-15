/**
 * Tabela oficial de faixas de parcela (estimativas).
 * Mantém margem ~R$ 2.000 para o Juan ajustar o valor final na conversa.
 *
 * Editar livre — fonte de verdade pra Stella não divagar quando o lead
 * perguntar parcela. Sempre apresentar como ESTIMATIVA.
 */

export type PricingTipo = "imovel" | "auto";

export type PricingRow = {
  carta_min: number;
  carta_max: number;
  prazo_meses: number;
  parcela_min: number;
  parcela_max: number;
  tipo: PricingTipo;
};

export const PRICING_TABLE: PricingRow[] = [
  // ===== Imóvel =====
  { carta_min: 200_000, carta_max: 250_000, prazo_meses: 200, parcela_min: 1600, parcela_max: 2200, tipo: "imovel" },
  { carta_min: 250_000, carta_max: 300_000, prazo_meses: 200, parcela_min: 1900, parcela_max: 2500, tipo: "imovel" },
  { carta_min: 300_000, carta_max: 400_000, prazo_meses: 200, parcela_min: 2200, parcela_max: 3000, tipo: "imovel" },
  { carta_min: 400_000, carta_max: 500_000, prazo_meses: 200, parcela_min: 2400, parcela_max: 3300, tipo: "imovel" },
  { carta_min: 500_000, carta_max: 600_000, prazo_meses: 240, parcela_min: 2800, parcela_max: 3700, tipo: "imovel" },
  { carta_min: 600_000, carta_max: 700_000, prazo_meses: 240, parcela_min: 3200, parcela_max: 4200, tipo: "imovel" },
  { carta_min: 700_000, carta_max: 800_000, prazo_meses: 240, parcela_min: 3700, parcela_max: 4800, tipo: "imovel" },
  { carta_min: 800_000, carta_max: 1_000_000, prazo_meses: 240, parcela_min: 4200, parcela_max: 5800, tipo: "imovel" },

  // ===== Auto (carros novos hoje: popular começa em ~R$ 80k) =====
  { carta_min: 80_000, carta_max: 110_000, prazo_meses: 80, parcela_min: 1100, parcela_max: 1500, tipo: "auto" },
  { carta_min: 110_000, carta_max: 150_000, prazo_meses: 100, parcela_min: 1400, parcela_max: 1900, tipo: "auto" },
  { carta_min: 150_000, carta_max: 200_000, prazo_meses: 100, parcela_min: 1700, parcela_max: 2400, tipo: "auto" },
  { carta_min: 200_000, carta_max: 300_000, prazo_meses: 100, parcela_min: 2200, parcela_max: 3200, tipo: "auto" },
];

export type PricingLookup =
  | { ok: true; row: PricingRow; formatted: string }
  | { ok: false; reason: string };

// Recebe a tabela de pricing do PLAYBOOK (vinda do banco). Sem tabela = sem cotacao.
// Mantem PRICING_TABLE so como fallback de compatibilidade.
export function lookupPricing(
  valorCarta: number,
  tipo?: PricingTipo,
  table: PricingRow[] = PRICING_TABLE,
): PricingLookup {
  if (!Number.isFinite(valorCarta) || valorCarta <= 0) {
    return { ok: false, reason: "valor_invalido" };
  }
  if (!table.length) return { ok: false, reason: "sem_tabela" };
  const candidates = table.filter((r) => r.carta_min <= valorCarta && valorCarta <= r.carta_max);
  const row = (tipo && candidates.find((r) => r.tipo === tipo)) || candidates[0];
  if (!row) return { ok: false, reason: "fora_da_tabela" };

  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const formatted =
    `Carta de R$ ${fmt(valorCarta)} (${row.tipo}) — parcela aproximada entre ` +
    `R$ ${fmt(row.parcela_min)} e R$ ${fmt(row.parcela_max)}/mês em ${row.prazo_meses} meses ` +
    `(estimativa; valor exato é com o especialista).`;
  return { ok: true, row, formatted };
}
