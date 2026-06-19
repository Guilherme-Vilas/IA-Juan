import type { FastifyInstance } from "fastify";
import {
  listTenantMembers,
  assignLead,
  setLeadValue,
  setLeadDistribution,
  addNote,
  listNotes,
} from "../core/crm.js";
import { listFieldDefs, replaceFieldDefs, setLeadCustomFields, type FieldDefInput } from "../core/custom-fields.js";
import { createTask, listTasks, setTaskDone, deleteTask } from "../core/tasks.js";
import { ensureIngestToken, rotateIngestToken } from "../core/ingest.js";
import { pool } from "../core/db.js";
import { config } from "../config.js";

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

    // ===== Campos customizados =====
    scope.get("/admin/tenants/:slug/custom-fields", async (req) => {
      return { fields: await listFieldDefs(req.tenantId!) };
    });
    scope.put("/admin/tenants/:slug/custom-fields", async (req, reply) => {
      const body = req.body as { fields?: FieldDefInput[] };
      if (!Array.isArray(body?.fields)) return reply.code(400).send({ error: "fields[] obrigatório" });
      const res = await replaceFieldDefs(req.tenantId!, body.fields);
      if (!res.ok) return reply.code(400).send({ error: res.error });
      return { ok: true, fields: await listFieldDefs(req.tenantId!) };
    });
    scope.patch("/admin/tenants/:slug/leads/:waId/custom", async (req, reply) => {
      const { waId } = req.params as { slug: string; waId: string };
      const body = req.body as { values?: Record<string, unknown> };
      if (!body?.values || typeof body.values !== "object") {
        return reply.code(400).send({ error: "values{} obrigatório" });
      }
      const ok = await setLeadCustomFields(req.tenantId!, waId, body.values);
      if (!ok) return reply.code(404).send({ error: "lead not found" });
      return { ok: true };
    });

    // ===== Tarefas / lembretes =====
    scope.get("/admin/tenants/:slug/leads/:waId/tasks", async (req) => {
      const { waId } = req.params as { slug: string; waId: string };
      return { tasks: await listTasks(req.tenantId!, waId) };
    });
    scope.post("/admin/tenants/:slug/leads/:waId/tasks", async (req, reply) => {
      const { waId } = req.params as { slug: string; waId: string };
      const body = req.body as { title?: string; due_at?: string | null; assigned_user_id?: number | null };
      const res = await createTask(req.tenantId!, waId, {
        title: body?.title ?? "",
        due_at: body?.due_at ?? null,
        assigned_user_id: body?.assigned_user_id ?? null,
        created_by: userId(req),
      });
      if (!res.ok) return reply.code(400).send({ error: res.error });
      return { ok: true };
    });
    scope.post("/admin/tenants/:slug/tasks/:id/done", async (req, reply) => {
      const { id } = req.params as { slug: string; id: string };
      const body = req.body as { done?: boolean };
      const ok = await setTaskDone(req.tenantId!, Number(id), body?.done ?? true);
      if (!ok) return reply.code(404).send({ error: "task not found" });
      return { ok: true };
    });
    scope.delete("/admin/tenants/:slug/tasks/:id", async (req, reply) => {
      const { id } = req.params as { slug: string; id: string };
      const ok = await deleteTask(req.tenantId!, Number(id));
      if (!ok) return reply.code(404).send({ error: "task not found" });
      return { ok: true };
    });

    // ===== Captura de leads (token de ingestao + saudacao) =====
    scope.get("/admin/tenants/:slug/ingest", async (req) => {
      const token = await ensureIngestToken(req.tenantId!);
      const greet = await pool.query<{ capture_greeting: string }>(
        `SELECT capture_greeting FROM tenants WHERE id = $1`,
        [req.tenantId!],
      );
      return {
        token,
        url: `${config.PUBLIC_BASE_URL.replace(/\/$/, "")}/ingest/lead`,
        capture_greeting: greet.rows[0]?.capture_greeting ?? "",
      };
    });
    scope.post("/admin/tenants/:slug/ingest/rotate", async (req) => {
      return { token: await rotateIngestToken(req.tenantId!) };
    });
    scope.patch("/admin/tenants/:slug/ingest/greeting", async (req) => {
      const body = req.body as { capture_greeting?: string };
      await pool.query(`UPDATE tenants SET capture_greeting = $1, updated_at = now() WHERE id = $2`, [
        (body?.capture_greeting ?? "").slice(0, 1000),
        req.tenantId!,
      ]);
      const { invalidateTenantsCache } = await import("../core/tenants.js");
      await invalidateTenantsCache();
      return { ok: true };
    });
  });
}
