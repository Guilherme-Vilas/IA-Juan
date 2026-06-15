import type { FastifyInstance } from "fastify";
import { logger } from "../core/logger.js";
import {
  createUser,
  getUserByEmail,
  linkUserToTenant,
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
    if (req.auth?.kind === "service") {
      return { kind: "service", tenants: [] };
    }
    if (req.auth?.kind === "user") {
      const tenants = await listUserTenants(req.auth.userId);
      return { kind: "user", userId: req.auth.userId, is_superadmin: req.auth.isSuperadmin, tenants };
    }
    return reply.code(401).send({ error: "unauthorized" });
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
}
