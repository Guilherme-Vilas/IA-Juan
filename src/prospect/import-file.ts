import * as XLSX from "xlsx";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { logger } from "../core/logger.js";
import { extractJson } from "../core/llm.js";
import { normalizeBrazilPhone } from "./csv.js";
import type { ProspectInput } from "./repo.js";

// Importador UNIVERSAL de leads pra prospecção: recebe QUALQUER arquivo
// (CSV, Excel, PDF, TXT — em qualquer layout) e usa a IA pra achar os
// contatos. Mesmo motor do importador de imóveis:
//   - Tabular (xlsx/xls/csv/tsv): a IA infere o mapeamento coluna→campo em
//     UMA chamada; aplicamos o mapeamento localmente a todas as linhas
//     (escala pra milhares de linhas sem custo por linha).
//   - Texto corrido (pdf/txt): a IA extrai os contatos do texto.

export type FileImportParse = {
  prospects: ProspectInput[];
  invalid: Array<{ row: number; reason: string }>;
  /** mapeamento detectado (tabular) — mostrado na UI pra conferência */
  mapping: Record<string, string | null> | null;
  found: number;
};

const LEAD_FIELDS = ["telefone", "nome", "empresa", "cargo", "email"] as const;

type Parsed = { kind: "rows"; rows: Record<string, string>[] } | { kind: "text"; text: string };

async function parseFile(filename: string, buf: Buffer): Promise<Parsed> {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") {
    const data = await pdfParse(buf);
    return { kind: "text", text: data.text ?? "" };
  }
  if (ext === "txt") {
    return { kind: "text", text: buf.toString("utf8") };
  }
  // csv, tsv, xlsx, xls e afins — SheetJS lê todos os tabulares.
  const wb = XLSX.read(buf, { type: "buffer", raw: false });
  const sheetName = wb.SheetNames[0];
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) return { kind: "rows", rows: [] };
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const rows = raw.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) out[String(k).trim()] = String(v ?? "").trim();
    return out;
  });
  return { kind: "rows", rows };
}

// Tabular: 1 chamada de IA descobre qual coluna é o quê.
async function inferLeadMapping(
  headers: string[],
  samples: Record<string, string>[],
): Promise<Record<string, string | null>> {
  const sys =
    "Você mapeia colunas de uma planilha de contatos/leads para campos de um CRM. " +
    'Responda APENAS um objeto JSON {campo: "nome_exato_da_coluna" | null}.';
  const user = `Campos (chaves da resposta): ${LEAD_FIELDS.join(", ")}

Significado:
- telefone: celular/WhatsApp da pessoa (prioridade: celular > fixo)
- nome: nome da PESSOA de contato (não da empresa)
- empresa: nome da empresa/organização
- cargo: cargo/função da pessoa
- email: e-mail de contato

Colunas da planilha: ${headers.join(" | ")}

Amostra (3 linhas):
${JSON.stringify(samples.slice(0, 3), null, 2)}

Use null quando não existir coluna correspondente. Use o nome EXATO da coluna.`;
  return extractJson<Record<string, string | null>>(
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { temperature: 0, maxTokens: 300, tag: "prospect-import-mapping" },
  );
}

// Texto corrido: a IA extrai os contatos direto.
async function extractLeadsFromText(text: string): Promise<Array<Record<string, string>>> {
  const clipped = text.slice(0, 14_000);
  const res = await extractJson<{ contatos?: Array<Record<string, string>> }>(
    [
      {
        role: "system",
        content:
          "Você extrai contatos (leads) de um texto bruto (lista, relatório, export de PDF). " +
          'Responda APENAS JSON: {"contatos": [{"telefone": "...", "nome": "...", "empresa": "...", "cargo": "..."}]}. ' +
          "telefone é obrigatório em cada contato (com DDD, só dígitos se possível); os demais campos são opcionais. " +
          "Não invente dados — extraia apenas o que está no texto.",
      },
      { role: "user", content: clipped },
    ],
    { temperature: 0, maxTokens: 4000, tag: "prospect-import-text" },
  );
  return res?.contatos ?? [];
}

export async function parseProspectsFile(filename: string, buf: Buffer): Promise<FileImportParse> {
  const parsed = await parseFile(filename, buf);
  const prospects: ProspectInput[] = [];
  const invalid: Array<{ row: number; reason: string }> = [];
  const seen = new Set<string>();

  const push = (row: number, c: { telefone?: string; nome?: string; empresa?: string; cargo?: string; extras?: Record<string, string> }) => {
    const waId = c.telefone ? normalizeBrazilPhone(c.telefone) : null;
    if (!waId) {
      invalid.push({ row, reason: c.telefone ? `telefone inválido: ${c.telefone}` : "sem telefone" });
      return;
    }
    if (seen.has(waId)) {
      invalid.push({ row, reason: "telefone duplicado no arquivo" });
      return;
    }
    seen.add(waId);
    prospects.push({
      external_id: waId,
      nome: c.nome?.trim() || null,
      empresa: c.empresa?.trim() || null,
      cargo: c.cargo?.trim() || null,
      raw_csv: c.extras ?? {},
    });
  };

  if (parsed.kind === "rows") {
    const rows = parsed.rows.slice(0, 5_000);
    if (rows.length === 0) return { prospects: [], invalid: [], mapping: null, found: 0 };

    const headers = Object.keys(rows[0]!);
    const mapping = await inferLeadMapping(headers, rows);
    logger.info({ headers, mapping }, "prospect import: mapeamento inferido pela IA");

    const col = (field: (typeof LEAD_FIELDS)[number]): string | null => {
      const c = mapping[field];
      return c && headers.includes(c) ? c : null;
    };
    const telCol = col("telefone");
    if (!telCol) {
      throw new Error(
        "não encontrei uma coluna de telefone nesse arquivo — confira se a planilha tem os números de WhatsApp",
      );
    }
    const nomeCol = col("nome");
    const empCol = col("empresa");
    const cargoCol = col("cargo");
    const emailCol = col("email");
    const mapped = new Set([telCol, nomeCol, empCol, cargoCol, emailCol].filter(Boolean) as string[]);

    rows.forEach((r, i) => {
      // colunas não mapeadas viram variáveis extras do template ({{coluna}})
      const extras: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) {
        if (!mapped.has(k) && v) extras[k.toLowerCase().replace(/\s+/g, "_")] = v;
      }
      if (emailCol && r[emailCol]) extras["email"] = r[emailCol]!;
      push(i + 2, {
        telefone: r[telCol],
        nome: nomeCol ? r[nomeCol] : undefined,
        empresa: empCol ? r[empCol] : undefined,
        cargo: cargoCol ? r[cargoCol] : undefined,
        extras,
      });
    });
    return { prospects, invalid, mapping, found: rows.length };
  }

  // Texto corrido (PDF/TXT): extração direta pela IA.
  if (!parsed.text.trim()) return { prospects: [], invalid: [], mapping: null, found: 0 };
  const contacts = (await extractLeadsFromText(parsed.text)).slice(0, 500);
  contacts.forEach((c, i) =>
    push(i + 1, { telefone: c["telefone"], nome: c["nome"], empresa: c["empresa"], cargo: c["cargo"] }),
  );
  return { prospects, invalid, mapping: null, found: contacts.length };
}
