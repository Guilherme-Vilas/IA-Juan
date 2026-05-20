import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Lê os .md a cada acesso — assim edições nos prompts refletem na próxima mensagem
 * sem precisar reiniciar o container. Custo é desprezível (4 arquivos pequenos).
 * Em produção de verdade dá pra trocar por cache com mtime-check se preferir.
 */
function read(name: string): string {
  return fs.readFileSync(path.join(here, name), "utf8");
}

export const prompts = {
  get system() {
    return read("system.md");
  },
  get knowledge() {
    return read("knowledge.md");
  },
  get objections() {
    return read("objections.md");
  },
  get examples() {
    return read("examples.md");
  },
};

/**
 * Retorna só as seções relevantes para o estado atual,
 * pra manter o prompt enxuto e evitar rate limit.
 */
export function contextFor(state: string): string {
  switch (state) {
    case "S0_ABERTURA":
    case "S1_DESCOBERTA":
      // diagnóstico: sistema é suficiente (já tem framework comprador/investidor)
      return "";
    case "S2_QUALIFICACAO":
      // qualificação: precisa das faixas e heurísticas
      return extractSection(prompts.knowledge, "## 3. Como ler capacidade mensal");
    case "S3_EDUCACAO":
      // objeções + recomendação por perfil
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
