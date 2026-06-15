import { Queue } from "bullmq";
import { bullConnection } from "../core/redis.js";

export type InboundJob = {
  tenantId: number;
  waId: string;
  pushName?: string;
};

export type FollowupJob = {
  tenantId: number;
  waId: string;
  stage: 1 | 2 | 3;
};

export type ProspectSendJob = {
  campaignId: number;
  prospectId: number;
};

// Retry humanizado: quando runTurn falha (erro LLM/API), Stella manda
// "Um minuto, ja te respondo" pro lead, agenda esse job, e quando ele
// dispara reproduz o turno SEM pedir o user repetir. Cap em 3 tentativas.
export type RetryTurnJob = {
  tenantId: number;
  waId: string;
  attempt: number; // 1..3
};

// Tick periodico de prospeccao — repeatable job (substitui setInterval in-process).
// Idempotente entre replicas: o BullMQ garante 1 disparo por janela mesmo com N workers.
export type ProspectTickJob = Record<string, never>;

export const inboundQueue = new Queue<InboundJob>("inbound", bullConnection);
export const followupQueue = new Queue<FollowupJob>("followup", bullConnection);
export const prospectSendQueue = new Queue<ProspectSendJob>("prospect-send", bullConnection);
export const prospectTickQueue = new Queue<ProspectTickJob>("prospect-tick", bullConnection);
export const retryTurnQueue = new Queue<RetryTurnJob>("retry-turn", bullConnection);

// Registra o repeatable job do tick. Chamar uma vez no boot do processo de workers.
// `jobId` fixo + repeat garante que so existe 1 schedule, mesmo com varias replicas.
export async function ensureProspectTickScheduled(everyMs: number) {
  // Limpa schedulers antigos pra evitar duplicatas se o intervalo mudou.
  const repeatables = await prospectTickQueue.getRepeatableJobs().catch(() => []);
  for (const r of repeatables) {
    if (r.id === "prospect-tick") {
      await prospectTickQueue.removeRepeatableByKey(r.key).catch(() => undefined);
    }
  }
  await prospectTickQueue.add(
    "tick",
    {},
    {
      jobId: "prospect-tick",
      repeat: { every: everyMs },
      removeOnComplete: true,
      removeOnFail: 20,
    },
  );
}

export function debounceJobId(tenantId: number, waId: string): string {
  return `debounce-${tenantId}-${waId}`;
}

export function followupJobId(tenantId: number, waId: string, stage: 1 | 2 | 3): string {
  return `followup-${tenantId}-${stage}-${waId}`;
}

export function prospectSendJobId(prospectId: number): string {
  return `prospect-send-${prospectId}`;
}

export function retryTurnJobId(tenantId: number, waId: string, attempt: number): string {
  return `retry-turn-${tenantId}-${waId}-${attempt}`;
}

export async function cancelFollowups(tenantId: number, waId: string) {
  for (const stage of [1, 2, 3] as const) {
    const id = followupJobId(tenantId, waId, stage);
    const job = await followupQueue.getJob(id);
    if (job) {
      try {
        await job.remove();
      } catch {
        // may already be active/completed; ignore
      }
    }
  }
}

export async function scheduleFollowup(
  tenantId: number,
  waId: string,
  stage: 1 | 2 | 3,
  delayMs: number,
) {
  const id = followupJobId(tenantId, waId, stage);
  const existing = await followupQueue.getJob(id);
  if (existing) {
    try {
      await existing.remove();
    } catch {
      // ignore
    }
  }
  await followupQueue.add(
    "tick",
    { tenantId, waId, stage },
    {
      jobId: id,
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );
}
