import fs from "node:fs";
import path from "node:path";
import { google, calendar_v3 } from "googleapis";
import { DateTime, Interval } from "luxon";
import { config } from "../config.js";
import { logger } from "./logger.js";
import type { TenantRow } from "./tenants.js";

function makeOAuth2() {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.GOOGLE_REDIRECT_URI) {
    return null;
  }
  return new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI,
  );
}

export function authUrl(): string {
  const oauth2 = makeOAuth2();
  if (!oauth2) throw new Error("Google OAuth not configured in .env");
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
  });
}

export async function saveTokensFromCode(code: string) {
  const oauth2 = makeOAuth2();
  if (!oauth2) throw new Error("Google OAuth not configured");
  const { tokens } = await oauth2.getToken(code);
  const dir = path.dirname(config.GOOGLE_TOKENS_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(config.GOOGLE_TOKENS_PATH, JSON.stringify(tokens, null, 2));
  logger.info("google tokens saved");
}

function getClient(): calendar_v3.Calendar | null {
  const oauth2 = makeOAuth2();
  if (!oauth2) return null;
  if (!fs.existsSync(config.GOOGLE_TOKENS_PATH)) return null;
  const tokens = JSON.parse(fs.readFileSync(config.GOOGLE_TOKENS_PATH, "utf8"));
  oauth2.setCredentials(tokens);
  return google.calendar({ version: "v3", auth: oauth2 });
}

export function isConfigured(): boolean {
  return getClient() !== null;
}

export type Slot = { startISO: string; endISO: string; label: string };

// Minutos "quebrados" para parecer uma agenda real, não automação de massa.
const BROKEN_MINUTES = [15, 25, 40, 50, 35, 20, 45];

export async function listFreeSlots(tenant: TenantRow, daysAhead = 4): Promise<Slot[]> {
  const cal = getClient();
  const tz = tenant.timezone;
  const duration = tenant.meeting_duration_min;

  const now = DateTime.now().setZone(tz).plus({ hours: 2 });
  const windowEnd = now.plus({ days: daysAhead }).set({
    hour: tenant.work_end_hour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  let busy: Interval[] = [];
  if (cal) {
    try {
      const fb = await cal.freebusy.query({
        requestBody: {
          timeMin: now.toISO()!,
          timeMax: windowEnd.toISO()!,
          timeZone: tz,
          items: [{ id: config.GOOGLE_CALENDAR_ID }],
        },
      });
      const arr = fb.data.calendars?.[config.GOOGLE_CALENDAR_ID]?.busy ?? [];
      busy = arr
        .map((b) => {
          if (!b.start || !b.end) return null;
          return Interval.fromDateTimes(DateTime.fromISO(b.start), DateTime.fromISO(b.end));
        })
        .filter((i): i is Interval => !!i);
    } catch (err) {
      logger.warn({ err }, "freebusy failed; returning naive slots");
    }
  }

  const candidates: DateTime[] = [];
  let day = now.startOf("day");
  let mIdx = 0;
  while (day < windowEnd) {
    const weekday = day.weekday;
    if (weekday <= 5) {
      for (let h = tenant.work_start_hour; h < tenant.work_end_hour; h += 2) {
        const minute = BROKEN_MINUTES[mIdx % BROKEN_MINUTES.length]!;
        mIdx++;
        const candidate = day.set({ hour: h, minute, second: 0, millisecond: 0 });
        if (candidate <= now) continue;
        candidates.push(candidate);
      }
    }
    day = day.plus({ days: 1 });
  }

  const slots: Slot[] = [];
  for (const c of candidates) {
    if (slots.length >= 6) break;
    const end = c.plus({ minutes: duration });
    const candidate = Interval.fromDateTimes(c, end);
    if (busy.some((b) => b.overlaps(candidate))) continue;
    slots.push({
      startISO: c.toISO()!,
      endISO: end.toISO()!,
      label: c.setLocale("pt-BR").toFormat("cccc dd/LL 'às' HH:mm"),
    });
  }
  return slots;
}

export async function createEvent(
  tenant: TenantRow,
  opts: {
    startISO: string;
    endISO: string;
    leadName: string;
    leadWhatsapp: string;
    summary?: string;
    description?: string;
  },
): Promise<string> {
  const cal = getClient();
  if (!cal) {
    logger.warn("calendar not configured; returning fake event id");
    return `fake-${Date.now()}`;
  }
  const res = await cal.events.insert({
    calendarId: config.GOOGLE_CALENDAR_ID,
    requestBody: {
      summary: opts.summary ?? `Call ${opts.leadName} — ${tenant.name}`,
      description: opts.description ?? `WhatsApp: ${opts.leadWhatsapp}`,
      start: { dateTime: opts.startISO, timeZone: tenant.timezone },
      end: { dateTime: opts.endISO, timeZone: tenant.timezone },
      reminders: { useDefault: true },
    },
  });
  return res.data.id ?? "";
}
