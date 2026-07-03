import { config } from "../../config.js";
import { logger } from "../../core/logger.js";

// Fonte de ENRIQUECIMENTO: minhareceita.org (open-source, dados abertos da
// Receita). Dado um CNPJ, devolve telefones, email e quadro societário —
// é daqui que sai o contato e o nome do sócio pra personalizar a abordagem.

export type CnpjDetail = {
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  first_partner: string | null;
  cnae: string | null;
  cnae_desc: string | null;
};

export async function fetchCnpjDetail(cnpj: string): Promise<CnpjDetail | null> {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return null;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`${config.MINHARECEITA_BASE_URL}/${clean}`, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;

    const qsa = Array.isArray(j["qsa"]) ? (j["qsa"] as Array<Record<string, unknown>>) : [];
    const firstPartner = qsa[0]?.["nome_socio"] ? String(qsa[0]["nome_socio"]) : null;

    return {
      phone1: j["ddd_telefone_1"] ? String(j["ddd_telefone_1"]).replace(/\D/g, "") || null : null,
      phone2: j["ddd_telefone_2"] ? String(j["ddd_telefone_2"]).replace(/\D/g, "") || null : null,
      email: j["email"] ? String(j["email"]) : null,
      first_partner: firstPartner,
      cnae: j["cnae_fiscal"] != null ? String(j["cnae_fiscal"]) : null,
      cnae_desc: j["cnae_fiscal_descricao"] ? String(j["cnae_fiscal_descricao"]) : null,
    };
  } catch (err) {
    logger.debug({ err, cnpj: clean }, "discovery: enriquecimento CNPJ falhou (segue sem)");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
