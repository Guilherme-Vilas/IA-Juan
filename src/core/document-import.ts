import * as XLSX from "xlsx";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { logger } from "./logger.js";
import { extractJson } from "./llm.js";
import {
  upsertProperty,
  moneyToCents,
  intOrNull,
  type PropertyInput,
  type PropertyTransaction,
} from "./properties.js";

// Importador UNIVERSAL: recebe CSV / Excel / PDF / link de planilha e usa a IA
// pra normalizar os dados (cada empreendimento manda num layout diferente) pros
// campos do catalogo, agregando por codigo (ref).

export type ImportResult = { found: number; imported: number; updated: number; skipped: number };

// Campos do CRM que a IA mapeia (price/condo/iptu em reais -> cents).
const FIELDS = [
  "ref",
  "title",
  "description",
  "transaction",
  "type",
  "price",
  "condo",
  "iptu",
  "bedrooms",
  "bathrooms",
  "suites",
  "parking",
  "area_m2",
  "neighborhood",
  "city",
  "state",
  "address",
] as const;

function normTransaction(v: string): PropertyTransaction {
  return /alug|loca|rent/i.test(v) ? "locacao" : "venda";
}

// ===== Parsing por formato =====
type Parsed = { kind: "rows"; rows: Record<string, string>[] } | { kind: "text"; text: string };

async function parseDocument(filename: string, buf: Buffer): Promise<Parsed> {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") {
    const data = await pdfParse(buf);
    return { kind: "text", text: data.text ?? "" };
  }
  // csv, tsv, xlsx, xls -> SheetJS (le todos os formatos tabulares).
  const wb = XLSX.read(buf, { type: "buffer", raw: false });
  const sheetName = wb.SheetNames[0];
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) return { kind: "rows", rows: [] };
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const rows = raw.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) out[String(k).trim()] = String(v ?? "");
    return out;
  });
  return { kind: "rows", rows };
}

// ===== Tabular: a IA infere o mapeamento coluna->campo (1 chamada), aplicamos a todas as linhas =====
async function inferMapping(
  headers: string[],
  samples: Record<string, string>[],
): Promise<Record<string, string | null>> {
  const sys =
    "Você mapeia colunas de uma planilha de imóveis para os campos de um CRM imobiliário. " +
    "Responda APENAS um objeto JSON {campo: \"nome_exato_da_coluna\" | null}.";
  const user = `Campos do CRM (chaves da resposta): ${FIELDS.join(", ")}

Significado:
- ref: código do imóvel; title: título/nome
- transaction: venda ou locação; type: apartamento/casa/terreno/comercial...
- price: preço de venda OU aluguel; condo: condomínio; iptu
- bedrooms: quartos/dormitórios; parking: vagas; area_m2: área
- neighborhood/city/state: bairro/cidade/UF; address: endereço

Colunas disponíveis (use o nome EXATO ou null se não houver):
${JSON.stringify(headers)}

Amostra das linhas:
${JSON.stringify(samples.slice(0, 3))}

Para cada campo do CRM, diga qual coluna corresponde (ou null).`;
  return extractJson<Record<string, string | null>>(
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { maxTokens: 800 },
  );
}

function rowToProperty(row: Record<string, string>, mapping: Record<string, string | null>): PropertyInput | null {
  const get = (field: string): string => {
    const col = mapping[field];
    return col && row[col] != null ? String(row[col]).trim() : "";
  };
  const title = get("title") || get("ref");
  if (!title) return null;
  const p: PropertyInput = { title };
  const ref = get("ref");
  if (ref) p.ref = ref;
  const desc = get("description");
  if (desc) p.description = desc;
  const tx = get("transaction");
  if (tx) p.transaction = normTransaction(tx);
  const type = get("type");
  if (type) p.type = type.toLowerCase();
  const price = get("price");
  if (price) p.price_cents = moneyToCents(price);
  const condo = get("condo");
  if (condo) p.condo_cents = moneyToCents(condo);
  const iptu = get("iptu");
  if (iptu) p.iptu_cents = moneyToCents(iptu);
  const bed = get("bedrooms");
  if (bed) p.bedrooms = intOrNull(bed);
  const bath = get("bathrooms");
  if (bath) p.bathrooms = intOrNull(bath);
  const suites = get("suites");
  if (suites) p.suites = intOrNull(suites);
  const park = get("parking");
  if (park) p.parking = intOrNull(park);
  const area = get("area_m2");
  if (area) p.area_m2 = Number(area.replace(",", ".")) || null;
  const nb = get("neighborhood");
  if (nb) p.neighborhood = nb;
  const city = get("city");
  if (city) p.city = city;
  const st = get("state");
  if (st) p.state = st.slice(0, 2).toUpperCase();
  const addr = get("address");
  if (addr) p.address = addr;
  return p;
}

// ===== Texto (PDF): a IA extrai a lista de imoveis direto =====
type RawProp = Record<string, unknown>;
function jsonToProperty(o: RawProp): PropertyInput | null {
  const title = String(o.title ?? o.titulo ?? o.ref ?? "").trim();
  if (!title) return null;
  const p: PropertyInput = { title };
  if (o.ref) p.ref = String(o.ref).trim();
  if (o.description) p.description = String(o.description);
  if (o.transaction) p.transaction = normTransaction(String(o.transaction));
  if (o.type) p.type = String(o.type).toLowerCase();
  if (o.price != null && o.price !== "") p.price_cents = moneyToCents(String(o.price));
  if (o.bedrooms != null && o.bedrooms !== "") p.bedrooms = intOrNull(String(o.bedrooms));
  if (o.bathrooms != null && o.bathrooms !== "") p.bathrooms = intOrNull(String(o.bathrooms));
  if (o.parking != null && o.parking !== "") p.parking = intOrNull(String(o.parking));
  if (o.area_m2 != null && o.area_m2 !== "") p.area_m2 = Number(String(o.area_m2).replace(",", ".")) || null;
  if (o.neighborhood) p.neighborhood = String(o.neighborhood);
  if (o.city) p.city = String(o.city);
  if (o.state) p.state = String(o.state).slice(0, 2).toUpperCase();
  return p;
}

async function extractFromText(text: string): Promise<PropertyInput[]> {
  const truncated = text.slice(0, 14000);
  const sys =
    "Você extrai imóveis de um texto (tabela de preços, ficha técnica ou folder de empreendimento). " +
    'Responda APENAS JSON no formato {"imoveis": [ ... ]}.';
  const user = `Extraia TODOS os imóveis do texto. Para cada um:
{ ref, title, transaction ("venda"|"locacao"), type, price (número em reais), bedrooms, bathrooms, parking, area_m2, neighborhood, city, state, description }
Omita campos ausentes. NÃO invente dados.

TEXTO:
${truncated}`;
  const out = await extractJson<{ imoveis?: RawProp[] }>(
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { maxTokens: 4000 },
  );
  const arr = Array.isArray(out.imoveis) ? out.imoveis : [];
  return arr.map(jsonToProperty).filter((p): p is PropertyInput => !!p);
}

// ===== Pipeline completo =====
export async function importDocument(
  tenantId: number,
  filename: string,
  buf: Buffer,
): Promise<ImportResult> {
  const parsed = await parseDocument(filename, buf);
  let candidates: PropertyInput[] = [];

  if (parsed.kind === "rows") {
    const rows = parsed.rows.filter((r) => Object.values(r).some((v) => String(v).trim() !== ""));
    if (rows.length) {
      const headers = Object.keys(rows[0]!);
      const mapping = await inferMapping(headers, rows);
      candidates = rows
        .map((r) => rowToProperty(r, mapping))
        .filter((p): p is PropertyInput => !!p);
    }
  } else {
    candidates = await extractFromText(parsed.text);
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  for (const c of candidates) {
    try {
      const r = await upsertProperty(tenantId, c);
      if (r === "created") imported++;
      else updated++;
    } catch (err) {
      logger.warn({ err, tenantId }, "doc-import: upsert falhou");
      skipped++;
    }
  }
  logger.info({ tenantId, filename, found: candidates.length, imported, updated, skipped }, "document imported");
  return { found: candidates.length, imported, updated, skipped };
}

// Link de planilha (Google Sheets publicado ou CSV direto).
function toFetchableUrl(url: string): string {
  const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) {
    const gid = url.match(/[#&?]gid=(\d+)/)?.[1] ?? "0";
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
  }
  return url;
}

export async function importFromUrl(tenantId: number, url: string): Promise<ImportResult> {
  const target = toFetchableUrl(url);
  const res = await fetch(target);
  if (!res.ok) throw new Error(`não consegui baixar a planilha (HTTP ${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const isXlsx = /\.xlsx?($|\?)/i.test(target);
  return importDocument(tenantId, isXlsx ? "planilha.xlsx" : "planilha.csv", buf);
}
