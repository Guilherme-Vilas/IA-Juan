import type { FastifyInstance } from "fastify";
import { pool } from "../core/db.js";
import { logger } from "../core/logger.js";
import { requireSuperadmin } from "../auth/plugin.js";
import { invalidateTenantsCache } from "../core/tenants.js";

// Área de Treinamentos: catálogo GLOBAL de vídeos (um só pra plataforma),
// liberação POR TENANT (superadmin decide quem vê) e progresso POR USUÁRIO.

type VideoRow = {
  id: number;
  module: string;
  title: string;
  description: string;
  video_url: string;
  duration_min: number | null;
  position: number;
  published: boolean;
};

export async function registerTrainingRoutes(app: FastifyInstance) {
  // ===== Área do cliente (escopo do tenant) =====
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);
    scope.addHook("preHandler", scope.requireTenant);

    scope.get("/admin/tenants/:slug/training", async (req) => {
      const { rows: t } = await pool.query<{ training_enabled: boolean }>(
        `SELECT training_enabled FROM tenants WHERE id = $1`,
        [req.tenantId!],
      );
      const enabled = !!t[0]?.training_enabled;
      const isSuper = req.role === "superadmin" || req.role === "service";
      if (!enabled && !isSuper) return { enabled: false, videos: [], done: 0, total: 0 };

      const userId = req.auth?.kind === "user" ? req.auth.userId : null;
      const { rows: videos } = await pool.query<VideoRow & { completed: boolean }>(
        `SELECT v.id, v.module, v.title, v.description, v.video_url, v.duration_min, v.position, v.published,
                (p.user_id IS NOT NULL) AS completed
           FROM training_videos v
           LEFT JOIN training_progress p ON p.video_id = v.id AND p.user_id = $1
          WHERE v.published = true AND v.video_url <> ''
          ORDER BY v.position ASC, v.id ASC`,
        [userId],
      );
      const done = videos.filter((v) => v.completed).length;
      return { enabled, videos, done, total: videos.length };
    });

    scope.post("/admin/tenants/:slug/training/:videoId/complete", async (req, reply) => {
      if (req.auth?.kind !== "user") return reply.code(400).send({ error: "somente usuários" });
      const videoId = Number((req.params as { videoId: string }).videoId);
      await pool.query(
        `INSERT INTO training_progress (user_id, video_id) VALUES ($1,$2)
         ON CONFLICT (user_id, video_id) DO NOTHING`,
        [req.auth.userId, videoId],
      );
      return reply.send({ ok: true });
    });

    scope.delete("/admin/tenants/:slug/training/:videoId/complete", async (req, reply) => {
      if (req.auth?.kind !== "user") return reply.code(400).send({ error: "somente usuários" });
      const videoId = Number((req.params as { videoId: string }).videoId);
      await pool.query(`DELETE FROM training_progress WHERE user_id = $1 AND video_id = $2`, [
        req.auth.userId,
        videoId,
      ]);
      return reply.send({ ok: true });
    });

    // Liberação da área pro tenant — SÓ superadmin.
    scope.patch("/admin/tenants/:slug/training-access", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const body = req.body as { enabled?: boolean };
      await pool.query(`UPDATE tenants SET training_enabled = $1, updated_at = now() WHERE id = $2`, [
        !!body?.enabled,
        req.tenantId!,
      ]);
      await invalidateTenantsCache();
      logger.info({ tenant: req.tenantSlug, enabled: !!body?.enabled }, "training: acesso alterado");
      return reply.send({ ok: true, enabled: !!body?.enabled });
    });
  });

  // ===== Gerenciador do catálogo (global, SÓ superadmin) =====
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);

    scope.get("/admin/training/videos", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const { rows } = await pool.query<VideoRow>(
        `SELECT id, module, title, description, video_url, duration_min, position, published
           FROM training_videos ORDER BY position ASC, id ASC`,
      );
      return { videos: rows };
    });

    scope.post("/admin/training/videos", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const b = req.body as Partial<VideoRow>;
      if (!b?.module?.trim() || !b?.title?.trim()) {
        return reply.code(400).send({ error: "module e title são obrigatórios" });
      }
      const { rows } = await pool.query<VideoRow>(
        `INSERT INTO training_videos (module, title, description, video_url, duration_min, position, published)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6,0),COALESCE($7,false)) RETURNING *`,
        [
          b.module.trim(),
          b.title.trim(),
          b.description ?? "",
          b.video_url ?? "",
          b.duration_min ?? null,
          b.position,
          b.published,
        ],
      );
      return reply.send({ video: rows[0] });
    });

    scope.patch("/admin/training/videos/:id", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const id = Number((req.params as { id: string }).id);
      const b = req.body as Partial<VideoRow>;
      const allowed = ["module", "title", "description", "video_url", "duration_min", "position", "published"] as const;
      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;
      for (const k of allowed) {
        if (k in b) {
          fields.push(`${k} = $${i++}`);
          values.push(b[k]);
        }
      }
      if (!fields.length) return reply.code(400).send({ error: "nada pra atualizar" });
      values.push(id);
      await pool.query(
        `UPDATE training_videos SET ${fields.join(", ")}, updated_at = now() WHERE id = $${i}`,
        values,
      );
      return reply.send({ ok: true });
    });

    scope.delete("/admin/training/videos/:id", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const id = Number((req.params as { id: string }).id);
      await pool.query(`DELETE FROM training_videos WHERE id = $1`, [id]);
      return reply.send({ ok: true });
    });
  });
}
