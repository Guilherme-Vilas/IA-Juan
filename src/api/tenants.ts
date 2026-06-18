import type { FastifyInstance } from "fastify";
import { getTenantBySlug, setTenantActive } from "../core/tenants.js";
import { provisionTenant, slugify } from "../core/provisioning.js";
import { linkUserToTenant } from "../core/users.js";
import { requireSuperadmin } from "../auth/plugin.js";

export async function registerTenantProvisioningRoutes(app: FastifyInstance) {
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);

    // POST /admin/tenants — provisiona um tenant de ponta a ponta:
    // cria registro -> cria instancia Evolution + webhook -> retorna QR base64.
    scope.post("/admin/tenants", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;

      const body = req.body as {
        name?: string;
        slug?: string;
        owner_name?: string;
        owner_whatsapp_e164?: string;
        timezone?: string;
        work_start_hour?: number;
        work_end_hour?: number;
        meeting_duration_min?: number;
        playbook_slug?: string;
        agent_name?: string;
        tone?: string;
        products?: string[];
        regions?: string[];
        prompts?: { system?: string; knowledge?: string; objections?: string; examples?: string };
        activate?: boolean;
      };

      if (!body?.name?.trim()) return reply.code(400).send({ error: "name required" });
      if (!body?.owner_whatsapp_e164?.trim()) {
        return reply.code(400).send({ error: "owner_whatsapp_e164 required" });
      }

      const slug = body.slug?.trim() ? slugify(body.slug) : slugify(body.name);
      if (await getTenantBySlug(slug)) {
        return reply.code(409).send({ error: `tenant slug já existe: ${slug}` });
      }

      // Provisiona o tenant de ponta a ponta (registro + seed + Evolution).
      const result = await provisionTenant({
        name: body.name,
        slug,
        owner_name: body.owner_name,
        owner_whatsapp_e164: body.owner_whatsapp_e164,
        timezone: body.timezone,
        work_start_hour: body.work_start_hour,
        work_end_hour: body.work_end_hour,
        meeting_duration_min: body.meeting_duration_min,
        playbook_slug: body.playbook_slug ?? null,
        agent_name: body.agent_name,
        tone: body.tone,
        products: body.products,
        regions: body.regions,
        prompts: body.prompts,
        activate: body.activate ?? false,
      });

      // Vincula o criador (se for usuario humano) como owner.
      if (req.auth?.kind === "user") {
        await linkUserToTenant(req.auth.userId, result.tenant.id, "owner").catch(() => undefined);
      }

      return reply.send({
        tenant: {
          id: result.tenant.id,
          slug: result.tenant.slug,
          name: result.tenant.name,
          evolution_instance: result.tenant.evolution_instance,
          active: result.tenant.active,
        },
        whatsapp: result.whatsapp,
        provision_error: result.provision_error,
        next_steps: [
          "Escaneie o QR code com o WhatsApp do cliente.",
          "Quando conectar, ative o tenant em PATCH /admin/tenants/:slug/active.",
        ],
      });
    });

    // Ativa/desativa um tenant (apos QR conectado).
    scope.patch("/admin/tenants/:slug/active", async (req, reply) => {
      if (!requireSuperadmin(req, reply)) return;
      const { slug } = req.params as { slug: string };
      const tenant = await getTenantBySlug(slug);
      if (!tenant) return reply.code(404).send({ error: "tenant not found" });
      const body = req.body as { active?: boolean };
      await setTenantActive(tenant.id, body?.active ?? true);
      return { ok: true, active: body?.active ?? true };
    });
  });
}
