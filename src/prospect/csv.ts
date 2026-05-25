import type { ProspectInput } from "./repo.js";

// CSV parser minimalista — suporta quoted values com vírgulas internas e quotes escapados ("").
// Não pretende ser RFC 4180 completo (sem multi-linha em quoted), mas serve pra lista comum.
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return { headers: [], rows: [] };

  const lines = splitRespectingQuotes(normalized, "\n");
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]!);
    if (cells.length === 1 && cells[0]!.trim() === "") continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = (cells[j] ?? "").trim();
    }
    rows.push(row);
  }
  return { headers, rows };
}

function splitRespectingQuotes(text: string, sep: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuote && text[i + 1] === '"') {
        buf += '"';
        i++;
      } else {
        inQuote = !inQuote;
        buf += c;
      }
    } else if (c === sep && !inQuote) {
      out.push(buf);
      buf = "";
    } else {
      buf += c!;
    }
  }
  out.push(buf);
  return out;
}

function parseLine(line: string): string[] {
  const cells = splitRespectingQuotes(line, ",");
  return cells.map((c) => {
    let v = c;
    if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
      v = v.slice(1, -1).replace(/""/g, '"');
    }
    return v;
  });
}

// Normaliza telefone BR pro formato E.164 sem o "+" (ex: "5511999998888")
// Aceita: "11999998888", "(11) 99999-8888", "+55 11 99999-8888", etc
export function normalizeBrazilPhone(input: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return null;
  let d = digits;
  // remove zero internacional
  if (d.startsWith("00")) d = d.slice(2);
  // se já tem 55 na frente e total >= 12, ok
  if (d.startsWith("55") && d.length >= 12 && d.length <= 13) return d;
  // 10 ou 11 dígitos (DDD + numero): assume Brasil → prepende 55
  if (d.length === 10 || d.length === 11) return "55" + d;
  return null;
}

export type CsvParseResult = {
  prospects: ProspectInput[];
  invalid: Array<{ row: number; reason: string; raw: Record<string, string> }>;
  headers: string[];
};

// Espera headers: nome, telefone (whatsapp) OU linkedin_url (linkedin), empresa, cargo
// Qualquer outro header vai parar em raw_csv pra uso em template vars.
export function parseProspectsCsv(
  text: string,
  channel: "whatsapp" | "linkedin",
): CsvParseResult {
  const { headers, rows } = parseCsv(text);
  const prospects: ProspectInput[] = [];
  const invalid: CsvParseResult["invalid"] = [];

  const idField = channel === "whatsapp" ? "telefone" : "linkedin_url";

  if (!headers.includes(idField)) {
    return {
      prospects: [],
      invalid: [{ row: 0, reason: `coluna obrigatória ausente: ${idField}`, raw: {} }],
      headers,
    };
  }

  rows.forEach((row, i) => {
    const rawId = row[idField] ?? "";
    let externalId: string | null = null;
    if (channel === "whatsapp") {
      externalId = normalizeBrazilPhone(rawId);
      if (!externalId) {
        invalid.push({ row: i + 2, reason: "telefone inválido", raw: row });
        return;
      }
    } else {
      // LinkedIn: aceita URL completa ou só o slug, normaliza pro slug
      const slug = extractLinkedinSlug(rawId);
      if (!slug) {
        invalid.push({ row: i + 2, reason: "linkedin_url inválida", raw: row });
        return;
      }
      externalId = slug;
    }

    const raw_csv: Record<string, unknown> = {};
    for (const h of headers) {
      if (!["nome", "telefone", "empresa", "cargo", "linkedin_url"].includes(h)) {
        raw_csv[h] = row[h];
      }
    }

    prospects.push({
      external_id: externalId,
      nome: row["nome"] || null,
      empresa: row["empresa"] || null,
      cargo: row["cargo"] || null,
      raw_csv,
    });
  });

  return { prospects, invalid, headers };
}

function extractLinkedinSlug(input: string): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  // ex: https://www.linkedin.com/in/foo-bar-123/ → foo-bar-123
  const m = s.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (m) return m[1]!;
  // se já parece um slug solto (sem espaços, sem barras), aceita
  if (/^[A-Za-z0-9_.-]+$/.test(s)) return s;
  return null;
}
