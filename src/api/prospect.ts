import type { FastifyInstance } from "fastify";
import { logger } from "../core/logger.js";
import { parseProspectsCsv } from "../prospect/csv.js";
import { composeMessage } from "../prospect/compose.js";
import {
  createCampaign,
  deleteCampaign,
  getCampaign,
  getCampaignMetrics,
  getProspect,
  insertProspects,
  listCampaigns,
  listProspects,
  logProspectEvent,
  updateCampaign,
  updateProspect,
  type Channel,
} from "../prospect/repo.js";
import { pauseCampaign, startCampaign } from "../prospect/dispatcher.js";
import {
  addToBlacklist,
  filterBlacklisted,
  filterRecentlyProspected,
  filterSuppressedLeads,
  listBlacklist,
  removeFromBlacklist,
} from "../prospect/suppression.js";
import { normalizeBrazilPhone } from "../prospect/csv.js";

function isChannel(x: unknown): x is Channel {
  return x === "whatsapp" || x === "linkedin";
}

export async function registerProspectRoutes(app: FastifyInstance) {
  // ===== Campanhas por tenant — escopo com auth + cross-check =====
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);
    scope.addHook("preHandler", scope.requireTenant);

    scope.get("/admin/tenants/:slug/campaigns", async (req) => {
      return { campaigns: await listCampaigns(req.tenantId!) };
    });

    scope.post("/admin/tenants/:slug/campaigns", async (req, reply) => {
      const body = req.body as {
        name?: string;
        channel?: string;
        template_text?: string;
        ai_refine?: boolean;
        tone?: string;
        rate_per_day?: number;
        work_hours_only?: boolean;
      };
      if (!body?.name?.trim()) return reply.code(400).send({ error: "name required" });
      if (!isChannel(body.channel)) return reply.code(400).send({ error: "channel must be whatsapp|linkedin" });
      if (!body?.template_text?.trim()) return reply.code(400).send({ error: "template_text required" });

      const c = await createCampaign({
        tenant_id: req.tenantId!,
        name: body.name.trim(),
        channel: body.channel,
        template_text: body.template_text,
        ai_refine: body.ai_refine ?? true,
        tone: body.tone ?? "semi-formal",
        rate_per_day: body.rate_per_day ?? 30,
        work_hours_only: body.work_hours_only ?? true,
      });
      logger.info({ tenant: req.tenantSlug, campaignId: c.id }, "admin: campaign created");
      return reply.send({ campaign: c });
    });

    scope.get("/admin/tenants/:slug/campaigns/:id", async (req, reply) => {
      const campaignId = Number((req.params as { id: string }).id);
      const c = await getCampaign(req.tenantId!, campaignId);
      if (!c) return reply.code(404).send({ error: "not found" });
      const [metrics, prospects] = await Promise.all([
        getCampaignMetrics(campaignId),
        listProspects(campaignId, { limit: 500 }),
      ]);
      return { campaign: c, metrics, prospects };
    });

    scope.patch("/admin/tenants/:slug/campaigns/:id", async (req, reply) => {
      const campaignId = Number((req.params as { id: string }).id);
      const c = await getCampaign(req.tenantId!, campaignId);
      if (!c) return reply.code(404).send({ error: "campaign not found" });
      const body = req.body as Record<string, unknown>;
      const allowed = ["name", "template_text", "ai_refine", "tone", "rate_per_day", "work_hours_only"];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (k in body) patch[k] = body[k];
      await updateCampaign(campaignId, patch as Parameters<typeof updateCampaign>[1]);
      return reply.send({ ok: true });
    });

    scope.delete("/admin/tenants/:slug/campaigns/:id", async (req, reply) => {
      const campaignId = Number((req.params as { id: string }).id);
      const c = await getCampaign(req.tenantId!, campaignId);
      if (!c) return reply.code(404).send({ error: "campaign not found" });
      await deleteCampaign(campaignId);
      return reply.send({ ok: true });
    });

    scope.post("/admin/tenants/:slug/campaigns/:id/prospects", async (req, reply) => {
      const campaignId = Number((req.params as { id: string }).id);
      const campaign = await getCampaign(req.tenantId!, campaignId);
      if (!campaign) return reply.code(404).send({ error: "campaign not found" });
      const body = req.body as { csv?: string };
      if (!body?.csv) return reply.code(400).send({ error: "csv required" });

      const parsed = parseProspectsCsv(body.csv, campaign.channel);

      // Camadas de supressão no import: blacklist (opt-out/LGPD), já prospectado
      // em outra campanha (janela de 90d) e lead do funil em situação proibida.
      const ids = parsed.prospects.map((p) => p.external_id);
      const [blacklisted, recent, suppressedLeads] = await Promise.all([
        filterBlacklisted(req.tenantId!, ids),
        filterRecentlyProspected(req.tenantId!, ids, campaignId),
        campaign.channel === "whatsapp"
          ? filterSuppressedLeads(req.tenantId!, ids)
          : Promise.resolve(new Set<string>()),
      ]);

      const clean = parsed.prospects.filter(
        (p) => !blacklisted.has(p.external_id) && !recent.has(p.external_id) && !suppressedLeads.has(p.external_id),
      );
      const suppressed = {
        blacklisted: blacklisted.size,
        ja_prospectado: parsed.prospects.filter((p) => !blacklisted.has(p.external_id) && recent.has(p.external_id)).length,
        lead_existente: parsed.prospects.filter(
          (p) => !blacklisted.has(p.external_id) && !recent.has(p.external_id) && suppressedLeads.has(p.external_id),
        ).length,
      };

      const { inserted, duplicates } = await insertProspects(req.tenantId!, campaignId, clean);
      logger.info(
        { tenant: req.tenantSlug, campaignId, inserted, duplicates, invalid: parsed.invalid.length, suppressed },
        "admin: prospects uploaded",
      );
      return reply.send({ inserted, duplicates, invalid: parsed.invalid, suppressed, headers: parsed.headers });
    });

    // ===== Blacklist (opt-outs LGPD + bloqueios manuais) =====
    scope.get("/admin/tenants/:slug/blacklist", async (req) => {
      return { blacklist: await listBlacklist(req.tenantId!) };
    });

    scope.post("/admin/tenants/:slug/blacklist", async (req, reply) => {
      const body = req.body as { external_id?: string; reason?: string };
      const raw = body?.external_id?.trim();
      if (!raw) return reply.code(400).send({ error: "external_id required" });
      // telefone entra em qualquer formato; slug LinkedIn passa direto.
      const externalId = normalizeBrazilPhone(raw) ?? raw;
      const reason = body.reason === "bounced" ? "bounced" : "manual";
      await addToBlacklist(req.tenantId!, externalId, reason, "manual");
      logger.info({ tenant: req.tenantSlug, externalId, reason }, "admin: blacklist add");
      return reply.send({ ok: true, external_id: externalId });
    });

    scope.delete("/admin/tenants/:slug/blacklist/:externalId", async (req, reply) => {
      const { externalId } = req.params as { externalId: string };
      await removeFromBlacklist(req.tenantId!, externalId);
      logger.info({ tenant: req.tenantSlug, externalId }, "admin: blacklist remove");
      return reply.send({ ok: true });
    });

    scope.post("/admin/tenants/:slug/campaigns/:id/preview", async (req, reply) => {
      const campaignId = Number((req.params as { id: string }).id);
      const campaign = await getCampaign(req.tenantId!, campaignId);
      if (!campaign) return reply.code(404).send({ error: "campaign not found" });
      const body = req.body as { limit?: number };
      const limit = Math.min(Math.max(1, body?.limit ?? 3), 5);
      const prospects = await listProspects(campaignId, { status: "pending", limit });
      const previews = await Promise.all(
        prospects.map(async (p) => ({
          prospect: { id: p.id, nome: p.nome, empresa: p.empresa, external_id: p.external_id },
          message: await composeMessage(campaign, p),
        })),
      );
      return reply.send({ previews });
    });

    scope.post("/admin/tenants/:slug/campaigns/:id/start", async (req, reply) => {
      const campaignId = Number((req.params as { id: string }).id);
      const c = await getCampaign(req.tenantId!, campaignId);
      if (!c) return reply.code(404).send({ error: "campaign not found" });
      try {
        await startCampaign(req.tenantId!, campaignId);
        logger.info({ tenant: req.tenantSlug, campaignId }, "admin: campaign started");
        return reply.send({ ok: true });
      } catch (err) {
        return reply.code(500).send({ error: String(err) });
      }
    });

    scope.post("/admin/tenants/:slug/campaigns/:id/pause", async (req, reply) => {
      const campaignId = Number((req.params as { id: string }).id);
      const c = await getCampaign(req.tenantId!, campaignId);
      if (!c) return reply.code(404).send({ error: "campaign not found" });
      await pauseCampaign(campaignId);
      logger.info({ tenant: req.tenantSlug, campaignId }, "admin: campaign paused");
      return reply.send({ ok: true });
    });
  });

  // ===== Acoes a nivel de prospect (id global) — exige autenticacao =====
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);

    scope.post("/admin/prospects/:id/mark-sent", async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      const p = await getProspect(id);
      if (!p) return reply.code(404).send({ error: "not found" });
      await updateProspect(id, { status: "sent", sent_at: new Date() });
      await logProspectEvent(id, "marked_sent_manually");
      return reply.send({ ok: true });
    });

    scope.post("/admin/prospects/:id/skip", async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      const body = req.body as { reason?: string };
      await updateProspect(id, { status: "skipped", skip_reason: body?.reason ?? "manual" });
      await logProspectEvent(id, "skipped_manually", { reason: body?.reason });
      return reply.send({ ok: true });
    });
  });
}
