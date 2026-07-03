import { DateTime } from "luxon";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { pool } from "../core/db.js";
import { requireTenantById, invalidateTenantsCache, type TenantRow } from "../core/tenants.js";
import { prospectSendQueue, prospectSendJobId } from "../workers/queues.js";
import {
  countSentToday,
  countTenantBudgetUsed,
  getCampaignById,
  listAllRunningCampaigns,
  pickNextPendingBatch,
  updateCampaignStatus,
  updateProspect,
  logProspectEvent,
  type CampaignRow,
} from "./repo.js";

function isWorkHourNow(tenant: TenantRow): boolean {
  const now = DateTime.now().setZone(tenant.timezone);
  if (now.weekday >= 6) return false;
  return now.hour >= tenant.work_start_hour && now.hour < tenant.work_end_hour;
}

function workHoursRemainingToday(tenant: TenantRow): number {
  const now = DateTime.now().setZone(tenant.timezone);
  if (now.weekday >= 6) return 0;
  if (now.hour >= tenant.work_end_hour) return 0;
  const remaining = tenant.work_end_hour - now.hour - now.minute / 60;
  return Math.max(0.5, remaining);
}

function randomJitterMs(): number {
  const max = config.PROSPECT_JITTER_MS;
  return Math.floor(Math.random() * max * 2) - max;
}

// ===== Warm-up do chip =====
// Rampa por dias desde o início da prospecção nesse tenant/instância.
// Chip novo a todo vapor = ban. A rampa vale pra qualquer chip; se o teto
// do tenant for menor que a rampa, vale o teto.
const WARMUP_RAMP: Array<{ upToDay: number; cap: number }> = [
  { upToDay: 3, cap: 10 },
  { upToDay: 7, cap: 20 },
  { upToDay: 14, cap: 35 },
];

async function ensureWarmupStarted(tenant: TenantRow): Promise<Date> {
  if (tenant.prospect_warmup_started_at) return tenant.prospect_warmup_started_at;
  const { rows } = await pool.query<{ prospect_warmup_started_at: Date }>(
    `UPDATE tenants SET prospect_warmup_started_at = COALESCE(prospect_warmup_started_at, now())
      WHERE id = $1 RETURNING prospect_warmup_started_at`,
    [tenant.id],
  );
  await invalidateTenantsCache();
  return rows[0]!.prospect_warmup_started_at;
}

export async function effectiveDailyCap(tenant: TenantRow): Promise<number> {
  const startedAt = await ensureWarmupStarted(tenant);
  const day = Math.floor((Date.now() - new Date(startedAt).getTime()) / 86_400_000) + 1;
  const ramp = WARMUP_RAMP.find((r) => day <= r.upToDay)?.cap ?? Infinity;
  return Math.min(tenant.prospect_daily_cap, ramp);
}

// Orçamento restante da instância (todas as campanhas do tenant).
export async function tenantRemainingBudget(tenant: TenantRow): Promise<number> {
  const cap = await effectiveDailyCap(tenant);
  const used = await countTenantBudgetUsed(tenant.id);
  return Math.max(0, cap - used);
}

export async function tickAllCampaigns(): Promise<void> {
  const campaigns = await listAllRunningCampaigns();

  // Agrupa por tenant: o orçamento é POR INSTÂNCIA, as campanhas dividem.
  const byTenant = new Map<number, CampaignRow[]>();
  for (const c of campaigns) {
    const list = byTenant.get(c.tenant_id) ?? [];
    list.push(c);
    byTenant.set(c.tenant_id, list);
  }

  for (const [tenantId, tenantCampaigns] of byTenant) {
    try {
      const tenant = await requireTenantById(tenantId);
      let remaining = await tenantRemainingBudget(tenant);
      if (remaining <= 0) {
        logger.debug({ tenant: tenant.slug }, "orçamento diário da instância esgotado");
        continue;
      }
      for (const c of tenantCampaigns) {
        if (remaining <= 0) break;
        const enqueued = await tickCampaign(tenant, c, remaining).catch((err) => {
          logger.error({ err, campaignId: c.id }, "prospect dispatcher tick failed");
          return 0;
        });
        remaining -= enqueued;
      }
    } catch (err) {
      logger.error({ err, tenantId }, "prospect dispatcher tenant tick failed");
    }
  }
}

// Retorna quantos prospects foram enfileirados (consumo do orçamento do tenant).
export async function tickCampaign(
  tenant: TenantRow,
  campaign: CampaignRow,
  tenantBudget: number,
): Promise<number> {
  if (campaign.work_hours_only && !isWorkHourNow(tenant)) {
    logger.debug({ tenant: tenant.slug, campaignId: campaign.id }, "outside work hours, skip");
    return 0;
  }

  const sentToday = await countSentToday(campaign.id);
  const remainingToday = campaign.rate_per_day - sentToday;
  if (remainingToday <= 0) {
    logger.debug({ tenant: tenant.slug, campaignId: campaign.id, sentToday }, "daily quota reached");
    return 0;
  }

  const hoursLeft = campaign.work_hours_only ? workHoursRemainingToday(tenant) : 24;
  const perHour = remainingToday / Math.max(hoursLeft, 1);
  const ticksPerHour = (60 * 60 * 1000) / config.PROSPECT_TICK_MS;
  const perTick = Math.min(
    Math.max(1, Math.ceil(perHour / ticksPerHour)),
    remainingToday,
    tenantBudget,
  );
  if (perTick <= 0) return 0;

  const batch = await pickNextPendingBatch(campaign.id, perTick);
  if (batch.length === 0) {
    // Só encerra se não sobrou NADA pendente (nem retries agendados pro futuro).
    const anyPending = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM prospects WHERE campaign_id = $1 AND status IN ('pending','queued')`,
      [campaign.id],
    );
    if (Number(anyPending.rows[0]?.n ?? "0") === 0) {
      logger.info({ tenant: tenant.slug, campaignId: campaign.id }, "no more pending prospects → marking done");
      await updateCampaignStatus(campaign.id, "done");
    }
    return 0;
  }

  let enqueued = 0;
  for (const p of batch) {
    const jitter = randomJitterMs();
    const delayMs = Math.max(0, jitter);
    const jobId = prospectSendJobId(p.id, p.current_step + 1);
    try {
      await prospectSendQueue.add(
        "send",
        { campaignId: campaign.id, prospectId: p.id },
        { jobId, delay: delayMs, removeOnComplete: true, removeOnFail: 50 },
      );
      await updateProspect(p.id, { status: "queued" });
      await logProspectEvent(p.id, "queued", { delayMs });
      enqueued++;
    } catch (err) {
      const msg = String((err as Error).message ?? err);
      if (msg.includes("already exists")) {
        continue;
      }
      logger.error({ err, prospectId: p.id }, "failed to enqueue prospect");
    }
  }

  logger.info(
    { tenant: tenant.slug, campaignId: campaign.id, enqueued, perTick, hoursLeft, sentToday, tenantBudget },
    "prospect tick: enqueued batch",
  );
  return enqueued;
}

export async function startCampaign(tenantId: number, id: number): Promise<void> {
  const c = await getCampaignById(id);
  if (!c) throw new Error("campaign not found");
  if (c.tenant_id !== tenantId) throw new Error("campaign tenant mismatch");
  const tenant = await requireTenantById(c.tenant_id);
  await updateCampaignStatus(id, "running");
  const budget = await tenantRemainingBudget(tenant);
  await tickCampaign(tenant, { ...c, status: "running" }, budget);
}

export async function pauseCampaign(id: number): Promise<void> {
  await updateCampaignStatus(id, "paused");
}
