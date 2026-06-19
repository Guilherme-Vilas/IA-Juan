import type { FastifyInstance } from "fastify";
import {
  listTenantMembers,
  assignLead,
  setLeadValue,
  setLeadDistribution,
  addNote,
  listNotes,
} from "../core/crm.js";

export async function registerCrmRoutes(app: FastifyInstance) {
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);
    scope.addHook("preHandler", scope.requireTenant);

    const userId = (req: { auth?: { kind: string; userId?: number } }): number | null =>
      req.auth?.kind === "user" ? req.auth.userId ?? null : null;

    // Vendedores do tenant (pra seletor de responsavel).
    scope.get("/admin/tenants/:slug/members", async (req) => {
      return { members: await listTenantMembers(req.tenantId!) };
    });

    // Atribui (ou remove, user_id null) o vendedor responsavel.
    scope.post("/admin/tenants/:slug/leads/:waId/assign", async (req, reply) => {
      const { waId } = req.params as { slug: string; waId: string };
      const body = req.body as { user_id?: number | null };
      const res = await assignLead(req.tenantId!, waId, body?.user_id ?? null);
      if (!res.ok) return reply.code(400).send({ error: res.error });
      return { ok: true };
    });

    // Define o valor do negocio (em reais -> centavos).
    scope.post("/admin/tenants/:slug/leads/:waId/value", async (req, reply) => {
      const { waId } = req.params as { slug: string; waId: string };
      const body = req.body as { value?: number | null };
      const cents =
        body?.value == null || Number.isNaN(Number(body.value))
          ? null
          : Math.max(0, Math.round(Number(body.value) * 100));
      const ok = await setLeadValue(req.tenantId!, waId, cents);
      if (!ok) return reply.code(404).send({ error: "lead not found" });
      return { ok: true };
    });

    // Notas internas (nao vao pro WhatsApp).
    scope.get("/admin/tenants/:slug/leads/:waId/notes", async (req) => {
      const { waId } = req.params as { slug: string; waId: string };
      return { notes: await listNotes(req.tenantId!, waId) };
    });
    scope.post("/admin/tenants/:slug/leads/:waId/notes", async (req, reply) => {
      const { waId } = req.params as { slug: string; waId: string };
      const body = req.body as { body?: string };
      const res = await addNote(req.tenantId!, waId, userId(req), body?.body ?? "");
      if (!res.ok) return reply.code(400).send({ error: res.error });
      return { ok: true };
    });

    // Modo de distribuicao de leads novos.
    scope.patch("/admin/tenants/:slug/distribution", async (req, reply) => {
      const body = req.body as { mode?: string };
      if (body?.mode !== "manual" && body?.mode !== "round_robin") {
        return reply.code(400).send({ error: "mode inválido (manual|round_robin)" });
      }
      await setLeadDistribution(req.tenantId!, body.mode);
      return { ok: true, mode: body.mode };
    });
  });
}
