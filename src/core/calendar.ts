import crypto from "node:crypto";
import { google, calendar_v3 } from "googleapis";
import { DateTime, Interval } from "luxon";
import { config } from "../config.js";
import { logger } from "./logger.js";
import type { TenantRow } from "./tenants.js";
import {
  getGoogleTokens,
  setGoogleCalendarId,
  updateGoogleAccessTokens,
  upsertGoogleTokens,
} from "./google-tokens.js";
import { listInternalBusyIntervals, listWorkingWindows } from "./internal-calendar.js";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
];

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

function stateSecret(): string {
  return config.GOOGLE_OAUTH_STATE_SECRET || config.EVOLUTION_WEBHOOK_TOKEN;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", stateSecret()).update(payload).digest("base64url");
}

export function makeGoogleOAuthState(tenantSlug: string): string {
  const payload = b64url(
    JSON.stringify({
      tenant: tenantSlug,
      ts: Date.now(),
      nonce: crypto.randomBytes(12).toString("hex"),
    }),
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyGoogleOAuthState(state: string): { tenant: string } {
  const [payload, sig] = state.split(".");
  if (!payload || !sig || sign(payload) !== sig) {
    throw new Error("invalid oauth state");
  }
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    tenant?: string;
    ts?: number;
  };
  if (!parsed.tenant || !parsed.ts) throw new Error("invalid oauth state payload");
  if (Date.now() - parsed.ts > 30 * 60 * 1000) throw new Error("oauth state expired");
  return { tenant: parsed.tenant };
}

export function authUrlForTenant(tenantSlug: string): string {
  const oauth2 = makeOAuth2();
  if (!oauth2) throw new Error("Google OAuth not configured in env");
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    state: makeGoogleOAuthState(tenantSlug),
  });
}

export async function saveTokensFromCodeForTenant(tenant: TenantRow, code: string) {
  const oauth2 = makeOAuth2();
  if (!oauth2) throw new Error("Google OAuth not configured");
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  let ownerEmail: string | null = null;
  try {
    const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
    const me = await oauth2Api.userinfo.get();
    ownerEmail = me.data.email ?? null;
  } catch (err) {
    logger.warn({ err, tenant: tenant.slug }, "google userinfo failed");
  }

  await upsertGoogleTokens(tenant.id, {
    owner_email: ownerEmail,
    access_token: tokens.access_token ?? null,
    refresh_token: tokens.refresh_token ?? null,
    scope: tokens.scope ?? GOOGLE_SCOPES.join(" "),
    token_type: tokens.token_type ?? "Bearer",
    expiry_date: typeof tokens.expiry_date === "number" ? tokens.expiry_date : null,
    calendar_id: "primary",
  });

  logger.info({ tenant: tenant.slug, ownerEmail }, "google tokens saved");
}

async function getClient(
  tenant: TenantRow,
): Promise<{ cal: calendar_v3.Calendar; calendarId: string } | null> {
  const oauth2 = makeOAuth2();
  if (!oauth2) return null;
  const tokens = await getGoogleTokens(tenant.id);
  if (!tokens?.refresh_token && !tokens?.access_token) return null;

  oauth2.setCredentials({
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    scope: tokens.scope ?? undefined,
    token_type: tokens.token_type ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  });

  oauth2.on("tokens", (next) => {
    void updateGoogleAccessTokens(tenant.id, {
      access_token: next.access_token ?? undefined,
      refresh_token: next.refresh_token ?? undefined,
      scope: next.scope ?? undefined,
      token_type: next.token_type ?? undefined,
      expiry_date: typeof next.expiry_date === "number" ? next.expiry_date : undefined,
    }).catch((err) => logger.warn({ err, tenant: tenant.slug }, "google token refresh save failed"));
  });

  return { cal: google.calendar({ version: "v3", auth: oauth2 }), calendarId: tokens.calendar_id };
}

export async function isConfigured(tenant: TenantRow): Promise<boolean> {
  return (await getClient(tenant)) !== null;
}

export async function listUserCalendars(tenant: TenantRow) {
  const client = await getClient(tenant);
  if (!client) return [];
  const res = await client.cal.calendarList.list({ maxResults: 250 });
  return (res.data.items ?? []).map((c) => ({
    id: c.id ?? "",
    summary: c.summary ?? c.id ?? "",
    primary: !!c.primary,
    accessRole: c.accessRole ?? "",
    selected: c.id === client.calendarId,
  }));
}

export async function chooseCalendar(tenant: TenantRow, calendarId: string) {
  const client = await getClient(tenant);
  if (!client) throw new Error("Google Calendar not connected");
  await client.cal.calendarList.get({ calendarId });
  await setGoogleCalendarId(tenant.id, calendarId);
}

export type Slot = { startISO: string; endISO: string; label: string };

// Minutos "quebrados" para parecer uma agenda real, nao automacao de massa.
const BROKEN_MINUTES = [15, 25, 40, 50, 35, 20, 45];

export async function listFreeSlots(tenant: TenantRow, daysAhead = 4): Promise<Slot[]> {
  const client = await getClient(tenant);
  const tz = tenant.timezone;
  const duration = tenant.meeting_duration_min;

  const now = DateTime.now().setZone(tz).plus({ hours: 2 });
  const windowEnd = now.plus({ days: daysAhead }).set({
    hour: tenant.work_end_hour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  let busy: Interval[] = await listInternalBusyIntervals(tenant.id, now, windowEnd);
  if (client) {
    try {
      const fb = await client.cal.freebusy.query({
        requestBody: {
          timeMin: now.toISO()!,
          timeMax: windowEnd.toISO()!,
          timeZone: tz,
          items: [{ id: client.calendarId }],
        },
      });
      const arr = fb.data.calendars?.[client.calendarId]?.busy ?? [];
      busy = busy.concat(
        arr
          .map((b) => {
            if (!b.start || !b.end) return null;
            return Interval.fromDateTimes(DateTime.fromISO(b.start), DateTime.fromISO(b.end));
          })
          .filter((i): i is Interval => !!i),
      );
    } catch (err) {
      logger.warn({ err, tenant: tenant.slug, calendarId: client.calendarId }, "freebusy failed; no slots returned");
      return [];
    }
  }

  const candidates: DateTime[] = [];
  const windows = await listWorkingWindows(tenant, now, windowEnd);
  let mIdx = 0;
  for (const window of windows) {
    if (!window.start || !window.end) continue;
    const windowEndTime = window.end;
    let cursor = window.start;
    while (cursor.plus({ minutes: duration }) <= windowEndTime) {
      const minute = BROKEN_MINUTES[mIdx % BROKEN_MINUTES.length]!;
      mIdx++;
      const candidate = cursor.set({ minute, second: 0, millisecond: 0 });
      if (candidate > now && candidate.plus({ minutes: duration }) <= windowEndTime) {
        candidates.push(candidate);
      }
      cursor = cursor.plus({ hours: 2 });
    }
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
      label: c.setLocale("pt-BR").toFormat("cccc dd/LL 'as' HH:mm"),
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
): Promise<{ eventId: string; provider: "internal" | "google" }> {
  const client = await getClient(tenant);
  if (!client) {
    logger.info({ tenant: tenant.slug }, "calendar not connected; using internal appointment only");
    return { eventId: `internal-${Date.now()}`, provider: "internal" };
  }
  const res = await client.cal.events.insert({
    calendarId: client.calendarId,
    requestBody: {
      summary: opts.summary ?? `Call ${opts.leadName} - ${tenant.name}`,
      description: opts.description ?? `WhatsApp: ${opts.leadWhatsapp}`,
      start: { dateTime: opts.startISO, timeZone: tenant.timezone },
      end: { dateTime: opts.endISO, timeZone: tenant.timezone },
      reminders: { useDefault: true },
    },
  });
  return { eventId: res.data.id ?? "", provider: "google" };
}
