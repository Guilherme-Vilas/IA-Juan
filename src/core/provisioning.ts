// Provisionamento de tenant reutilizavel — usado tanto pela rota de admin
// (POST /admin/tenants) quanto pelo aceite de convite (POST /invite/:token/accept).
import { logger } from "./logger.js";
import { createTenant, getTenantBySlug, type TenantRow } from "./tenants.js";
import { createEvolutionInstance } from "./evolution.js";
import { upsertAgentSettings } from "./agent-settings.js";
import { upsertWorkingHour } from "./internal-calendar.js";
import { upsertTenantPrompts } from "./tenant-prompts.js";

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

// Nome de instancia do Evolution em PascalCase sem espacos (ex: "FacilitaImob").
export function instanceName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

export type ProvisionTenantInput = {
  name: string;
  slug?: string;
  owner_name?: string;
  owner_whatsapp_e164: string;
  timezone?: string;
  work_start_hour?: number;
  work_end_hour?: number;
  meeting_duration_min?: number;
  playbook_slug?: string | null;
  agent_name?: string;
  tone?: string;
  products?: string[];
  regions?: string[];
  prompts?: { system?: string; knowledge?: string; objections?: string; examples?: string };
  activate?: boolean;
};

export type ProvisionWhatsapp = {
  qr_base64?: string | null;
  pairing_code?: string | null;
  already_exists?: boolean;
};

export type ProvisionResult = {
  tenant: TenantRow;
  whatsapp: ProvisionWhatsapp | null;
  provision_error: string | null;
};

// Cria o registro do tenant + seed (agent settings, expediente, prompts).
// NAO toca no Evolution — chame provisionEvolution() depois (chamada de rede).
export async function createTenantWithSeed(input: ProvisionTenantInput): Promise<TenantRow> {
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(input.name);
  const inst = instanceName(slug);

  const tenant = await createTenant({
    slug,
    name: input.name.trim(),
    evolution_instance: inst,
    owner_whatsapp_e164: input.owner_whatsapp_e164.trim(),
    owner_name: input.owner_name?.trim() || input.name.trim(),
    timezone: input.timezone,
    work_start_hour: input.work_start_hour,
    work_end_hour: input.work_end_hour,
    meeting_duration_min: input.meeting_duration_min,
    prompt_dir: slug,
    playbook_slug: input.playbook_slug ?? null,
    active: input.activate ?? false,
  });

  await upsertAgentSettings(tenant.id, {
    agent_name: input.agent_name?.trim() || "Stella",
    tone: input.tone?.trim() || "consultivo, humano e objetivo",
    products: Array.isArray(input.products) ? input.products : [],
    regions: Array.isArray(input.regions) ? input.regions : [],
    qualification_rules: "",
    handoff_rules: "Passar para humano quando o lead pedir ou quando estiver qualificado.",
  });
  for (let wd = 1; wd <= 7; wd++) {
    await upsertWorkingHour(tenant.id, wd, {
      start_time: `${String(input.work_start_hour ?? 9).padStart(2, "0")}:00`,
      end_time: `${String(input.work_end_hour ?? 18).padStart(2, "0")}:00`,
      active: wd >= 1 && wd <= 5,
    });
  }
  if (input.prompts) {
    await upsertTenantPrompts(tenant.id, input.prompts);
  }

  return tenant;
}

// Provisiona a instancia WhatsApp no Evolution (chamada de rede, best-effort).
export async function provisionEvolution(
  instance: string,
): Promise<{ whatsapp: ProvisionResult["whatsapp"]; error: string | null }> {
  try {
    const provision = await createEvolutionInstance(instance);
    return {
      whatsapp: {
        qr_base64: provision.qrBase64,
        pairing_code: provision.pairingCode,
        already_exists: provision.alreadyExists,
      },
      error: null,
    };
  } catch (err) {
    logger.error({ err, instance }, "provisioning: evolution instance failed");
    return { whatsapp: null, error: String(err) };
  }
}

// Fluxo completo (DB + Evolution). Usado pela rota de admin.
export async function provisionTenant(input: ProvisionTenantInput): Promise<ProvisionResult> {
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(input.name);
  if (await getTenantBySlug(slug)) {
    throw new Error(`tenant slug já existe: ${slug}`);
  }
  const tenant = await createTenantWithSeed({ ...input, slug });
  const { whatsapp, error } = await provisionEvolution(tenant.evolution_instance);
  logger.info({ tenant: slug, instance: tenant.evolution_instance }, "tenant provisioned");
  return { tenant, whatsapp, provision_error: error };
}
