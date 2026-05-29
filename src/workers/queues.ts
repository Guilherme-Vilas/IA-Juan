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

export const inboundQueue = new Queue<InboundJob>("inbound", bullConnection);
export const followupQueue = new Queue<FollowupJob>("followup", bullConnection);
export const prospectSendQueue = new Queue<ProspectSendJob>("prospect-send", bullConnection);

export function debounceJobId(tenantId: number, waId: string): string {
  return `debounce-${tenantId}-${waId}`;
}

export function followupJobId(tenantId: number, waId: string, stage: 1 | 2 | 3): string {
  return `followup-${tenantId}-${stage}-${waId}`;
}

export function prospectSendJobId(prospectId: number): string {
  return `prospect-send-${prospectId}`;
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
