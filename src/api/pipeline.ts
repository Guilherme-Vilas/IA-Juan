import type { FastifyInstance } from "fastify";
import { logger } from "../core/logger.js";
import {
  CANONICAL_PHASES,
  getStages,
  replaceStages,
  moveLeadManual,
  returnLeadToAuto,
  listStageEvents,
  type StageInput,
} from "../core/pipeline.js";

export async function registerPipelineRoutes(app: FastifyInstance) {
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);
    scope.addHook("preHandler", scope.requireTenant);

    const userId = (req: { auth?: { kind: string; userId?: number } }): number | null =>
      req.auth?.kind === "user" ? req.auth.userId ?? null : null;

    // Pipeline atual (etapas) + fases canonicas disponiveis pro mapeamento.
    scope.get("/admin/tenants/:slug/pipeline", async (req) => {
      const stages = await getStages(req.tenantId!);
      return { stages, phases: CANONICAL_PHASES };
    });

    // Salva a pipeline inteira (criar/renomear/reordenar/recolorir/mapear/remover).
    scope.put("/admin/tenants/:slug/pipeline/stages", async (req, reply) => {
      const body = req.body as { stages?: StageInput[] };
      if (!Array.isArray(body?.stages)) {
        return reply.code(400).send({ error: "stages[] obrigatório" });
      }
      const clean = body.stages
        .filter((s) => s && typeof s.name === "string" && s.name.trim())
        .map((s) => ({
          id: s.id,
          name: s.name.trim(),
          color: s.color,
          trigger_state: s.trigger_state ?? null,
          is_won: s.is_won,
          is_lost: s.is_lost,
        }));
      const res = await replaceStages(req.tenantId!, clean);
      if (!res.ok) return reply.code(400).send({ error: res.error });
      logger.info({ tenant: req.tenantSlug, count: clean.length }, "pipeline: stages saved");
      return { ok: true, stages: await getStages(req.tenantId!) };
    });

    // Move manual (arraste no board).
    scope.post("/admin/tenants/:slug/leads/:waId/move", async (req, reply) => {
      const { waId } = req.params as { slug: string; waId: string };
      const body = req.body as { to_stage_id?: number; reason?: string };
      const to = Number(body?.to_stage_id);
      if (!to) return reply.code(400).send({ error: "to_stage_id obrigatório" });
      const res = await moveLeadManual(req.tenantId!, waId, to, {
        actorUserId: userId(req),
        reason: body?.reason,
      });
      if (!res.ok) return reply.code(400).send({ error: res.error });
      return { ok: true };
    });

    // Devolve o lead a automacao da IA.
    scope.post("/admin/tenants/:slug/leads/:waId/return-to-auto", async (req, reply) => {
      const { waId } = req.params as { slug: string; waId: string };
      const ok = await returnLeadToAuto(req.tenantId!, waId);
      if (!ok) return reply.code(404).send({ error: "lead not found" });
      return { ok: true };
    });

    // Timeline de transicoes do lead.
    scope.get("/admin/tenants/:slug/leads/:waId/stage-events", async (req) => {
      const { waId } = req.params as { slug: string; waId: string };
      return { events: await listStageEvents(req.tenantId!, waId) };
    });
  });
}
