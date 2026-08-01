import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { logger } from "../core/logger.js";
import { pool } from "../core/db.js";
import { redis } from "../core/redis.js";
import {
  createUser,
  getUserByEmail,
  getUserById,
  linkUserToTenant,
  listUsers,
  listUserTenants,
  setUserPasswordByEmail,
  verifyPassword,
  type TenantRole,
} from "../core/users.js";
import { getTenantBySlug } from "../core/tenants.js";
import { requireSuperadmin } from "../auth/plugin.js";
import { emailEnabled, sendResetCodeEmail, sendWelcomeEmail } from "../core/email.js";

function clientIp(req: FastifyRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.ip;
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

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

  // ===== Esqueci minha senha: envia CÓDIGO de acesso por e-mail =====
  // Sempre responde ok (sem revelar se o e-mail existe). Rate limit por
  // e-mail e por IP. Código de 6 dígitos, hash no Redis, validade 15 min.
  app.post("/auth/forgot-password", async (req, reply) => {
    const email = String((req.body as { email?: string })?.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) return reply.code(400).send({ error: "e-mail inválido" });
    if (!emailEnabled()) {
      return reply.code(503).send({ error: "recuperação por e-mail indisponível — fale com o suporte" });
    }

    const ip = clientIp(req);
    const [perEmail, perIp] = await Promise.all([
      redis.incr(`pwreset:req:${email}`),
      redis.incr(`pwreset:ip:${ip}`),
    ]);
    await Promise.all([redis.expire(`pwreset:req:${email}`, 3_600), redis.expire(`pwreset:ip:${ip}`, 3_600)]);
    if (perEmail > 3 || perIp > 10) {
      return reply.code(429).send({ error: "muitas tentativas — aguarde uma hora e tente de novo" });
    }

    const user = await getUserByEmail(email);
    if (user && user.active) {
      const code = String(crypto.randomInt(100_000, 1_000_000));
      await redis.set(`pwreset:code:${email}`, sha256(code), "EX", 900);
      await redis.del(`pwreset:tries:${email}`);
      sendResetCodeEmail(email, code).catch((err) =>
        logger.error({ err, email }, "auth: envio do código de acesso falhou"),
      );
      logger.info({ email }, "auth: código de acesso gerado");
    }
    // resposta idêntica com ou sem conta — sem enumeração de e-mails
    return { ok: true };
  });

  // ===== Redefinir senha com o código =====
  app.post("/auth/reset-password", async (req, reply) => {
    const body = req.body as { email?: string; code?: string; password?: string };
    const email = String(body?.email ?? "").trim().toLowerCase();
    const code = String(body?.code ?? "").replace(/\D/g, "");
    const password = body?.password ?? "";
    if (!email || code.length !== 6) return reply.code(400).send({ error: "código inválido" });
    if (password.length < 8) return reply.code(400).send({ error: "a senha precisa ter no mínimo 8 caracteres" });

    // máx 5 tentativas por código — depois invalida
    const tries = await redis.incr(`pwreset:tries:${email}`);
    await redis.expire(`pwreset:tries:${email}`, 900);
    if (tries > 5) {
      await redis.del(`pwreset:code:${email}`);
      return reply.code(429).send({ error: "muitas tentativas — peça um novo código" });
    }

    const stored = await redis.get(`pwreset:code:${email}`);
    if (!stored || stored !== sha256(code)) {
      return reply.code(400).send({ error: "código incorreto ou expirado" });
    }

    const changed = await setUserPasswordByEmail(email, password);
    if (!changed) return reply.code(400).send({ error: "código incorreto ou expirado" });
    await Promise.all([redis.del(`pwreset:code:${email}`), redis.del(`pwreset:tries:${email}`)]);
    logger.info({ email }, "auth: senha redefinida via código");
    return { ok: true };
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
    // Boas-vindas por e-mail (best-effort — a criação nunca falha por causa disso).
    sendWelcomeEmail(user.email, user.name).catch((err) =>
      logger.warn({ err, email: user.email }, "auth: e-mail de boas-vindas falhou"),
    );
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
