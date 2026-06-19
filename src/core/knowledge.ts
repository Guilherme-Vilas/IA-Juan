import { pool } from "./db.js";
import { logger } from "./logger.js";
import { embedTexts, embedQuery, cosineSimilarity } from "./embeddings.js";

export type KnowledgeDocStatus = "pending" | "indexing" | "ready" | "failed";
export type KnowledgeSourceType = "text" | "csv";

export type KnowledgeDocRow = {
  id: number;
  tenant_id: number;
  title: string;
  description: string;
  source_type: KnowledgeSourceType;
  raw_content: string;
  status: KnowledgeDocStatus;
  chunk_count: number;
  error_msg: string | null;
  created_at: Date;
  updated_at: Date;
};

// ===== Repo =====
export async function listDocuments(tenantId: number): Promise<KnowledgeDocRow[]> {
  const { rows } = await pool.query<KnowledgeDocRow>(
    `SELECT id, tenant_id, title, description, source_type, status, chunk_count, error_msg, created_at, updated_at, '' AS raw_content
       FROM knowledge_documents WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId],
  );
  return rows;
}

export async function getDocument(tenantId: number, id: number): Promise<KnowledgeDocRow | null> {
  const { rows } = await pool.query<KnowledgeDocRow>(
    `SELECT * FROM knowledge_documents WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );
  return rows[0] ?? null;
}

export async function createDocument(input: {
  tenantId: number;
  title: string;
  description: string;
  sourceType: KnowledgeSourceType;
  rawContent: string;
}): Promise<KnowledgeDocRow> {
  const { rows } = await pool.query<KnowledgeDocRow>(
    `INSERT INTO knowledge_documents (tenant_id, title, description, source_type, raw_content, status)
     VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
    [input.tenantId, input.title, input.description, input.sourceType, input.rawContent],
  );
  return rows[0]!;
}

export async function deleteDocument(tenantId: number, id: number): Promise<void> {
  await pool.query(`DELETE FROM knowledge_documents WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
}

async function setDocStatus(id: number, status: KnowledgeDocStatus, extra: { chunk_count?: number; error_msg?: string | null } = {}) {
  await pool.query(
    `UPDATE knowledge_documents
        SET status = $1, chunk_count = COALESCE($2, chunk_count), error_msg = $3, updated_at = now()
      WHERE id = $4`,
    [status, extra.chunk_count ?? null, extra.error_msg ?? null, id],
  );
}

// ===== Chunking =====
// Quebra o conteúdo em pedaços de ~ maxChars com leve overlap, respeitando
// quebras naturais (linhas/paragrafos). CSV: cada linha vira um chunk (+ header).
export function chunkContent(content: string, sourceType: KnowledgeSourceType): string[] {
  const text = content.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];

  if (sourceType === "csv") {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length <= 1) return lines;
    const header = lines[0]!;
    // Cada linha de dados vira um chunk contextualizado com o header.
    return lines.slice(1).map((row) => `${header}\n${row}`);
  }

  const MAX = 1200;
  const OVERLAP = 150;
  const paras = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if ((buf + "\n\n" + p).length > MAX && buf) {
      chunks.push(buf.trim());
      buf = buf.slice(Math.max(0, buf.length - OVERLAP)) + "\n\n" + p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  // Quebra paragrafos gigantes que sozinhos passam do MAX.
  const out: string[] = [];
  for (const c of chunks) {
    if (c.length <= MAX * 1.5) out.push(c);
    else for (let i = 0; i < c.length; i += MAX) out.push(c.slice(i, i + MAX));
  }
  return out.filter(Boolean);
}

// ===== Ingestão (chunk -> embed -> store). Síncrona; OpenAI embeda em lote. =====
export async function ingestDocument(tenantId: number, docId: number): Promise<void> {
  const doc = await getDocument(tenantId, docId);
  if (!doc) return;
  await setDocStatus(docId, "indexing");
  try {
    // Remove chunks antigos (reindex).
    await pool.query(`DELETE FROM knowledge_chunks WHERE document_id = $1`, [docId]);

    const chunks = chunkContent(doc.raw_content, doc.source_type);
    if (chunks.length === 0) {
      await setDocStatus(docId, "ready", { chunk_count: 0 });
      return;
    }
    const embeddings = await embedTexts(chunks);

    // Insere em lote.
    for (let i = 0; i < chunks.length; i++) {
      await pool.query(
        `INSERT INTO knowledge_chunks (document_id, tenant_id, content, embedding, token_est)
         VALUES ($1,$2,$3,$4,$5)`,
        [docId, tenantId, chunks[i], embeddings[i] ?? [], Math.ceil((chunks[i]?.length ?? 0) / 4)],
      );
    }
    await setDocStatus(docId, "ready", { chunk_count: chunks.length });
    logger.info({ tenantId, docId, chunks: chunks.length }, "knowledge: document indexed");
  } catch (err) {
    logger.error({ err, tenantId, docId }, "knowledge: ingest failed");
    await setDocStatus(docId, "failed", { error_msg: String((err as Error).message ?? err) });
    throw err;
  }
}

// ===== Retrieval — embeda a query, cosseno vs chunks do tenant, top-k. =====
export type RetrievedChunk = { content: string; score: number; title: string };

export async function retrieveRelevant(
  tenantId: number,
  query: string,
  k = 4,
  minScore = 0.25,
): Promise<RetrievedChunk[]> {
  if (!query.trim()) return [];
  const { rows } = await pool.query<{ content: string; embedding: number[]; title: string }>(
    `SELECT c.content, c.embedding, d.title
       FROM knowledge_chunks c
       JOIN knowledge_documents d ON d.id = c.document_id
      WHERE c.tenant_id = $1 AND d.status = 'ready'`,
    [tenantId],
  );
  if (rows.length === 0) return [];

  const qv = await embedQuery(query);
  if (qv.length === 0) return [];

  const scored = rows
    .map((r) => ({ content: r.content, title: r.title, score: cosineSimilarity(qv, r.embedding) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  return scored;
}

// Monta o bloco de contexto pra injetar no system prompt.
export function formatKnowledgeContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  // Trunca cada chunk pra limitar tokens (chunks podem ter ~1200 chars).
  const blocks = chunks
    .map((c, i) => `[${i + 1}] (${c.title})\n${c.content.slice(0, 800)}`)
    .join("\n\n");
  return "# Base de conhecimento (use só se for relevante)\n" + blocks;
}
