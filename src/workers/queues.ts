import { Queue } from "bullmq";
import { bullConnection } from "../core/redis.js";

export type InboundJob = {
  waId: string;
  pushName?: string;
};

export type FollowupJob = {
  waId: string;
  stage: 1 | 2 | 3;
};

export const inboundQueue = new Queue<InboundJob>("inbound", bullConnection);
export const followupQueue = new Queue<FollowupJob>("followup", bullConnection);

export function debounceJobId(waId: string): string {
  return `debounce-${waId}`;
}

export function followupJobId(waId: string, stage: 1 | 2 | 3): string {
  return `followup-${stage}-${waId}`;
}

export async function cancelFollowups(waId: string) {
  for (const stage of [1, 2, 3] as const) {
    const id = followupJobId(waId, stage);
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

export async function scheduleFollowup(waId: string, stage: 1 | 2 | 3, delayMs: number) {
  const id = followupJobId(waId, stage);
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
    { waId, stage },
    {
      jobId: id,
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );
}
