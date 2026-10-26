import { getTenantPrompts, type TenantPrompts } from "../../core/tenant-prompts.js";

export type { TenantPrompts };

// Carrega os prompts do tenant a partir do banco (com cache Redis).
// NAO le mais arquivos .md do filesystem em runtime — stateless e replicavel.
export async function loadPrompts(tenantId: number): Promise<TenantPrompts> {
  return getTenantPrompts(tenantId);
}

// Exemplos de conversa (few-shot) entram no começo da conversa, onde o estilo
// é definido — capados pra não estourar tokens. Antes, a aba "Exemplos" do
// painel NÃO entrava em nenhum turno (o cliente editava e nada mudava).
const EXAMPLES_CAP_CHARS = 6000;

function examplesBlock(prompts: TenantPrompts): string {
  const ex = (prompts.examples ?? "").trim();
  if (!ex) return "";
  const body = ex.length > EXAMPLES_CAP_CHARS ? ex.slice(0, EXAMPLES_CAP_CHARS) + "\n(…exemplos truncados)" : ex;
  return "## Exemplos de conversa — siga este estilo à risca\n" + body;
}

/**
 * Retorna só as seções relevantes para o estado atual,
 * pra manter o prompt enxuto e evitar rate limit.
 */
export function contextFor(
  prompts: TenantPrompts,
  state: string,
  opts: { campaignLead?: boolean } = {},
): string {
  switch (state) {
    case "S0_ABERTURA":
    case "S1_DESCOBERTA":
      // Lead de campanha NÃO recebe os exemplos de primeiro contato orgânico:
      // o few-shot de "Oi! Como posso te chamar?" ensina exatamente o
      // comportamento que as regras de campanha proíbem (re-saudação fria).
      return opts.campaignLead ? "" : examplesBlock(prompts);
    case "S2_QUALIFICACAO":
      return extractSection(prompts.knowledge, "## 3. Como ler capacidade mensal");
    case "S3_EDUCACAO":
      return (
        extractSection(prompts.knowledge, "## 2. Os dois perfis de lead") +
        "\n\n" +
        prompts.objections
      );
    case "S4_AGENDAMENTO":
    case "S5_CONFIRMADO":
      return "";
    default:
      return "";
  }
}

function extractSection(doc: string, startHeading: string, nextHeadingPattern = /^## /m): string {
  const idx = doc.indexOf(startHeading);
  if (idx === -1) return "";
  const rest = doc.slice(idx + startHeading.length);
  const nextIdx = rest.search(nextHeadingPattern);
  const section = nextIdx === -1 ? rest : rest.slice(0, nextIdx);
  return startHeading + section;
}
