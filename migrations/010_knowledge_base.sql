-- Base de conhecimento (RAG): documentos do cliente + chunks com embedding.
-- MVP sem pgvector: embedding como real[] (float4). Similaridade por cosseno em JS.
-- Upgrade pra pgvector quando o volume por tenant passar de alguns milhares de chunks.

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  source_type  TEXT NOT NULL DEFAULT 'text' CHECK (source_type IN ('text','csv')),
  raw_content  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','indexing','ready','failed')),
  chunk_count  INTEGER NOT NULL DEFAULT 0,
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_tenant ON knowledge_documents (tenant_id);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id           BIGSERIAL PRIMARY KEY,
  document_id  BIGINT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  tenant_id    BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  embedding    REAL[] NOT NULL,
  token_est    INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Retrieval filtra sempre por tenant; index ajuda a varrer só os chunks do tenant.
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tenant ON knowledge_chunks (tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks (document_id);
