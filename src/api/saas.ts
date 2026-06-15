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
import { invalidateTenantsCache } from "../core/tenants.js";

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x).trim()).filter(Boolean);
}

export async function registerSaasRoutes(app: FastifyInstance) {
  // ===== Global: lista de playbooks (qualquer usuario autenticado) =====
  app.get("/admin/playbooks", { onRequest: [app.authenticate] }, async () => {
    return { playbooks: await listPlaybooks() };
  });

  // ===== Por tenant — escopo com auth + cross-check =====
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);
    scope.addHook("preHandler", scope.requireTenant);

    scope.patch("/admin/tenants/:slug/playbook", async (req, reply) => {
      const body = req.body as { playbook_slug?: string };
      const playbookSlug = String(body.playbook_slug ?? "").trim();
      if (!playbookSlug) return reply.code(400).send({ error: "playbook_slug required" });
      await setTenantPlaybook(req.tenantId!, playbookSlug);
      await invalidateTenantsCache();
      return { ok: true, playbook_slug: playbookSlug };
    });

    scope.get("/admin/tenants/:slug/agent-settings", async (req) => {
      return { settings: await getAgentSettings(req.tenantId!) };
    });

    scope.patch("/admin/tenants/:slug/agent-settings", async (req) => {
      const body = req.body as Record<string, unknown>;
      const saved = await upsertAgentSettings(req.tenantId!, {
        agent_name: String(body.agent_name ?? "Stella").trim() || "Stella",
        tone: String(body.tone ?? "").trim(),
        products: stringArray(body.products),
        regions: stringArray(body.regions),
        qualification_rules: String(body.qualification_rules ?? "").trim(),
        handoff_rules: String(body.handoff_rules ?? "").trim(),
      });
      return { settings: saved };
    });

    scope.get("/admin/tenants/:slug/working-hours", async (req) => {
      return { working_hours: await listWorkingHours(req.tenantId!) };
    });

    scope.patch("/admin/tenants/:slug/working-hours/:weekday", async (req, reply) => {
      const { weekday } = req.params as { slug: string; weekday: string };
      const n = Number(weekday);
      if (!Number.isInteger(n) || n < 1 || n > 7) return reply.code(400).send({ error: "invalid weekday" });
      const body = req.body as { start_time?: string; end_time?: string; active?: boolean };
      await upsertWorkingHour(req.tenantId!, n, {
        start_time: String(body.start_time ?? "09:00"),
        end_time: String(body.end_time ?? "18:00"),
        active: !!body.active,
      });
      return { ok: true };
    });

    scope.get("/admin/tenants/:slug/calendar-blocks", async (req) => {
      return { blocks: await listCalendarBlocks(req.tenantId!) };
    });

    scope.post("/admin/tenants/:slug/calendar-blocks", async (req, reply) => {
      const body = req.body as { starts_at?: string; ends_at?: string; reason?: string };
      if (!body.starts_at || !body.ends_at) return reply.code(400).send({ error: "starts_at and ends_at required" });
      const block = await createCalendarBlock(req.tenantId!, {
        starts_at: body.starts_at,
        ends_at: body.ends_at,
        reason: body.reason,
      });
      return { block };
    });

    scope.delete("/admin/tenants/:slug/calendar-blocks/:id", async (req) => {
      const { id } = req.params as { slug: string; id: string };
      await deleteCalendarBlock(req.tenantId!, Number(id));
      return { ok: true };
    });
  });
}
