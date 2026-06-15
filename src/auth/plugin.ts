import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { getUserTenantRole, type TenantRole } from "../core/users.js";
import { getTenantBySlug } from "../core/tenants.js";

// Identidade resolvida na requisicao.
export type AuthContext =
  | { kind: "user"; userId: number; isSuperadmin: boolean }
  | { kind: "service" }; // token de servico (backend->backend / SSR), superadmin implicito

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
    // Injetados por requireTenant — NUNCA confie no slug da URL sem passar por aqui.
    tenantId?: number;
    tenantSlug?: string;
    role?: TenantRole | "service" | "superadmin";
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireTenant: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export type JwtPayload = { sub: number; email: string; sa: boolean };

export async function registerAuth(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });

  // ===== authenticate: resolve a identidade (JWT de usuario OU token de servico) =====
  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    // 1) Token de servico (header x-admin-token) — uso interno (SSR do dashboard,
    //    provisioning). Concede superadmin. NAO e mais a auth padrao de tenant.
    const serviceToken = req.headers["x-admin-token"] as string | undefined;
    if (serviceToken && serviceToken === config.ADMIN_API_TOKEN) {
      req.auth = { kind: "service" };
      return;
    }

    // 2) JWT Bearer de usuario humano.
    try {
      const payload = await req.jwtVerify<JwtPayload>();
      req.auth = { kind: "user", userId: payload.sub, isSuperadmin: !!payload.sa };
    } catch {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  // ===== requireTenant: valida o vinculo usuario<->tenant e injeta req.tenantId =====
  // Usar SEMPRE em rotas /admin/tenants/:slug/*. O slug da URL so vale depois deste
  // cross-check contra user_tenants.
  app.decorate("requireTenant", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const slug = (req.params as { slug?: string })?.slug;
    if (!slug) {
      reply.code(400).send({ error: "tenant slug missing in route" });
      return;
    }
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      reply.code(404).send({ error: "tenant not found" });
      return;
    }

    // Service token e superadmin acessam qualquer tenant.
    if (req.auth.kind === "service") {
      req.tenantId = tenant.id;
      req.tenantSlug = tenant.slug;
      req.role = "service";
      return;
    }
    if (req.auth.isSuperadmin) {
      req.tenantId = tenant.id;
      req.tenantSlug = tenant.slug;
      req.role = "superadmin";
      return;
    }

    // Usuario comum: precisa de vinculo explicito no banco.
    const role = await getUserTenantRole(req.auth.userId, tenant.id);
    if (!role) {
      logger.warn({ userId: req.auth.userId, slug }, "auth: user has no link to tenant");
      reply.code(403).send({ error: "forbidden: no access to this tenant" });
      return;
    }
    req.tenantId = tenant.id;
    req.tenantSlug = tenant.slug;
    req.role = role;
  });
}

// Guard de superadmin/service para rotas globais (ex: provisioning de tenant, playbooks).
export function requireSuperadmin(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.auth?.kind === "service" || (req.auth?.kind === "user" && req.auth.isSuperadmin)) {
    return true;
  }
  reply.code(403).send({ error: "forbidden: superadmin required" });
  return false;
}
