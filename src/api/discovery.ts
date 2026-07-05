import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { pool } from "../core/db.js";
import { requireSuperadmin } from "../auth/plugin.js";
import { getCredits, listTransactions, topup, holdForSearch, releaseHold } from "../core/credits.js";
import { discoveryQueue, discoveryJobId } from "../workers/queues.js";
import {
  createSearch,
  deleteSearch,
  getSearchForTenant,
  listDiscoveredLeads,
  listSearches,
  updateSearch,
} from "../discovery/repo.js";
import type { CnpjSearchFilters } from "../discovery/providers/casadosdados.js";
import { createCampaign, insertProspects, type ProspectInput } from "../prospect/repo.js";
import { replaceSteps } from "../prospect/steps.js";
import {
  filterBlacklisted,
  filterRecentlyProspected,
  filterSuppressedLeads,
} from "../prospect/suppression.js";

const DEFAULT_TEMPLATE =
  "Oi {{primeiro_nome}}, tudo bem? Vi que você está à frente da {{empresa}}. " +
  "Trabalho com estratégia patrimonial pra empresários — posso te mandar 2 informações rápidas?";

function parseFilters(raw: Record<string, unknown> | undefined): CnpjSearchFilters {
  const asList = (v: unknown): string[] | undefined => {
    if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
    if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
    return undefined;
  };
  const asNum = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return {
    uf: asList(raw?.["uf"]),
    municipio: asList(raw?.["municipio"]),
    cnae: asList(raw?.["cnae"]),
    termo: typeof raw?.["termo"] === "string" && raw["termo"].trim() ? raw["termo"].trim() : undefined,
    capital_social_min: asNum(raw?.["capital_social_min"]),
    capital_social_max: asNum(raw?.["capital_social_max"]),
    abertura_desde:
      typeof raw?.["abertura_desde"] === "string" && raw["abertura_desde"] ? raw["abertura_desde"] : undefined,
    excluir_mei: raw?.["excluir_mei"] !== false,
    somente_matriz: raw?.["somente_matriz"] !== false,
  };
}

export async function registerDiscoveryRoutes(app: FastifyInstance) {
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);
    scope.addHook("preHandler", scope.requireTenant);

    scope.get("/admin/tenants/:slug/discovery", async (req) => {
      const [searches, credits] = await Promise.all([listSearches(req.tenantId!), getCredits(req.tenantId!)]);
      return { searches, credits };
    });

    // Saldo + extrato de créditos.
    scope.get("/admin/tenants/:slug/credits", async (req) => {
      const [credits, transactions] = await Promise.all([
        getCredits(req.tenantId!),
        listTransactions(req.tenantId!, 50),
      ]);
      return { credits, transactions };
    });

    // Recarga manual — SÓ superadmin.
    scope.post("/admin/tenants/:slug/credits/topup", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const body = req.body as { amount?: number; reason?: string };
      const amount = Number(body?.amount);
      if (!Number.isInteger(amount) || amount <= 0) {
        return reply.code(400).send({ error: "amount deve ser um inteiro positivo" });
      }
      const actor = req.auth?.kind === "user" ? `superadmin#${req.auth.userId}` : "service";
      const total = await topup(req.tenantId!, amount, actor, body?.reason);
      logger.info({ tenant: req.tenantSlug, amount, actor }, "credits: topup via admin");
      return reply.send({ ok: true, balance: total });
    });

    scope.post("/admin/tenants/:slug/discovery", async (req, reply) => {
      const body = req.body as {
        name?: string;
        requested_count?: number;
        filters?: Record<string, unknown>;
      };
      if (!body?.name?.trim()) return reply.code(400).send({ error: "name required" });
      const filters = parseFilters(body.filters);
      const hasAnyFilter =
        (filters.uf?.length ?? 0) > 0 ||
        (filters.municipio?.length ?? 0) > 0 ||
        (filters.cnae?.length ?? 0) > 0 ||
        !!filters.termo ||
        filters.capital_social_min != null;
      if (!hasAnyFilter) {
        return reply.code(400).send({ error: "defina pelo menos um filtro (UF, cidade, CNAE, termo ou capital)" });
      }
      const requested = Math.min(Math.max(10, Number(body.requested_count ?? 100)), config.DISCOVERY_MAX_RESULTS);

      // Reserva créditos (1 = 1 lead com telefone). Entrega parcial: roda só o
      // que o saldo cobrir. Saldo zero → bloqueia e pede recarga.
      const hold = await holdForSearch(req.tenantId!, requested);
      if (hold <= 0) {
        return reply.code(402).send({ error: "sem créditos de prospecção — peça uma recarga ao administrador" });
      }

      const search = await createSearch({
        tenant_id: req.tenantId!,
        name: body.name.trim(),
        filters,
        requested_count: hold, // cap parcial pelo saldo
        reserved_credits: hold,
      });
      await discoveryQueue.add(
        "run",
        { searchId: search.id },
        { jobId: discoveryJobId(search.id), removeOnComplete: true, removeOnFail: 20 },
      );
      logger.info(
        { tenant: req.tenantSlug, searchId: search.id, requested, reserved: hold, partial: hold < requested },
        "discovery: busca criada",
      );
      return reply.send({ search, reserved: hold, partial: hold < requested });
    });

    scope.get("/admin/tenants/:slug/discovery/:id", async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      const search = await getSearchForTenant(req.tenantId!, id);
      if (!search) return reply.code(404).send({ error: "not found" });
      const leads = await listDiscoveredLeads(id, 500);
      return { search, leads };
    });

    // Re-roda uma busca que falhou (ex.: fonte fora do ar / credencial nova).
    scope.post("/admin/tenants/:slug/discovery/:id/retry", async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      const search = await getSearchForTenant(req.tenantId!, id);
      if (!search) return reply.code(404).send({ error: "not found" });
      if (search.status !== "failed") return reply.code(409).send({ error: "só buscas com falha podem ser re-executadas" });
      // A falha devolveu a reserva — re-reserva pra rodar de novo (entrega parcial).
      const hold = await holdForSearch(req.tenantId!, search.requested_count);
      if (hold <= 0) {
        return reply.code(402).send({ error: "sem créditos de prospecção — peça uma recarga ao administrador" });
      }
      await updateSearch(id, { status: "queued", error_msg: null, charged_credits: null });
      await pool.query(`UPDATE discovery_searches SET reserved_credits = $1, requested_count = $1 WHERE id = $2`, [hold, id]);
      await discoveryQueue
        .add("run", { searchId: id }, { jobId: discoveryJobId(id), removeOnComplete: true, removeOnFail: 20 })
        .catch(async (err) => {
          if (!String(err?.message ?? "").includes("already exists")) throw err;
        });
      logger.info({ tenant: req.tenantSlug, searchId: id, reserved: hold }, "discovery: retry");
      return reply.send({ ok: true });
    });

    scope.delete("/admin/tenants/:slug/discovery/:id", async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      const search = await getSearchForTenant(req.tenantId!, id);
      if (!search) return reply.code(404).send({ error: "not found" });
      if (search.status === "running") return reply.code(409).send({ error: "busca em andamento" });
      // Busca em fila ainda segura a reserva (não rodou) — devolve ao saldo.
      if (search.status === "queued" && search.charged_credits == null && search.reserved_credits > 0) {
        await releaseHold(req.tenantId!, search.reserved_credits);
      }
      await deleteSearch(req.tenantId!, id);
      return reply.send({ ok: true });
    });

    // Exporta os leads validados (com WhatsApp) como uma campanha nova —
    // a lista passa pelas mesmas proteções do import manual (blacklist,
    // já-prospectado 90d, lead do funil).
    scope.post("/admin/tenants/:slug/discovery/:id/export", async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      const search = await getSearchForTenant(req.tenantId!, id);
      if (!search) return reply.code(404).send({ error: "not found" });
      if (search.status !== "done") return reply.code(409).send({ error: "busca ainda não concluída" });
      if (search.exported_campaign_id) {
        return reply.code(409).send({ error: "busca já exportada", campaign_id: search.exported_campaign_id });
      }

      const body = (req.body ?? {}) as { name?: string; template_text?: string; rate_per_day?: number };
      const leads = (await listDiscoveredLeads(id, config.DISCOVERY_MAX_RESULTS)).filter(
        (l) => l.has_whatsapp && l.wa_id,
      );
      if (leads.length === 0) return reply.code(400).send({ error: "nenhum lead com WhatsApp validado nessa busca" });

      const campaign = await createCampaign({
        tenant_id: req.tenantId!,
        name: body.name?.trim() || search.name,
        channel: "whatsapp",
        template_text: body.template_text?.trim() || DEFAULT_TEMPLATE,
        ai_refine: true,
        rate_per_day: body.rate_per_day ?? config.PROSPECT_DEFAULT_RATE_PER_DAY,
        work_hours_only: true,
      });
      await replaceSteps(campaign.id, [
        { wait_hours: 0, template_text: body.template_text?.trim() || DEFAULT_TEMPLATE },
      ]);

      const inputs: ProspectInput[] = leads.map((l) => ({
        external_id: l.wa_id!,
        nome: l.contact_name ?? null,
        empresa: l.company ?? null,
        cargo: l.contact_name ? "Sócio(a)" : null,
        raw_csv: {
          cnpj: l.cnpj,
          cidade: l.city ?? "",
          uf: l.uf ?? "",
          email: l.email ?? "",
          atividade: (l.data?.["cnae_desc"] as string) ?? "",
        },
      }));

      const ids = inputs.map((p) => p.external_id);
      const [blacklisted, recent, suppressedLeads] = await Promise.all([
        filterBlacklisted(req.tenantId!, ids),
        filterRecentlyProspected(req.tenantId!, ids, campaign.id),
        filterSuppressedLeads(req.tenantId!, ids),
      ]);
      const clean = inputs.filter(
        (p) => !blacklisted.has(p.external_id) && !recent.has(p.external_id) && !suppressedLeads.has(p.external_id),
      );
      const { inserted, duplicates } = await insertProspects(req.tenantId!, campaign.id, clean);
      await updateSearch(id, { exported_campaign_id: campaign.id });

      const suppressed = inputs.length - clean.length;
      logger.info(
        { tenant: req.tenantSlug, searchId: id, campaignId: campaign.id, inserted, duplicates, suppressed },
        "discovery: busca exportada como campanha",
      );
      return reply.send({ campaign_id: campaign.id, inserted, duplicates, suppressed });
    });
  });
}
