import crypto from "node:crypto";
import { pool } from "./db.js";
import { logger } from "./logger.js";
import { config } from "../config.js";
import {
  createUserStrict,
  getUserByEmail,
  linkUserToTenant,
  EmailTakenError,
  type TenantRole,
} from "./users.js";
import { getTenantById, getTenantBySlug, type TenantRow } from "./tenants.js";
import {
  createTenantWithSeed,
  provisionEvolution,
  slugify,
  type ProvisionWhatsapp,
} from "./provisioning.js";

export type InviteType = "new_tenant" | "add_user";

export type InviteRow = {
  id: number;
  token_hash: string;
  type: InviteType;
  tenant_id: number | null;
  role: TenantRole;
  email: string | null;
  payload: Record<string, unknown>;
  note: string;
  expires_at: Date;
  used_at: Date | null;
  used_by_user: number | null;
  created_by: number | null;
  created_at: Date;
};

// ===== Token: cru so na URL; no banco guardamos o hash =====
function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function buildInviteUrl(rawToken: string): string {
  return `${config.APP_PUBLIC_URL.replace(/\/$/, "")}/invite/${rawToken}`;
}

// ===== Criar (superadmin) =====
export async function createInvite(input: {
  type: InviteType;
  tenant_slug?: string | null;
  role?: TenantRole;
  email?: string | null;
  note?: string;
  payload?: Record<string, unknown>;
  created_by?: number | null;
  ttl_days?: number;
}): Promise<{ invite: InviteRow; token: string; url: string }> {
  let tenantId: number | null = null;
  if (input.type === "add_user") {
    if (!input.tenant_slug) throw new Error("tenant_slug obrigatório para add_user");
    const tenant = await getTenantBySlug(input.tenant_slug);
    if (!tenant) throw new Error(`tenant não encontrado: ${input.tenant_slug}`);
    tenantId = tenant.id;
  }

  const ttlDays = input.ttl_days ?? config.INVITE_TTL_DAYS;
  const raw = crypto.randomBytes(32).toString("base64url");
  const token_hash = hashToken(raw);

  const { rows } = await pool.query<InviteRow>(
    `INSERT INTO invites (token_hash, type, tenant_id, role, email, payload, note, expires_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now() + ($8 || ' days')::interval, $9)
     RETURNING *`,
    [
      token_hash,
      input.type,
      tenantId,
      input.role ?? "owner",
      input.email?.trim()?.toLowerCase() || null,
      JSON.stringify(input.payload ?? {}),
      input.note?.trim() ?? "",
      String(ttlDays),
      input.created_by ?? null,
    ],
  );
  const invite = rows[0]!;
  logger.info({ id: invite.id, type: invite.type, by: input.created_by }, "invite created");
  return { invite, token: raw, url: buildInviteUrl(raw) };
}

// ===== Status derivado =====
export type InviteStatus = "valid" | "used" | "expired";
export function inviteStatus(row: Pick<InviteRow, "used_at" | "expires_at">): InviteStatus {
  if (row.used_at) return "used";
  if (new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  return "valid";
}

// ===== Validar (publico): info segura, sem vazar token/hash =====
export type InvitePublicInfo = {
  status: InviteStatus;
  type: InviteType;
  role: TenantRole;
  email: string | null;
  tenant: { slug: string; name: string } | null;
  expires_at: string;
};

export async function getInvitePublicInfo(rawToken: string): Promise<InvitePublicInfo | null> {
  const { rows } = await pool.query<InviteRow>(
    `SELECT * FROM invites WHERE token_hash = $1`,
    [hashToken(rawToken)],
  );
  const row = rows[0];
  if (!row) return null;
  let tenant: { slug: string; name: string } | null = null;
  if (row.tenant_id) {
    const t = await getTenantById(row.tenant_id);
    if (t) tenant = { slug: t.slug, name: t.name };
  }
  return {
    status: inviteStatus(row),
    type: row.type,
    role: row.role,
    email: row.email,
    tenant,
    expires_at: new Date(row.expires_at).toISOString(),
  };
}

// ===== Listar (superadmin) =====
export async function listInvites(): Promise<
  Array<{
    id: number;
    type: InviteType;
    role: TenantRole;
    email: string | null;
    note: string;
    status: InviteStatus;
    tenant: { slug: string; name: string } | null;
    expires_at: string;
    used_at: string | null;
    created_at: string;
  }>
> {
  const { rows } = await pool.query<
    InviteRow & { tenant_slug: string | null; tenant_name: string | null }
  >(
    `SELECT i.*, t.slug AS tenant_slug, t.name AS tenant_name
       FROM invites i
       LEFT JOIN tenants t ON t.id = i.tenant_id
      ORDER BY i.created_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    role: r.role,
    email: r.email,
    note: r.note,
    status: inviteStatus(r),
    tenant: r.tenant_slug ? { slug: r.tenant_slug, name: r.tenant_name ?? r.tenant_slug } : null,
    expires_at: new Date(r.expires_at).toISOString(),
    used_at: r.used_at ? new Date(r.used_at).toISOString() : null,
    created_at: new Date(r.created_at).toISOString(),
  }));
}

// ===== Revogar (superadmin): remove o convite =====
export async function revokeInvite(id: number): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM invites WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

// Reabre o convite (libera o claim) quando o aceite falha depois de reivindicado.
async function releaseClaim(id: number): Promise<void> {
  await pool.query(`UPDATE invites SET used_at = NULL, used_by_user = NULL WHERE id = $1`, [id]);
}

// ===== Aceitar (publico): consome o convite e cria a conta =====
export class InviteError extends Error {
  constructor(
    public code: "not_found" | "expired" | "used" | "invalid" | "email_taken" | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "InviteError";
  }
}

export type AcceptAccount = { name?: string; email: string; password: string };
export type AcceptCompany = {
  name: string;
  owner_whatsapp_e164: string;
  agent_name?: string;
  tone?: string;
  timezone?: string;
};

export type AcceptResult = {
  user: { id: number; email: string; name: string };
  tenant: { slug: string; name: string };
  whatsapp: ProvisionWhatsapp | null;
  provision_error: string | null;
  type: InviteType;
};

export async function acceptInvite(
  rawToken: string,
  body: { account: AcceptAccount; company?: AcceptCompany },
): Promise<AcceptResult> {
  const token_hash = hashToken(rawToken);

  // Lê o convite (sem reivindicar ainda) pra validar inputs antes de queimar o claim.
  const { rows } = await pool.query<InviteRow>(`SELECT * FROM invites WHERE token_hash = $1`, [token_hash]);
  const invite = rows[0];
  if (!invite) throw new InviteError("not_found", "convite não encontrado");
  const status = inviteStatus(invite);
  if (status === "used") throw new InviteError("used", "convite já utilizado");
  if (status === "expired") throw new InviteError("expired", "convite expirado");

  // Validações de input.
  const email = (body.account?.email ?? "").trim().toLowerCase();
  const password = body.account?.password ?? "";
  const name = (body.account?.name ?? "").trim();
  if (!email || !email.includes("@")) throw new InviteError("invalid", "email inválido");
  if (password.length < 8) throw new InviteError("invalid", "senha deve ter no mínimo 8 caracteres");
  if (invite.email && invite.email.toLowerCase() !== email) {
    throw new InviteError("invalid", "este convite é exclusivo para outro email");
  }
  if (await getUserByEmail(email)) throw new InviteError("email_taken", "email já cadastrado");

  let tenantForAccount: TenantRow | null = null;
  let companyInput: AcceptCompany | null = null;
  if (invite.type === "new_tenant") {
    const company = body.company;
    if (!company?.name?.trim()) throw new InviteError("invalid", "nome da empresa obrigatório");
    if (!company?.owner_whatsapp_e164?.trim()) {
      throw new InviteError("invalid", "WhatsApp da empresa obrigatório");
    }
    const slug = slugify(company.name);
    if (!slug) throw new InviteError("invalid", "nome da empresa inválido");
    if (await getTenantBySlug(slug)) {
      throw new InviteError("conflict", `já existe uma empresa com esse nome (${slug})`);
    }
    companyInput = company;
  } else {
    if (!invite.tenant_id) throw new InviteError("invalid", "convite sem tenant alvo");
    tenantForAccount = await getTenantById(invite.tenant_id);
    if (!tenantForAccount) throw new InviteError("invalid", "tenant do convite não existe mais");
  }

  // Reivindica o convite atomicamente (guarda contra uso concorrente/duplo).
  const claim = await pool.query<InviteRow>(
    `UPDATE invites SET used_at = now()
      WHERE id = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING *`,
    [invite.id],
  );
  if (claim.rowCount === 0) throw new InviteError("used", "convite já utilizado");

  try {
    // 1) Cria a conta (estrito — falha se o email já existir).
    const user = await createUserStrict({ email, password, name });

    // 2) new_tenant: cria empresa + seed (DB). add_user: usa tenant existente.
    let tenant: TenantRow;
    if (invite.type === "new_tenant" && companyInput) {
      tenant = await createTenantWithSeed({
        name: companyInput.name,
        owner_name: name || companyInput.name,
        owner_whatsapp_e164: companyInput.owner_whatsapp_e164,
        agent_name: companyInput.agent_name,
        tone: companyInput.tone,
        timezone: companyInput.timezone,
        playbook_slug: (invite.payload?.playbook_slug as string | undefined) ?? null,
        activate: false,
      });
    } else {
      tenant = tenantForAccount!;
    }

    // 3) Vincula a conta ao tenant com o papel do convite.
    await linkUserToTenant(user.id, tenant.id, invite.role);

    // 4) Marca quem usou.
    await pool.query(`UPDATE invites SET used_by_user = $1 WHERE id = $2`, [user.id, invite.id]);

    // 5) new_tenant: provisiona Evolution (chamada de rede, best-effort) -> QR.
    let whatsapp: AcceptResult["whatsapp"] = null;
    let provisionError: string | null = null;
    if (invite.type === "new_tenant") {
      const prov = await provisionEvolution(tenant.evolution_instance);
      whatsapp = prov.whatsapp;
      provisionError = prov.error;
    }

    logger.info({ inviteId: invite.id, userId: user.id, tenant: tenant.slug }, "invite accepted");
    return {
      user: { id: user.id, email: user.email, name: user.name },
      tenant: { slug: tenant.slug, name: tenant.name },
      whatsapp,
      provision_error: provisionError,
      type: invite.type,
    };
  } catch (err) {
    // Falhou depois de reivindicar -> libera o convite pra nova tentativa.
    await releaseClaim(invite.id).catch(() => undefined);
    if (err instanceof EmailTakenError) throw new InviteError("email_taken", err.message);
    throw err;
  }
}
