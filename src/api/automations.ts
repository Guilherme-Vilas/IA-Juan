import type { FastifyInstance } from "fastify";
import {
  listAutomations,
  getAutomation,
  createAutomation,
  updateAutomation,
  setAutomationEnabled,
  deleteAutomation,
  type AutomationInput,
} from "../core/automations.js";

export async function registerAutomationRoutes(app: FastifyInstance) {
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);
    scope.addHook("preHandler", scope.requireTenant);

    scope.get("/admin/tenants/:slug/automations", async (req) => {
      return { automations: await listAutomations(req.tenantId!) };
    });

    scope.get("/admin/tenants/:slug/automations/:id", async (req, reply) => {
      const { id } = req.params as { slug: string; id: string };
      const a = await getAutomation(req.tenantId!, Number(id));
      if (!a) return reply.code(404).send({ error: "automação não encontrada" });
      return { automation: a };
    });

    scope.post("/admin/tenants/:slug/automations", async (req, reply) => {
      const body = req.body as AutomationInput;
      if (!body?.name?.trim() || !body?.trigger_type) {
        return reply.code(400).send({ error: "name e trigger_type obrigatórios" });
      }
      const id = await createAutomation(req.tenantId!, body);
      return reply.code(201).send({ id });
    });

    scope.patch("/admin/tenants/:slug/automations/:id", async (req, reply) => {
      const { id } = req.params as { slug: string; id: string };
      const body = req.body as AutomationInput;
      if (!body?.name?.trim() || !body?.trigger_type) {
        return reply.code(400).send({ error: "name e trigger_type obrigatórios" });
      }
      const ok = await updateAutomation(req.tenantId!, Number(id), body);
      if (!ok) return reply.code(404).send({ error: "automação não encontrada" });
      return { ok: true };
    });

    scope.post("/admin/tenants/:slug/automations/:id/toggle", async (req, reply) => {
      const { id } = req.params as { slug: string; id: string };
      const body = req.body as { enabled?: boolean };
      const ok = await setAutomationEnabled(req.tenantId!, Number(id), body?.enabled ?? true);
      if (!ok) return reply.code(404).send({ error: "automação não encontrada" });
      return { ok: true };
    });

    scope.delete("/admin/tenants/:slug/automations/:id", async (req, reply) => {
      const { id } = req.params as { slug: string; id: string };
      const ok = await deleteAutomation(req.tenantId!, Number(id));
      if (!ok) return reply.code(404).send({ error: "automação não encontrada" });
      return { ok: true };
    });
  });
}
