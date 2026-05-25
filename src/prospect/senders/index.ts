import type { CampaignRow, ProspectRow } from "../repo.js";

export type SendResult =
  | { status: "sent" }
  | { status: "ready_for_manual"; deepLink: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export interface Sender {
  send: (campaign: CampaignRow, prospect: ProspectRow, text: string) => Promise<SendResult>;
}
