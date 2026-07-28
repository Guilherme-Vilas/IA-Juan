import type { FastifyInstance } from "fastify";
import { logger } from "../core/logger.js";
import { pool } from "../core/db.js";
import {
  createUser,
  getUserByEmail,
  getUserById,
  linkUserToTenant,
  listUsers,
  listUserTenants,
  verifyPassword,
  type TenantRole,
} from "../core/users.js";
import { getTenantBySlug } from "../core/tenants.js";
import { requireSuperadmin } from "../auth/plugin.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  // ===== Login: email + senha -> JWT =====
  app.post("/auth/login", async (req, reply) => {
    const body = req.body as { email?: string; password?: string };
    const email = (body?.email ?? "").trim();
    const password = body?.password ?? "";
    if (!email || !password) return reply.code(400).send({ error: "email e password obrigatórios" });

    const user = await getUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return reply.code(401).send({ error: "credenciais inválidas" });
    }

    const token = await reply.jwtSign({ sub: user.id, email: user.email, sa: user.is_superadmin });
    const tenants = await listUserTenants(user.id);
    logger.info({ userId: user.id }, "auth: login ok");
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, is_superadmin: user.is_superadmin },
      tenants,
    };
  });

  // ===== Quem sou eu (+ tenants que acesso) =====
  app.get("/auth/me", { onRequest: [app.authenticate] }, async (req, reply) => {
    // Superadmin/service enxergam TODOS os tenants.
    const allAsLinks = async () => {
      const { listTenants } = await import("../core/tenants.js");
      const all = await listTenants();
      return all.map((t) => ({ tenant_id: t.id, slug: t.slug, name: t.name, role: "owner" as const }));
    };

    if (req.auth?.kind === "service") {
      return { kind: "service", is_superadmin: true, tenants: await allAsLinks() };
    }
    if (req.auth?.kind === "user") {
      const tenants = req.auth.isSuperadmin ? await allAsLinks() : await listUserTenants(req.auth.userId);
      return { kind: "user", userId: req.auth.userId, is_superadmin: req.auth.isSuperadmin, tenants };
    }
    return reply.code(401).send({ error: "unauthorized" });
  });

  // ===== Listar usuarios (superadmin/service apenas) =====
  app.get("/auth/users", { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!requireSuperadmin(req, reply)) return;
    return { users: await listUsers() };
  });

  // ===== Criar usuario + vincular a tenant (superadmin/service apenas) =====
  app.post("/auth/users", { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!requireSuperadmin(req, reply)) return;
    const body = req.body as {
      email?: string;
      password?: string;
      name?: string;
      is_superadmin?: boolean;
      tenant_slug?: string;
      role?: TenantRole;
    };
    if (!body?.email || !body?.password) {
      return reply.code(400).send({ error: "email e password obrigatórios" });
    }
    const user = await createUser({
      email: body.email,
      password: body.password,
      name: body.name,
      is_superadmin: body.is_superadmin,
    });
    if (body.tenant_slug) {
      const tenant = await getTenantBySlug(body.tenant_slug);
      if (!tenant) return reply.code(404).send({ error: "tenant not found" });
      await linkUserToTenant(user.id, tenant.id, body.role ?? "owner");
    }
    logger.info({ userId: user.id, by: req.auth }, "auth: user created");
    return { user: { id: user.id, email: user.email, name: user.name, is_superadmin: user.is_superadmin } };
  });

  // ===== Excluir usuario (superadmin/service apenas) =====
  // FKs cuidam das referencias: leads/tarefas atribuidas ficam sem dono
  // (SET NULL); vinculos e progresso de treinamento somem (CASCADE).
  app.delete("/auth/users/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!requireSuperadmin(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: "id inválido" });

    // Ninguém exclui a si mesmo — evita se trancar pra fora.
    if (req.auth?.kind === "user" && req.auth.userId === id) {
      return reply.code(400).send({ error: "você não pode excluir a si mesmo" });
    }

    const user = await getUserById(id);
    if (!user) return reply.code(404).send({ error: "usuário não encontrado" });

    // Nunca deixar a plataforma sem superadmin ativo.
    if (user.is_superadmin) {
      const { rows } = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM users WHERE is_superadmin = true AND active = true AND id <> $1`,
        [id],
      );
      if (Number(rows[0]?.n ?? "0") === 0) {
        return reply.code(409).send({ error: "não dá pra excluir o último superadmin ativo" });
      }
    }

    await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
    logger.info({ deletedUserId: id, email: user.email, by: req.auth }, "auth: user deleted");
    return { ok: true };
  });
}
