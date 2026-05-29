import { DateTime } from "luxon";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { requireTenantById, type TenantRow } from "../core/tenants.js";
import { prospectSendQueue, prospectSendJobId } from "../workers/queues.js";
import {
  countSentToday,
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

export async function tickAllCampaigns(): Promise<void> {
  const campaigns = await listAllRunningCampaigns();
  for (const c of campaigns) {
    try {
      const tenant = await requireTenantById(c.tenant_id);
      await tickCampaign(tenant, c);
    } catch (err) {
      logger.error({ err, campaignId: c.id }, "prospect dispatcher tick failed");
    }
  }
}

export async function tickCampaign(tenant: TenantRow, campaign: CampaignRow): Promise<void> {
  if (campaign.work_hours_only && !isWorkHourNow(tenant)) {
    logger.debug({ tenant: tenant.slug, campaignId: campaign.id }, "outside work hours, skip");
    return;
  }

  const sentToday = await countSentToday(campaign.id);
  const remainingToday = campaign.rate_per_day - sentToday;
  if (remainingToday <= 0) {
    logger.debug({ tenant: tenant.slug, campaignId: campaign.id, sentToday }, "daily quota reached");
    return;
  }

  const hoursLeft = campaign.work_hours_only ? workHoursRemainingToday(tenant) : 24;
  const perHour = remainingToday / Math.max(hoursLeft, 1);
  const ticksPerHour = (60 * 60 * 1000) / config.PROSPECT_TICK_MS;
  const perTick = Math.max(1, Math.ceil(perHour / ticksPerHour));

  const batch = await pickNextPendingBatch(campaign.id, perTick);
  if (batch.length === 0) {
    logger.info({ tenant: tenant.slug, campaignId: campaign.id }, "no more pending prospects → marking done");
    await updateCampaignStatus(campaign.id, "done");
    return;
  }

  for (const p of batch) {
    const jitter = randomJitterMs();
    const delayMs = Math.max(0, jitter);
    const jobId = prospectSendJobId(p.id);
    try {
      await prospectSendQueue.add(
        "send",
        { campaignId: campaign.id, prospectId: p.id },
        { jobId, delay: delayMs, removeOnComplete: true, removeOnFail: 50 },
      );
      await updateProspect(p.id, { status: "queued" });
      await logProspectEvent(p.id, "queued", { delayMs });
    } catch (err) {
      const msg = String((err as Error).message ?? err);
      if (msg.includes("already exists")) {
        continue;
      }
      logger.error({ err, prospectId: p.id }, "failed to enqueue prospect");
    }
  }

  logger.info(
    { tenant: tenant.slug, campaignId: campaign.id, enqueued: batch.length, perTick, hoursLeft, sentToday },
    "prospect tick: enqueued batch",
  );
}

export async function startCampaign(tenantId: number, id: number): Promise<void> {
  const c = await getCampaignById(id);
  if (!c) throw new Error("campaign not found");
  if (c.tenant_id !== tenantId) throw new Error("campaign tenant mismatch");
  const tenant = await requireTenantById(c.tenant_id);
  await updateCampaignStatus(id, "running");
  await tickCampaign(tenant, { ...c, status: "running" });
}

export async function pauseCampaign(id: number): Promise<void> {
  await updateCampaignStatus(id, "paused");
}
