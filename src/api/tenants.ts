import type { FastifyInstance } from "fastify";
import { logger } from "../core/logger.js";
import { createTenant, getTenantBySlug, setTenantActive } from "../core/tenants.js";
import { createEvolutionInstance } from "../core/evolution.js";
import { upsertAgentSettings } from "../core/agent-settings.js";
import { upsertWorkingHour } from "../core/internal-calendar.js";
import { upsertTenantPrompts } from "../core/tenant-prompts.js";
import { linkUserToTenant } from "../core/users.js";
import { requireSuperadmin } from "../auth/plugin.js";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

// Nome de instancia do Evolution em PascalCase sem espacos (ex: "FacilitaImob").
function instanceName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

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

      const slug = (body.slug?.trim() ? slugify(body.slug) : slugify(body.name));
      if (await getTenantBySlug(slug)) {
        return reply.code(409).send({ error: `tenant slug já existe: ${slug}` });
      }
      const inst = instanceName(slug);

      // 1) Cria o tenant (inativo por padrao ate o WhatsApp conectar).
      const tenant = await createTenant({
        slug,
        name: body.name.trim(),
        evolution_instance: inst,
        owner_whatsapp_e164: body.owner_whatsapp_e164.trim(),
        owner_name: body.owner_name?.trim() || body.name.trim(),
        timezone: body.timezone,
        work_start_hour: body.work_start_hour,
        work_end_hour: body.work_end_hour,
        meeting_duration_min: body.meeting_duration_min,
        prompt_dir: slug,
        playbook_slug: body.playbook_slug ?? null,
        active: body.activate ?? false,
      });

      // 2) Seed: agent settings, expediente seg-sex, prompts iniciais.
      await upsertAgentSettings(tenant.id, {
        agent_name: body.agent_name?.trim() || "Stella",
        tone: body.tone?.trim() || "consultivo, humano e objetivo",
        products: Array.isArray(body.products) ? body.products : [],
        regions: Array.isArray(body.regions) ? body.regions : [],
        qualification_rules: "",
        handoff_rules: "Passar para humano quando o lead pedir ou quando estiver qualificado.",
      });
      for (let wd = 1; wd <= 7; wd++) {
        await upsertWorkingHour(tenant.id, wd, {
          start_time: `${String(body.work_start_hour ?? 9).padStart(2, "0")}:00`,
          end_time: `${String(body.work_end_hour ?? 18).padStart(2, "0")}:00`,
          active: wd >= 1 && wd <= 5,
        });
      }
      if (body.prompts) {
        await upsertTenantPrompts(tenant.id, body.prompts);
      }

      // 3) Vincula o criador (se for usuario humano) como owner.
      if (req.auth?.kind === "user") {
        await linkUserToTenant(req.auth.userId, tenant.id, "owner").catch(() => undefined);
      }

      // 4) Provisiona a instancia WhatsApp no Evolution + webhook. Devolve o QR.
      let provision: Awaited<ReturnType<typeof createEvolutionInstance>> | null = null;
      let provisionError: string | null = null;
      try {
        provision = await createEvolutionInstance(inst);
      } catch (err) {
        provisionError = String(err);
        logger.error({ err, tenant: slug }, "tenant provisioning: evolution instance failed");
      }

      logger.info({ tenant: slug, instance: inst }, "tenant provisioned");
      return reply.send({
        tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, evolution_instance: inst, active: tenant.active },
        whatsapp: provision
          ? { qr_base64: provision.qrBase64, pairing_code: provision.pairingCode, already_exists: provision.alreadyExists }
          : null,
        provision_error: provisionError,
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
