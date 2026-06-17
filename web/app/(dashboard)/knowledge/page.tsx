import { Header } from "@/components/layout/header";
import { knowledgeApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";
import { KnowledgeHub } from "./_components/knowledge-hub";

export const dynamic = "force-dynamic";

type KnowledgeDoc = {
  id: number;
  title: string;
  description: string;
  source_type: "text" | "csv";
  status: "pending" | "indexing" | "ready" | "failed";
  chunk_count: number;
  error_msg: string | null;
  created_at: string;
};

export default async function KnowledgePage() {
  const tenant = await getCurrentTenant();
  let documents: KnowledgeDoc[] = [];
  let error: string | null = null;
  try {
    const data = (await knowledgeApi(tenant.slug).list()) as { documents: KnowledgeDoc[] };
    documents = data.documents;
  } catch (err) {
    error = String(err);
  }

  return (
    <>
      <Header
        title="Base de conhecimento"
        subtitle={`${tenant.name} · materiais que o agente consulta`}
      />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <KnowledgeHub tenantSlug={tenant.slug} initial={documents} error={error} />
      </div>
    </>
  );
}
