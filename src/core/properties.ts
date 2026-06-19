import { pool } from "./db.js";
import { logger } from "./logger.js";

export type PropertyTransaction = "venda" | "locacao";
export type PropertyStatus = "disponivel" | "reservado" | "vendido" | "inativo";

export type PropertyRow = {
  id: number;
  tenant_id: number;
  ref: string;
  title: string;
  description: string;
  transaction: PropertyTransaction;
  type: string;
  status: PropertyStatus;
  price_cents: number | null;
  condo_cents: number | null;
  iptu_cents: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  suites: number | null;
  parking: number | null;
  area_m2: number | null;
  neighborhood: string;
  city: string;
  state: string;
  address: string;
  features: string[];
  photos: string[];
  created_at: Date;
  updated_at: Date;
};

export type PropertyInput = Partial<Omit<PropertyRow, "id" | "tenant_id" | "created_at" | "updated_at">> & {
  title: string;
};

const COLS = [
  "ref",
  "title",
  "description",
  "transaction",
  "type",
  "status",
  "price_cents",
  "condo_cents",
  "iptu_cents",
  "bedrooms",
  "bathrooms",
  "suites",
  "parking",
  "area_m2",
  "neighborhood",
  "city",
  "state",
  "address",
  "features",
  "photos",
] as const;

function toParams(input: PropertyInput): unknown[] {
  return COLS.map((c) => {
    const v = (input as Record<string, unknown>)[c];
    if (c === "features" || c === "photos") return JSON.stringify(Array.isArray(v) ? v : []);
    return v ?? null;
  });
}

export async function countProperties(tenantId: number): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM properties WHERE tenant_id = $1`,
    [tenantId],
  );
  return Number(rows[0]?.n ?? "0");
}

export async function listProperties(tenantId: number, limit = 500): Promise<PropertyRow[]> {
  const { rows } = await pool.query<PropertyRow>(
    `SELECT * FROM properties WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT $2`,
    [tenantId, limit],
  );
  return rows;
}

export async function createProperty(tenantId: number, input: PropertyInput): Promise<PropertyRow> {
  const params = toParams(input);
  const placeholders = COLS.map((_, i) => `$${i + 2}`).join(",");
  const { rows } = await pool.query<PropertyRow>(
    `INSERT INTO properties (tenant_id, ${COLS.join(",")}) VALUES ($1, ${placeholders}) RETURNING *`,
    [tenantId, ...params],
  );
  return rows[0]!;
}

export async function updateProperty(
  tenantId: number,
  id: number,
  input: PropertyInput,
): Promise<boolean> {
  const sets = COLS.map((c, i) => `${c} = $${i + 3}`).join(",");
  const { rowCount } = await pool.query(
    `UPDATE properties SET ${sets}, updated_at = now() WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId, ...toParams(input)],
  );
  return (rowCount ?? 0) > 0;
}

// Upsert por codigo (ref): se ja existe imovel com aquele ref no tenant, atualiza;
// senao cria. Sem ref -> sempre cria. Usado pela agregacao de documentos.
export async function upsertProperty(
  tenantId: number,
  input: PropertyInput,
): Promise<"created" | "updated"> {
  const ref = (input.ref ?? "").trim();
  if (ref) {
    const existing = await pool.query<{ id: number }>(
      `SELECT id FROM properties WHERE tenant_id = $1 AND ref = $2 LIMIT 1`,
      [tenantId, ref],
    );
    if (existing.rows[0]) {
      await updateProperty(tenantId, existing.rows[0].id, input);
      return "updated";
    }
  }
  await createProperty(tenantId, input);
  return "created";
}

export async function deleteProperty(tenantId: number, id: number): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM properties WHERE id = $1 AND tenant_id = $2`, [
    id,
    tenantId,
  ]);
  return (rowCount ?? 0) > 0;
}

// ===== Busca (match da IA) =====
export type PropertySearch = {
  transaction?: PropertyTransaction;
  type?: string;
  max_price_cents?: number;
  min_bedrooms?: number;
  parking?: number;
  city?: string;
  neighborhood?: string;
  limit?: number;
};

export async function searchProperties(tenantId: number, s: PropertySearch): Promise<PropertyRow[]> {
  const where: string[] = [`tenant_id = $1`, `status = 'disponivel'`];
  const params: unknown[] = [tenantId];
  const add = (clause: string, val: unknown) => {
    params.push(val);
    where.push(clause.replace("$$", `$${params.length}`));
  };
  if (s.transaction) add(`transaction = $$`, s.transaction);
  if (s.type) add(`type ILIKE $$`, `%${s.type}%`);
  if (s.max_price_cents) add(`(price_cents IS NULL OR price_cents <= $$)`, s.max_price_cents);
  if (s.min_bedrooms) add(`(bedrooms IS NULL OR bedrooms >= $$)`, s.min_bedrooms);
  if (s.parking) add(`(parking IS NULL OR parking >= $$)`, s.parking);
  if (s.city) add(`city ILIKE $$`, `%${s.city}%`);
  if (s.neighborhood) add(`neighborhood ILIKE $$`, `%${s.neighborhood}%`);
  params.push(Math.min(s.limit ?? 4, 10));
  const { rows } = await pool.query<PropertyRow>(
    `SELECT * FROM properties WHERE ${where.join(" AND ")}
      ORDER BY price_cents ASC NULLS LAST LIMIT $${params.length}`,
    params,
  );
  return rows;
}

// Resumo compacto pra IA apresentar (sem despejar tudo no contexto).
export function summarizeForAgent(rows: PropertyRow[]): string {
  if (rows.length === 0) return "nenhum_imovel_encontrado";
  return JSON.stringify(
    rows.map((p) => ({
      ref: p.ref || String(p.id),
      titulo: p.title,
      bairro: p.neighborhood,
      cidade: p.city,
      quartos: p.bedrooms,
      vagas: p.parking,
      area_m2: p.area_m2,
      preco: p.price_cents != null ? `R$ ${(p.price_cents / 100).toLocaleString("pt-BR")}` : "consultar",
      transacao: p.transaction,
    })),
  );
}

// ===== Import CSV =====
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }
  return rows;
}

export function moneyToCents(v: string): number | null {
  const clean = v.replace(/[^0-9.,]/g, "").trim();
  if (!clean) return null;
  // formato BR "450.000,00" -> remove pontos, troca virgula por ponto
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isNaN(n) ? null : Math.round(n * 100);
}

export function intOrNull(v: string): number | null {
  const n = parseInt(v.replace(/[^0-9-]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

// Mapa de cabecalhos aceitos (pt/en) -> campo interno.
const HEADER_MAP: Record<string, keyof PropertyInput> = {
  ref: "ref",
  codigo: "ref",
  título: "title",
  titulo: "title",
  title: "title",
  descricao: "description",
  descrição: "description",
  description: "description",
  transacao: "transaction",
  transação: "transaction",
  transaction: "transaction",
  tipo: "type",
  type: "type",
  status: "status",
  preco: "price_cents",
  preço: "price_cents",
  price: "price_cents",
  valor: "price_cents",
  condominio: "condo_cents",
  condomínio: "condo_cents",
  iptu: "iptu_cents",
  quartos: "bedrooms",
  bedrooms: "bedrooms",
  dormitorios: "bedrooms",
  banheiros: "bathrooms",
  bathrooms: "bathrooms",
  suites: "suites",
  suítes: "suites",
  vagas: "parking",
  garagem: "parking",
  parking: "parking",
  area: "area_m2",
  área: "area_m2",
  area_m2: "area_m2",
  bairro: "neighborhood",
  neighborhood: "neighborhood",
  cidade: "city",
  city: "city",
  estado: "state",
  uf: "state",
  state: "state",
  endereco: "address",
  endereço: "address",
  address: "address",
};

const MONEY_FIELDS = new Set(["price_cents", "condo_cents", "iptu_cents"]);
const INT_FIELDS = new Set(["bedrooms", "bathrooms", "suites", "parking"]);

export async function importPropertiesCsv(
  tenantId: number,
  csv: string,
): Promise<{ imported: number; skipped: number }> {
  const rows = parseCsv(csv);
  if (rows.length < 2) return { imported: 0, skipped: 0 };
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  let imported = 0;
  let skipped = 0;

  for (const r of rows.slice(1)) {
    const input: Record<string, unknown> = {};
    header.forEach((h, idx) => {
      const field = HEADER_MAP[h];
      if (!field) return;
      const raw = (r[idx] ?? "").trim();
      if (raw === "") return;
      if (MONEY_FIELDS.has(field)) input[field] = moneyToCents(raw);
      else if (INT_FIELDS.has(field)) input[field] = intOrNull(raw);
      else if (field === "area_m2") input[field] = Number(raw.replace(",", ".")) || null;
      else input[field] = raw;
    });
    if (!input.title) {
      skipped++;
      continue;
    }
    try {
      await createProperty(tenantId, input as PropertyInput);
      imported++;
    } catch (err) {
      logger.warn({ err, tenantId }, "properties: csv row import failed");
      skipped++;
    }
  }
  logger.info({ tenantId, imported, skipped }, "properties: csv imported");
  return { imported, skipped };
}
