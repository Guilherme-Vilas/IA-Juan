import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { requireTenantById } from "../core/tenants.js";
import { checkWhatsappNumbers } from "../core/evolution.js";
import { settleSearch, releaseHold } from "../core/credits.js";
import { normalizeBrazilPhone } from "../prospect/csv.js";
import { searchCnpj, CNPJ_PAGE_SIZE, type CnpjHit } from "./providers/casadosdados.js";
import { fetchCnpjDetail } from "./providers/minhareceita.js";
import { fetchCnpjDetailOpenCnpj } from "./providers/opencnpj.js";
import {
  getSearch,
  insertDiscoveredLead,
  listDiscoveredLeads,
  setLeadWhatsapp,
  updateSearch,
} from "./repo.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Pipeline da busca (roda no worker, pode levar minutos):
//   1. Casa dos Dados: pagina resultados até atingir a quantidade pedida
//   2. minhareceita: enriquece cada CNPJ (telefone, sócio, email) — 4 por vez
//   3. Evolution: valida WhatsApp em lotes de 50
// Contadores são atualizados a cada etapa pra UI acompanhar ao vivo.
export async function runDiscovery(searchId: number): Promise<void> {
  const search = await getSearch(searchId);
  if (!search || search.status !== "queued") return;

  await updateSearch(searchId, { status: "running" });
  try {
    const tenant = await requireTenantById(search.tenant_id);
    const target = Math.min(Math.max(10, search.requested_count), config.DISCOVERY_MAX_RESULTS);

    // ===== 1. Busca paginada =====
    const seen = new Set<string>();
    const hits: CnpjHit[] = [];
    const maxPages = Math.ceil(target / CNPJ_PAGE_SIZE) + 3;
    for (let page = 1; page <= maxPages && hits.length < target; page++) {
      const res = await searchCnpj(search.filters, page);
      for (const h of res.hits) {
        if (!seen.has(h.cnpj) && hits.length < target) {
          seen.add(h.cnpj);
          hits.push(h);
        }
      }
      if (res.hits.length < CNPJ_PAGE_SIZE) break; // última página
      await sleep(400); // educado com a API pública
    }
    await updateSearch(searchId, { found_count: hits.length });
    logger.info({ searchId, found: hits.length }, "discovery: busca concluída, enriquecendo");

    // ===== 2. Enriquecimento (telefone/sócio/email), concorrência 4 =====
    let withPhone = 0;
    for (let i = 0; i < hits.length; i += 4) {
      const chunk = hits.slice(i, i + 4);
      // minhareceita primeiro (tem QSA/sócios), OpenCNPJ como fallback.
      const details = await Promise.all(
        chunk.map(async (h) => (await fetchCnpjDetail(h.cnpj)) ?? (await fetchCnpjDetailOpenCnpj(h.cnpj))),
      );
      for (let j = 0; j < chunk.length; j++) {
        const hit = chunk[j]!;
        const d = details[j];
        const phoneRaw = d?.phone1 || d?.phone2 || null;
        const waId = phoneRaw ? normalizeBrazilPhone(phoneRaw) : null;
        if (waId) withPhone++;
        await insertDiscoveredLead({
          search_id: searchId,
          tenant_id: search.tenant_id,
          cnpj: hit.cnpj,
          company: hit.nome_fantasia || hit.razao_social || null,
          // sócio: a busca v5 já traz o quadro societário; o enriquecimento cobre o resto
          contact_name: d?.first_partner ?? hit.first_partner ?? null,
          phone_raw: phoneRaw,
          wa_id: waId,
          email: d?.email ?? null,
          city: hit.municipio,
          uf: hit.uf,
          cnae: d?.cnae ?? null,
          capital_social: hit.capital_social,
          opened_at: hit.data_abertura,
          data: { razao_social: hit.razao_social, cnae_desc: d?.cnae_desc ?? null },
        });
      }
      await updateSearch(searchId, { with_phone_count: withPhone });
      await sleep(300);
    }
    logger.info({ searchId, withPhone }, "discovery: enriquecimento concluído, validando WhatsApp");

    // ===== 3. Validação de WhatsApp em lotes =====
    const leads = await listDiscoveredLeads(searchId, config.DISCOVERY_MAX_RESULTS);
    const withWa = leads.filter((l) => l.wa_id);
    let whatsappCount = 0;
    for (let i = 0; i < withWa.length; i += 50) {
      const chunk = withWa.slice(i, i + 50);
      const checks = await checkWhatsappNumbers(tenant, chunk.map((l) => l.wa_id!));
      for (const l of chunk) {
        const has = checks.get(l.wa_id!) ?? false;
        if (has) whatsappCount++;
        await setLeadWhatsapp(l.id, has);
      }
      await updateSearch(searchId, { whatsapp_count: whatsappCount });
    }

    // Créditos: cobra 1 por lead COM TELEFONE (o que a reserva pagou), devolve
    // ao saldo os créditos das empresas sem contato. Idempotente por charged_credits.
    const { charged } = await settleSearch(search.tenant_id, searchId, search.reserved_credits, withPhone);
    await updateSearch(searchId, { status: "done", whatsapp_count: whatsappCount, charged_credits: charged });
    logger.info(
      { searchId, tenant: tenant.slug, found: hits.length, withPhone, whatsappCount, charged },
      "discovery: busca finalizada",
    );
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    // Falhou: devolve a reserva inteira (nada foi cobrado).
    await releaseHold(search.tenant_id, search.reserved_credits).catch(() => undefined);
    await updateSearch(searchId, { status: "failed", error_msg: msg.slice(0, 500), charged_credits: 0 });
    logger.error({ err, searchId }, "discovery: busca falhou");
  }
}
