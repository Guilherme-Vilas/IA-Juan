import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Lê os .md do diretório do tenant a cada acesso — edições refletem na próxima
 * mensagem sem reiniciar o container. Custo desprezível (4 arquivos pequenos).
 * Em produção real dá pra trocar por cache mtime se preferir.
 */
function read(dir: string, name: string): string {
  return fs.readFileSync(path.join(here, dir, name), "utf8");
}

export type TenantPrompts = {
  system: string;
  knowledge: string;
  objections: string;
  examples: string;
};

export function promptsFor(tenantPromptDir: string): TenantPrompts {
  return {
    get system() {
      return read(tenantPromptDir, "system.md");
    },
    get knowledge() {
      return read(tenantPromptDir, "knowledge.md");
    },
    get objections() {
      return read(tenantPromptDir, "objections.md");
    },
    get examples() {
      return read(tenantPromptDir, "examples.md");
    },
  };
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
