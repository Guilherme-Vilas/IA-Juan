import { DateTime } from "luxon";
import { config } from "../config.js";
import { logger } from "../core/logger.js";
import { prospectSendQueue, prospectSendJobId } from "../workers/queues.js";
import {
  countSentToday,
  getCampaign,
  listCampaigns,
  pickNextPendingBatch,
  updateCampaignStatus,
  updateProspect,
  logProspectEvent,
  type CampaignRow,
} from "./repo.js";

// Decide se o horário atual é "comercial" (seg-sex, dentro de WORK_START_HOUR..WORK_END_HOUR).
function isWorkHourNow(): boolean {
  const now = DateTime.now().setZone(config.TIMEZONE);
  if (now.weekday >= 6) return false; // 6=sáb, 7=dom
  return now.hour >= config.WORK_START_HOUR && now.hour < config.WORK_END_HOUR;
}

// Quantas horas úteis ainda sobram hoje (mínimo 0.5 pra evitar divisão por zero).
function workHoursRemainingToday(): number {
  const now = DateTime.now().setZone(config.TIMEZONE);
  if (now.weekday >= 6) return 0;
  const endHour = config.WORK_END_HOUR;
  if (now.hour >= endHour) return 0;
  const remaining = endHour - now.hour - now.minute / 60;
  return Math.max(0.5, remaining);
}

function randomJitterMs(): number {
  const max = config.PROSPECT_JITTER_MS;
  return Math.floor(Math.random() * max * 2) - max; // ±max
}

// Tick de scheduler — chama periodicamente (ex: a cada 5min via cron interno).
// Pra cada campanha 'running', calcula quantos prospects mandar agora e enfileira.
export async function tickAllCampaigns(): Promise<void> {
  const campaigns = await listCampaigns();
  for (const c of campaigns) {
    if (c.status !== "running") continue;
    try {
      await tickCampaign(c);
    } catch (err) {
      logger.error({ err, campaignId: c.id }, "prospect dispatcher tick failed");
    }
  }
}

export async function tickCampaign(campaign: CampaignRow): Promise<void> {
  if (campaign.work_hours_only && !isWorkHourNow()) {
    logger.debug({ campaignId: campaign.id }, "outside work hours, skip");
    return;
  }

  const sentToday = await countSentToday(campaign.id);
  const remainingToday = campaign.rate_per_day - sentToday;
  if (remainingToday <= 0) {
    logger.debug({ campaignId: campaign.id, sentToday }, "daily quota reached");
    return;
  }

  // Distribui o restante uniformemente nas horas úteis restantes.
  // Ex: 30/dia, restam 5h, já mandou 10 → faltam 20 / 5h = 4/h.
  // Tick roda a cada PROSPECT_TICK_MS (padrão 5min = 12 ticks/h),
  // então enfileira ceil(4 / 12) = 1 por tick. Pouco e contínuo, parece humano.
  const hoursLeft = campaign.work_hours_only ? workHoursRemainingToday() : 24;
  const perHour = remainingToday / Math.max(hoursLeft, 1);
  const ticksPerHour = (60 * 60 * 1000) / config.PROSPECT_TICK_MS;
  const perTick = Math.max(1, Math.ceil(perHour / ticksPerHour));

  const batch = await pickNextPendingBatch(campaign.id, perTick);
  if (batch.length === 0) {
    // sem mais pending? marca como done
    logger.info({ campaignId: campaign.id }, "no more pending prospects → marking done");
    await updateCampaignStatus(campaign.id, "done");
    return;
  }

  for (const p of batch) {
    const jitter = randomJitterMs();
    const delayMs = Math.max(0, jitter); // só jitter positivo, não atrasar pro passado
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
        // job já enfileirado, ok
        continue;
      }
      logger.error({ err, prospectId: p.id }, "failed to enqueue prospect");
    }
  }

  logger.info(
    { campaignId: campaign.id, enqueued: batch.length, perTick, hoursLeft, sentToday },
    "prospect tick: enqueued batch",
  );
}

// Chamado quando o usuário clica "Iniciar" no UI.
export async function startCampaign(id: number): Promise<void> {
  const c = await getCampaign(id);
  if (!c) throw new Error("campaign not found");
  await updateCampaignStatus(id, "running");
  // tick imediato pra não esperar 5min até o primeiro envio
  await tickCampaign({ ...c, status: "running" });
}

export async function pauseCampaign(id: number): Promise<void> {
  await updateCampaignStatus(id, "paused");
}
