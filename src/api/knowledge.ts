import type { FastifyInstance } from "fastify";
import { logger } from "../core/logger.js";
import {
  createDocument,
  deleteDocument,
  getDocument,
  ingestDocument,
  listDocuments,
  type KnowledgeSourceType,
} from "../core/knowledge.js";

export async function registerKnowledgeRoutes(app: FastifyInstance) {
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);
    scope.addHook("preHandler", scope.requireTenant);

    // Lista documentos da base de conhecimento do tenant.
    scope.get("/admin/tenants/:slug/knowledge", async (req) => {
      return { documents: await listDocuments(req.tenantId!) };
    });

    // Adiciona um documento e dispara a indexação (chunk + embed) inline.
    scope.post("/admin/tenants/:slug/knowledge", async (req, reply) => {
      const body = req.body as {
        title?: string;
        description?: string;
        source_type?: string;
        content?: string;
      };
      const title = (body?.title ?? "").trim();
      const content = (body?.content ?? "").trim();
      if (!title) return reply.code(400).send({ error: "title required" });
      if (!content) return reply.code(400).send({ error: "content required" });
      const sourceType: KnowledgeSourceType = body.source_type === "csv" ? "csv" : "text";

      const doc = await createDocument({
        tenantId: req.tenantId!,
        title,
        description: (body.description ?? "").trim(),
        sourceType,
        rawContent: content,
      });

      // Indexa de forma síncrona (embeddings em lote são rápidos). Se falhar,
      // o doc fica 'failed' e o cliente pode reindexar.
      try {
        await ingestDocument(req.tenantId!, doc.id);
      } catch (err) {
        logger.error({ err, tenant: req.tenantSlug, docId: doc.id }, "knowledge ingest failed");
      }
      const updated = await getDocument(req.tenantId!, doc.id);
      return reply.send({ document: updated });
    });

    // Reindexar (re-chunk + re-embed) — útil se mudar o conteúdo ou após falha.
    scope.post("/admin/tenants/:slug/knowledge/:id/reindex", async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      const doc = await getDocument(req.tenantId!, id);
      if (!doc) return reply.code(404).send({ error: "not found" });
      try {
        await ingestDocument(req.tenantId!, id);
      } catch {
        /* status já foi marcado como failed */
      }
      return reply.send({ document: await getDocument(req.tenantId!, id) });
    });

    scope.delete("/admin/tenants/:slug/knowledge/:id", async (req) => {
      const id = Number((req.params as { id: string }).id);
      await deleteDocument(req.tenantId!, id);
      return { ok: true };
    });
  });
}
