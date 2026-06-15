import crypto from "node:crypto";
import { pool } from "./db.js";

export type TenantRole = "owner" | "admin" | "sdr" | "viewer";

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  is_superadmin: boolean;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type UserTenantRow = {
  user_id: number;
  tenant_id: number;
  role: TenantRole;
};

// ===== Password hashing (scrypt nativo — sem dependencia nativa de bcrypt) =====
// Formato armazenado: scrypt$<saltHex>$<hashHex>
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(plain, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1]!, "hex");
  const expected = Buffer.from(parts[2]!, "hex");
  const derived = crypto.scryptSync(plain, salt, expected.length);
  return crypto.timingSafeEqual(expected, derived);
}

// ===== Repo =====
export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT * FROM users WHERE lower(email) = lower($1) AND active = true`,
    [email],
  );
  return rows[0] ?? null;
}

export async function getUserById(id: number): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(`SELECT * FROM users WHERE id = $1 AND active = true`, [id]);
  return rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  password: string;
  name?: string;
  is_superadmin?: boolean;
}): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, password_hash, name, is_superadmin)
     VALUES ($1, $2, $3, COALESCE($4, false))
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       updated_at = now()
     RETURNING *`,
    [input.email.toLowerCase(), hashPassword(input.password), input.name ?? "", input.is_superadmin ?? false],
  );
  return rows[0]!;
}

export async function linkUserToTenant(userId: number, tenantId: number, role: TenantRole = "owner") {
  await pool.query(
    `INSERT INTO user_tenants (user_id, tenant_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = EXCLUDED.role`,
    [userId, tenantId, role],
  );
}

// Papel do usuario num tenant especifico. null = sem vinculo.
export async function getUserTenantRole(userId: number, tenantId: number): Promise<TenantRole | null> {
  const { rows } = await pool.query<{ role: TenantRole }>(
    `SELECT role FROM user_tenants WHERE user_id = $1 AND tenant_id = $2`,
    [userId, tenantId],
  );
  return rows[0]?.role ?? null;
}

export async function listUserTenants(userId: number): Promise<Array<{ tenant_id: number; slug: string; name: string; role: TenantRole }>> {
  const { rows } = await pool.query<{ tenant_id: number; slug: string; name: string; role: TenantRole }>(
    `SELECT ut.tenant_id, t.slug, t.name, ut.role
       FROM user_tenants ut
       JOIN tenants t ON t.id = ut.tenant_id
      WHERE ut.user_id = $1
      ORDER BY t.name ASC`,
    [userId],
  );
  return rows;
}
