import { getTenantPrompts, type TenantPrompts } from "../../core/tenant-prompts.js";

export type { TenantPrompts };

// Carrega os prompts do tenant a partir do banco (com cache Redis).
// NAO le mais arquivos .md do filesystem em runtime — stateless e replicavel.
export async function loadPrompts(tenantId: number): Promise<TenantPrompts> {
  return getTenantPrompts(tenantId);
}

/**
 * Retorna só as seções relevantes para o estado atual,
 * pra manter o prompt enxuto e evitar rate limit.
 */
export function contextFor(prompts: TenantPrompts, state: string): string {
  switch (state) {
    case "S0_ABERTURA":
    case "S1_DESCOBERTA":
      return "";
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
