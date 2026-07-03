import { config } from "../../config.js";
import { logger } from "../../core/logger.js";

// Fonte de BUSCA: Casa dos Dados (API pública, dados abertos da Receita).
// Retorna CNPJs que batem com o filtro de ICP — telefone/sócios vêm depois,
// no enriquecimento por CNPJ (minhareceita). Parsing defensivo: a API é
// pública e o shape pode variar.

export type CnpjSearchFilters = {
  uf?: string[];
  municipio?: string[];
  /** códigos CNAE só dígitos, ex: "6821801" (corretagem de imóveis) */
  cnae?: string[];
  termo?: string;
  capital_social_min?: number;
  capital_social_max?: number;
  /** ISO date — só empresas abertas a partir de */
  abertura_desde?: string;
  excluir_mei?: boolean;
  somente_matriz?: boolean;
};

export type CnpjHit = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  uf: string | null;
  municipio: string | null;
  data_abertura: string | null;
  capital_social: number | null;
};

const PAGE_SIZE = 20;

export async function searchCnpj(
  filters: CnpjSearchFilters,
  page: number,
): Promise<{ total: number; hits: CnpjHit[] }> {
  const body = {
    query: {
      termo: filters.termo ? [filters.termo] : [],
      atividade_principal: (filters.cnae ?? []).map((c) => c.replace(/\D/g, "")),
      uf: (filters.uf ?? []).map((u) => u.trim().toUpperCase()).filter(Boolean),
      municipio: (filters.municipio ?? []).map((m) => m.trim().toUpperCase()).filter(Boolean),
      situacao_cadastral: "ATIVA",
    },
    range_query: {
      capital_social: {
        gte: filters.capital_social_min ?? null,
        lte: filters.capital_social_max ?? null,
      },
      data_abertura: {
        gte: filters.abertura_desde ?? null,
        lte: null,
      },
    },
    extras: {
      somente_mei: false,
      excluir_mei: filters.excluir_mei ?? true,
      com_email: false,
      incluir_atividade_secundaria: false,
      // Só empresas com telefone cadastrado — sem telefone não há prospecção.
      com_contato_telefonico: true,
      somente_fixo: false,
      somente_celular: false,
      somente_matriz: filters.somente_matriz ?? true,
    },
    page,
  };

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(`${config.CASADOSDADOS_BASE_URL}/v2/public/cnpj/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`fonte CNPJ respondeu ${res.status} — tente novamente mais tarde`);
    }
    const json = (await res.json()) as {
      data?: { count?: number; cnpj?: Array<Record<string, unknown>> };
    };
    const rows = json?.data?.cnpj ?? [];
    const hits: CnpjHit[] = rows
      .map((r) => ({
        cnpj: String(r["cnpj"] ?? "").replace(/\D/g, ""),
        razao_social: String(r["razao_social"] ?? ""),
        nome_fantasia: r["nome_fantasia"] ? String(r["nome_fantasia"]) : null,
        uf: r["uf"] ? String(r["uf"]) : null,
        municipio: r["municipio"] ? String(r["municipio"]) : null,
        data_abertura: r["data_abertura"] ? String(r["data_abertura"]) : null,
        capital_social: r["capital_social"] != null ? Number(r["capital_social"]) : null,
      }))
      .filter((h) => h.cnpj.length === 14);
    return { total: Number(json?.data?.count ?? hits.length), hits };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("fonte CNPJ demorou demais (timeout) — tente novamente");
    }
    logger.warn({ err, page }, "discovery: busca CNPJ falhou");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export const CNPJ_PAGE_SIZE = PAGE_SIZE;
