import { config } from "../../config.js";
import { logger } from "../../core/logger.js";

// Fonte de BUSCA: Casa dos Dados.
// Com CASADOSDADOS_API_KEY → API oficial v5 (POST /v5/cnpj/pesquisa, header
// api-key, até 1000 resultados/página, retorna quadro societário).
// Sem chave → tenta o endpoint público v2 (bloqueado por Cloudflare desde
// jul/2026; o erro orienta a configurar a chave).
// Doc oficial: https://docs.casadosdados.com.br (Pesquisa Avançada de empresas)

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
  /** v5 (tipo_resultado=completo) já traz o quadro societário */
  first_partner?: string | null;
};

// v5 aceita até 1000/página; 100 equilibra custo e memória. v2 pagina de 20.
export function cnpjPageSize(apiKey: string | null | undefined): number {
  return apiKey ? 100 : 20;
}

// apiKey: chave da API oficial — do TENANT (cada cliente contrata a sua),
// com fallback no env global (demo/uso interno). Sem chave, cai no endpoint
// público v2 (bloqueado por Cloudflare — o erro orienta a colar a chave).
export async function searchCnpj(
  filters: CnpjSearchFilters,
  page: number,
  apiKey?: string | null,
): Promise<{ total: number; hits: CnpjHit[] }> {
  const key = apiKey ?? config.CASADOSDADOS_API_KEY ?? null;
  return key ? searchV5(filters, page, key) : searchV2Public(filters, page);
}

// ===== API oficial v5 (com chave) =====

async function searchV5(
  filters: CnpjSearchFilters,
  page: number,
  apiKey: string,
): Promise<{ total: number; hits: CnpjHit[] }> {
  const body: Record<string, unknown> = {
    situacao_cadastral: ["ATIVA"],
    limite: cnpjPageSize(apiKey),
    pagina: page,
    mais_filtros: {
      somente_matriz: filters.somente_matriz ?? true,
      // Só empresas com telefone — sem telefone não há prospecção.
      com_telefone: true,
    },
  };
  const cnaes = (filters.cnae ?? []).map((c) => c.replace(/\D/g, "")).filter(Boolean);
  if (cnaes.length) body.codigo_atividade_principal = cnaes;
  const ufs = (filters.uf ?? []).map((u) => u.trim().toLowerCase()).filter(Boolean);
  if (ufs.length) body.uf = ufs;
  const cities = (filters.municipio ?? []).map((m) => m.trim().toLowerCase()).filter(Boolean);
  if (cities.length) body.municipio = cities;
  if (filters.termo) {
    body.busca_textual = [
      {
        texto: [filters.termo],
        tipo_busca: "radical",
        razao_social: true,
        nome_fantasia: true,
        nome_socio: false,
      },
    ];
  }
  if (filters.capital_social_min != null || filters.capital_social_max != null) {
    body.capital_social = {
      ...(filters.capital_social_min != null ? { minimo: filters.capital_social_min } : {}),
      ...(filters.capital_social_max != null ? { maximo: filters.capital_social_max } : {}),
    };
  }
  if (filters.abertura_desde) body.data_abertura = { inicio: filters.abertura_desde };
  if (filters.excluir_mei ?? true) body.mei = { excluir_optante: true };

  const json = await postJson(
    `${config.CASADOSDADOS_BASE_URL}/v5/cnpj/pesquisa?tipo_resultado=completo`,
    body,
    { "api-key": apiKey },
    true,
  );

  const j = json as { total?: number; cnpjs?: Array<Record<string, unknown>> };
  const rows = j?.cnpjs ?? [];
  const hits: CnpjHit[] = rows
    .map((r) => {
      const endereco = (r["endereco"] ?? {}) as Record<string, unknown>;
      const qsa = Array.isArray(r["quadro_societario"])
        ? (r["quadro_societario"] as Array<Record<string, unknown>>)
        : [];
      return {
        cnpj: String(r["cnpj"] ?? "").replace(/\D/g, ""),
        razao_social: String(r["razao_social"] ?? ""),
        nome_fantasia: r["nome_fantasia"] ? String(r["nome_fantasia"]) : null,
        uf: endereco["uf"] ? String(endereco["uf"]).toUpperCase() : null,
        municipio: endereco["municipio"] ? String(endereco["municipio"]) : null,
        data_abertura: r["data_abertura"] ? String(r["data_abertura"]) : null,
        capital_social: r["capital_social"] != null ? Number(r["capital_social"]) : null,
        first_partner: qsa[0]?.["nome"] ? String(qsa[0]["nome"]) : null,
      };
    })
    .filter((h) => h.cnpj.length === 14);
  return { total: Number(j?.total ?? hits.length), hits };
}

// ===== Endpoint público v2 (sem chave — Cloudflare bloqueia desde jul/2026) =====

async function searchV2Public(
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
      data_abertura: { gte: filters.abertura_desde ?? null, lte: null },
    },
    extras: {
      somente_mei: false,
      excluir_mei: filters.excluir_mei ?? true,
      com_email: false,
      incluir_atividade_secundaria: false,
      com_contato_telefonico: true,
      somente_fixo: false,
      somente_celular: false,
      somente_matriz: filters.somente_matriz ?? true,
    },
    page,
  };

  const json = await postJson(`${config.CASADOSDADOS_BASE_URL}${config.CASADOSDADOS_SEARCH_PATH}`, body, {}, false);
  const j = json as { data?: { count?: number; cnpj?: Array<Record<string, unknown>> } };
  const rows = j?.data?.cnpj ?? [];
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
  return { total: Number(j?.data?.count ?? hits.length), hits };
}

// ===== Saldo da conta (a doc pública não expõe o path — tentamos os
// conhecidos; CASADOSDADOS_SALDO_PATH fixa o exato quando souber) =====

const SALDO_CANDIDATES = ["/v5/usuario/saldo", "/v5/saldo", "/v4/usuario/saldo", "/v5/conta/saldo"];

function pickNumber(obj: unknown): number | null {
  if (typeof obj === "number" && Number.isFinite(obj)) return obj;
  if (obj && typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    for (const k of ["saldo", "balance", "creditos", "credits", "quantidade", "disponivel"]) {
      const v = o[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
      if (v && typeof v === "object") {
        const nested = pickNumber(v);
        if (nested != null) return nested;
      }
    }
  }
  return null;
}

export async function fetchSourceBalance(apiKey: string): Promise<number | null> {
  const paths = config.CASADOSDADOS_SALDO_PATH ? [config.CASADOSDADOS_SALDO_PATH] : SALDO_CANDIDATES;
  for (const path of paths) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8_000);
    try {
      const res = await fetch(`${config.CASADOSDADOS_BASE_URL}${path}`, {
        headers: { Accept: "application/json", "api-key": apiKey },
        signal: ctrl.signal,
      });
      if (res.ok) {
        const json = (await res.json().catch(() => null)) as unknown;
        const n = pickNumber(json);
        if (n != null) {
          logger.debug({ path, saldo: n }, "cdd: saldo obtido");
          return n;
        }
      }
    } catch {
      /* tenta o próximo path */
    } finally {
      clearTimeout(timeout);
    }
  }
  return null; // sem endpoint conhecido — a UI degrada pro link do portal
}

// ===== HTTP comum + erros acionáveis =====

async function postJson(
  url: string,
  body: unknown,
  extraHeaders: Record<string, string>,
  hasKey: boolean,
): Promise<unknown> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...extraHeaders },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const cloudflareBlock =
        (res.status === 403 || res.status === 503) &&
        (text.includes("Just a moment") || text.includes("Enable JavaScript") || text.includes("cf-"));
      if (cloudflareBlock && !hasKey) {
        throw new Error(
          "Nenhuma chave da Casa dos Dados configurada. Assine a API em portal.casadosdados.com.br " +
            "(R$0,01/consulta, 200 grátis no teste) e cole a chave em Buscar leads → Fonte de dados.",
        );
      }
      if (res.status === 401) {
        throw new Error("fonte CNPJ: chave inválida (401) — confira a chave em Buscar leads → Fonte de dados");
      }
      if (res.status === 402 || res.status === 429) {
        throw new Error(`fonte CNPJ: limite/créditos da conta esgotados (${res.status}) — verifique seu plano na Casa dos Dados`);
      }
      if (res.status === 422 || res.status === 400) {
        logger.warn({ status: res.status, body: text.slice(0, 500) }, "discovery: v5 rejeitou o filtro");
        throw new Error(`fonte CNPJ rejeitou os filtros (${res.status}) — ajuste os filtros e tente de novo`);
      }
      throw new Error(`fonte CNPJ respondeu ${res.status} — tente novamente mais tarde`);
    }
    return await res.json();
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("fonte CNPJ demorou demais (timeout) — tente novamente");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
