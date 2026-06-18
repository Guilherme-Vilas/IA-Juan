import type { FastifyInstance } from "fastify";
import { logger } from "../core/logger.js";
import { requireSuperadmin } from "../auth/plugin.js";
import {
  acceptInvite,
  createInvite,
  getInvitePublicInfo,
  listInvites,
  revokeInvite,
  InviteError,
  type InviteType,
} from "../core/invites.js";
import type { TenantRole } from "../core/users.js";

export async function registerInviteRoutes(app: FastifyInstance) {
  // ============== Superadmin: gestao de convites ==============
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);

    // Cria um convite -> retorna o link (token cru aparece SO aqui).
    scope.post("/auth/invites", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const body = req.body as {
        type?: InviteType;
        tenant_slug?: string;
        role?: TenantRole;
        email?: string;
        note?: string;
        playbook_slug?: string;
        ttl_days?: number;
      };
      if (body?.type !== "new_tenant" && body?.type !== "add_user") {
        return reply.code(400).send({ error: "type inválido (new_tenant|add_user)" });
      }
      if (body.type === "add_user" && !body.tenant_slug?.trim()) {
        return reply.code(400).send({ error: "tenant_slug obrigatório para add_user" });
      }
      try {
        const created_by = req.auth?.kind === "user" ? req.auth.userId : null;
        const { invite, token, url } = await createInvite({
          type: body.type,
          tenant_slug: body.tenant_slug,
          role: body.role,
          email: body.email,
          note: body.note,
          payload: body.playbook_slug ? { playbook_slug: body.playbook_slug } : {},
          created_by,
          ttl_days: body.ttl_days,
        });
        return reply.code(201).send({
          id: invite.id,
          token,
          url,
          expires_at: new Date(invite.expires_at).toISOString(),
        });
      } catch (err) {
        return reply.code(400).send({ error: String(err instanceof Error ? err.message : err) });
      }
    });

    // Lista convites (com status derivado).
    scope.get("/auth/invites", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      return { invites: await listInvites() };
    });

    // Revoga (apaga) um convite.
    scope.delete("/auth/invites/:id", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const { id } = req.params as { id: string };
      const ok = await revokeInvite(Number(id));
      if (!ok) return reply.code(404).send({ error: "convite não encontrado" });
      return { ok: true };
    });
  });

  // ============== Publico: validar + aceitar (SEM auth) ==============
  // Valida o token e devolve info segura pra renderizar o formulário.
  app.get("/invite/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const info = await getInvitePublicInfo(token);
    if (!info) return reply.code(404).send({ status: "not_found" });
    return info;
  });

  // Consome o convite e cria a conta (e a empresa, se new_tenant).
  app.post("/invite/:token/accept", async (req, reply) => {
    const { token } = req.params as { token: string };
    const body = req.body as {
      account?: { name?: string; email?: string; password?: string };
      company?: {
        name?: string;
        owner_whatsapp_e164?: string;
        agent_name?: string;
        tone?: string;
        timezone?: string;
      };
    };
    if (!body?.account?.email || !body?.account?.password) {
      return reply.code(400).send({ error: "email e senha obrigatórios" });
    }
    try {
      const result = await acceptInvite(token, {
        account: {
          name: body.account.name,
          email: body.account.email,
          password: body.account.password,
        },
        company: body.company
          ? {
              name: body.company.name ?? "",
              owner_whatsapp_e164: body.company.owner_whatsapp_e164 ?? "",
              agent_name: body.company.agent_name,
              tone: body.company.tone,
              timezone: body.company.timezone,
            }
          : undefined,
      });
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof InviteError) {
        const code =
          err.code === "not_found" ? 404 : err.code === "email_taken" || err.code === "conflict" ? 409 : 400;
        return reply.code(code).send({ error: err.message, code: err.code });
      }
      logger.error({ err }, "invite accept failed");
      return reply.code(500).send({ error: "falha ao aceitar convite" });
    }
  });
}
