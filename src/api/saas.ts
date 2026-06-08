import type { FastifyInstance } from "fastify";
import { getAgentSettings, upsertAgentSettings } from "../core/agent-settings.js";
import {
  createCalendarBlock,
  deleteCalendarBlock,
  listCalendarBlocks,
  listWorkingHours,
  upsertWorkingHour,
} from "../core/internal-calendar.js";
import { listPlaybooks, setTenantPlaybook } from "../core/playbooks.js";
import { getTenantBySlug, invalidateTenantsCache } from "../core/tenants.js";

function requireAdmin(token: string | undefined): boolean {
  const expected = process.env.ADMIN_API_TOKEN ?? "";
  return !!expected && token === expected;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x).trim()).filter(Boolean);
}

export async function registerSaasRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/admin/")) return;
    const token = (req.headers["x-admin-token"] as string | undefined) ?? "";
    if (!requireAdmin(token)) {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.get("/admin/playbooks", async () => {
    return { playbooks: await listPlaybooks() };
  });

  app.patch("/admin/tenants/:slug/playbook", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    const body = req.body as { playbook_slug?: string };
    const playbookSlug = String(body.playbook_slug ?? "").trim();
    if (!playbookSlug) return reply.code(400).send({ error: "playbook_slug required" });
    await setTenantPlaybook(tenant.id, playbookSlug);
    await invalidateTenantsCache();
    return { ok: true, playbook_slug: playbookSlug };
  });

  app.get("/admin/tenants/:slug/agent-settings", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    return { settings: await getAgentSettings(tenant.id), playbook_slug: tenant.playbook_slug };
  });

  app.patch("/admin/tenants/:slug/agent-settings", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    const body = req.body as Record<string, unknown>;
    const saved = await upsertAgentSettings(tenant.id, {
      agent_name: String(body.agent_name ?? "Stella").trim() || "Stella",
      tone: String(body.tone ?? "").trim(),
      products: stringArray(body.products),
      regions: stringArray(body.regions),
      qualification_rules: String(body.qualification_rules ?? "").trim(),
      handoff_rules: String(body.handoff_rules ?? "").trim(),
    });
    return { settings: saved };
  });

  app.get("/admin/tenants/:slug/working-hours", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    return { working_hours: await listWorkingHours(tenant.id) };
  });

  app.patch("/admin/tenants/:slug/working-hours/:weekday", async (req, reply) => {
    const { slug, weekday } = req.params as { slug: string; weekday: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    const n = Number(weekday);
    if (!Number.isInteger(n) || n < 1 || n > 7) return reply.code(400).send({ error: "invalid weekday" });
    const body = req.body as { start_time?: string; end_time?: string; active?: boolean };
    await upsertWorkingHour(tenant.id, n, {
      start_time: String(body.start_time ?? "09:00"),
      end_time: String(body.end_time ?? "18:00"),
      active: !!body.active,
    });
    return { ok: true };
  });

  app.get("/admin/tenants/:slug/calendar-blocks", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    return { blocks: await listCalendarBlocks(tenant.id) };
  });

  app.post("/admin/tenants/:slug/calendar-blocks", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    const body = req.body as { starts_at?: string; ends_at?: string; reason?: string };
    if (!body.starts_at || !body.ends_at) return reply.code(400).send({ error: "starts_at and ends_at required" });
    const block = await createCalendarBlock(tenant.id, {
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      reason: body.reason,
    });
    return { block };
  });

  app.delete("/admin/tenants/:slug/calendar-blocks/:id", async (req, reply) => {
    const { slug, id } = req.params as { slug: string; id: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    await deleteCalendarBlock(tenant.id, Number(id));
    return { ok: true };
  });
}
