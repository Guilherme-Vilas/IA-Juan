import { config } from "../../config.js";
import { logger } from "../../core/logger.js";
import type { CnpjDetail } from "./minhareceita.js";

// Fallback de ENRIQUECIMENTO: OpenCNPJ (api.opencnpj.org — gratuito, CDN,
// até 50 req/s). Traz telefones e email; sócios nem sempre vêm, por isso é
// o segundo da fila (minhareceita tem QSA garantido).

export async function fetchCnpjDetailOpenCnpj(cnpj: string): Promise<CnpjDetail | null> {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return null;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${config.OPENCNPJ_BASE_URL}/${clean}`, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;

    // telefones: [{ddd, numero, is_fax}] — prefere o primeiro que não é fax.
    const phones = Array.isArray(j["telefones"]) ? (j["telefones"] as Array<Record<string, unknown>>) : [];
    const pick = (p?: Record<string, unknown>) =>
      p ? `${String(p["ddd"] ?? "")}${String(p["numero"] ?? "")}`.replace(/\D/g, "") || null : null;
    const nonFax = phones.filter((p) => !p["is_fax"]);
    const phone1 = pick(nonFax[0] ?? phones[0]);
    const phone2 = pick(nonFax[1] ?? phones[1]);

    // QSA nem sempre presente — lê defensivamente.
    const qsa = Array.isArray(j["qsa"]) ? (j["qsa"] as Array<Record<string, unknown>>) : [];
    const firstPartner = qsa[0]?.["nome_socio"] ? String(qsa[0]["nome_socio"]) : null;

    const cnaes = Array.isArray(j["cnaes"]) ? (j["cnaes"] as Array<Record<string, unknown>>) : [];
    const mainCnae = cnaes.find((c) => c["is_principal"]);

    return {
      phone1,
      phone2,
      email: j["email"] ? String(j["email"]) : null,
      first_partner: firstPartner,
      cnae: j["cnae_principal"] != null ? String(j["cnae_principal"]) : null,
      cnae_desc: mainCnae?.["descricao"] ? String(mainCnae["descricao"]) : null,
    };
  } catch (err) {
    logger.debug({ err, cnpj: clean }, "discovery: fallback OpenCNPJ falhou");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
