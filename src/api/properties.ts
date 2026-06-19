import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import {
  listProperties,
  createProperty,
  updateProperty,
  deleteProperty,
  importPropertiesCsv,
  type PropertyInput,
} from "../core/properties.js";
import { ensureIngestToken, getTenantByIngestToken } from "../core/ingest.js";
import { buildPropertyFeedXml } from "../core/property-feed.js";

function feedUrl(token: string): string {
  return `${config.PUBLIC_BASE_URL.replace(/\/$/, "")}/feed/${token}/imoveis.xml`;
}

export async function registerPropertyRoutes(app: FastifyInstance) {
  // ===== Gestao do catalogo (per-tenant, autenticado) =====
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);
    scope.addHook("preHandler", scope.requireTenant);

    scope.get("/admin/tenants/:slug/properties", async (req) => {
      return { properties: await listProperties(req.tenantId!) };
    });

    scope.post("/admin/tenants/:slug/properties", async (req, reply) => {
      const body = req.body as PropertyInput;
      if (!body?.title?.trim()) return reply.code(400).send({ error: "title obrigatório" });
      const created = await createProperty(req.tenantId!, body);
      return reply.code(201).send({ property: created });
    });

    scope.patch("/admin/tenants/:slug/properties/:id", async (req, reply) => {
      const { id } = req.params as { slug: string; id: string };
      const body = req.body as PropertyInput;
      if (!body?.title?.trim()) return reply.code(400).send({ error: "title obrigatório" });
      const ok = await updateProperty(req.tenantId!, Number(id), body);
      if (!ok) return reply.code(404).send({ error: "imóvel não encontrado" });
      return { ok: true };
    });

    scope.delete("/admin/tenants/:slug/properties/:id", async (req, reply) => {
      const { id } = req.params as { slug: string; id: string };
      const ok = await deleteProperty(req.tenantId!, Number(id));
      if (!ok) return reply.code(404).send({ error: "imóvel não encontrado" });
      return { ok: true };
    });

    scope.post("/admin/tenants/:slug/properties/import", async (req, reply) => {
      const body = req.body as { csv?: string };
      if (!body?.csv?.trim()) return reply.code(400).send({ error: "csv obrigatório" });
      const res = await importPropertiesCsv(req.tenantId!, body.csv);
      return { ok: true, ...res };
    });

    // URL do feed XML pra colar nos portais (ZAP/VivaReal/OLX).
    scope.get("/admin/tenants/:slug/properties/feed-url", async (req) => {
      const token = await ensureIngestToken(req.tenantId!);
      return { url: feedUrl(token) };
    });
  });

  // ===== Feed XML publico (portais puxam) =====
  app.get("/feed/:token/imoveis.xml", async (req, reply) => {
    const { token } = req.params as { token: string };
    const tenant = await getTenantByIngestToken(token);
    if (!tenant) return reply.code(404).send("not found");
    const properties = await listProperties(tenant.id, 2000);
    const xml = buildPropertyFeedXml(tenant, properties, new Date().toISOString());
    return reply.header("Content-Type", "application/xml; charset=utf-8").send(xml);
  });
}
