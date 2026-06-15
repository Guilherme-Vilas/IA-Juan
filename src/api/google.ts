import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import {
  authUrlForTenant,
  chooseCalendar,
  isConfigured,
  listFreeSlots,
  listUserCalendars,
  saveTokensFromCodeForTenant,
  verifyGoogleOAuthState,
} from "../core/calendar.js";
import { deleteGoogleTokens, getGoogleTokens } from "../core/google-tokens.js";
import { getTenantBySlug, requireTenantBySlug } from "../core/tenants.js";
import { logger } from "../core/logger.js";

function connectUrl(slug: string): string {
  return `${config.PUBLIC_BASE_URL}/oauth/google/start?tenant=${encodeURIComponent(slug)}`;
}

export async function registerGoogleRoutes(app: FastifyInstance) {
  // ===== OAuth (publico — redirects de navegador, protegidos por state HMAC) =====
  app.get("/oauth/google/start", async (req, reply) => {
    const q = req.query as { tenant?: string };
    if (!q.tenant) return reply.code(400).send({ error: "tenant slug required" });
    const tenant = await getTenantBySlug(q.tenant);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    return reply.redirect(authUrlForTenant(tenant.slug));
  });

  app.get("/oauth/google/callback", async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) return reply.code(400).send({ error: "missing code/state" });
    try {
      const { tenant: slug } = verifyGoogleOAuthState(state);
      const tenant = await requireTenantBySlug(slug);
      await saveTokensFromCodeForTenant(tenant, code);
      logger.info({ tenant: tenant.slug }, "google oauth completed");
      return reply.type("text/html; charset=utf-8").send(`
        <!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Google conectado</title></head>
        <body style="font-family: system-ui, sans-serif; padding: 32px;">
          <h1>Google Calendar conectado.</h1>
          <p>Pode fechar esta aba e voltar para o painel.</p>
          <script>setTimeout(() => window.close(), 1500)</script>
        </body></html>`);
    } catch (err) {
      logger.error({ err }, "google oauth callback failed");
      return reply.code(500).send({ error: String(err) });
    }
  });

  // ===== Admin por tenant — auth + cross-check =====
  app.register(async (scope) => {
    scope.addHook("onRequest", scope.authenticate);
    scope.addHook("preHandler", scope.requireTenant);

    scope.get("/admin/tenants/:slug/google/status", async (req) => {
      const row = await getGoogleTokens(req.tenantId!);
      return {
        connected: !!row?.refresh_token || !!row?.access_token,
        connect_url: connectUrl(req.tenantSlug!),
        owner_email: row?.owner_email ?? null,
        calendar_id: row?.calendar_id ?? "primary",
        scope: row?.scope ?? null,
        expires_at: row?.expiry_date ? new Date(row.expiry_date).toISOString() : null,
        updated_at: row?.updated_at ?? null,
      };
    });

    scope.get("/admin/tenants/:slug/google/calendars", async (req, reply) => {
      const tenant = await getTenantBySlug(req.tenantSlug!);
      if (!tenant) return reply.code(404).send({ error: "tenant not found" });
      try {
        return { calendars: await listUserCalendars(tenant) };
      } catch (err) {
        logger.error({ err, tenant: req.tenantSlug }, "google calendars list failed");
        return reply.code(500).send({ error: String(err) });
      }
    });

    scope.get("/admin/tenants/:slug/google/diagnostics", async (req, reply) => {
      const tenant = await getTenantBySlug(req.tenantSlug!);
      if (!tenant) return reply.code(404).send({ error: "tenant not found" });
      const row = await getGoogleTokens(tenant.id);
      const connected = await isConfigured(tenant);
      let calendars: Awaited<ReturnType<typeof listUserCalendars>> = [];
      let slots: Awaited<ReturnType<typeof listFreeSlots>> = [];
      let calendarsError: string | null = null;
      let slotsError: string | null = null;
      try {
        calendars = await listUserCalendars(tenant);
      } catch (err) {
        calendarsError = String(err);
      }
      try {
        slots = await listFreeSlots(tenant, 4);
      } catch (err) {
        slotsError = String(err);
      }
      return {
        ok: connected && !calendarsError && !slotsError,
        connected,
        owner_email: row?.owner_email ?? null,
        calendar_id: row?.calendar_id ?? "primary",
        calendars,
        slots: slots.slice(0, 6),
        calendars_error: calendarsError,
        slots_error: slotsError,
      };
    });

    scope.patch("/admin/tenants/:slug/google/calendar", async (req, reply) => {
      const body = req.body as { calendar_id?: string };
      const calendarId = (body.calendar_id ?? "").trim();
      if (!calendarId) return reply.code(400).send({ error: "calendar_id required" });
      const tenant = await getTenantBySlug(req.tenantSlug!);
      if (!tenant) return reply.code(404).send({ error: "tenant not found" });
      await chooseCalendar(tenant, calendarId);
      return { ok: true, calendar_id: calendarId };
    });

    scope.delete("/admin/tenants/:slug/google", async (req) => {
      await deleteGoogleTokens(req.tenantId!);
      return { ok: true };
    });
  });
}
