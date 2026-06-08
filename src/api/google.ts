import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import {
  authUrl,
  authUrlForTenant,
  chooseCalendar,
  listUserCalendars,
  saveTokensFromCode,
  saveTokensFromCodeForTenant,
  verifyGoogleOAuthState,
} from "../core/calendar.js";
import { deleteGoogleTokens, getGoogleTokens } from "../core/google-tokens.js";
import { getTenantBySlug, requireTenantBySlug } from "../core/tenants.js";
import { logger } from "../core/logger.js";

function requireAdmin(token: string | undefined): boolean {
  const expected = process.env.ADMIN_API_TOKEN ?? "";
  return !!expected && token === expected;
}

function connectUrl(slug: string): string {
  return `${config.PUBLIC_BASE_URL}/oauth/google/start?tenant=${encodeURIComponent(slug)}`;
}

export async function registerGoogleRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/admin/")) return;
    const token = (req.headers["x-admin-token"] as string | undefined) ?? "";
    if (!requireAdmin(token)) {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.get("/oauth/google/start", async (req, reply) => {
    try {
      const q = req.query as { tenant?: string };
      if (!q.tenant) return reply.redirect(authUrl());
      const tenant = await getTenantBySlug(q.tenant);
      if (!tenant) return reply.code(404).send({ error: "tenant not found" });
      return reply.redirect(authUrlForTenant(tenant.slug));
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });

  app.get("/oauth/google/callback", async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code) return reply.code(400).send({ error: "missing code" });

    try {
      if (state) {
        const { tenant: slug } = verifyGoogleOAuthState(state);
        const tenant = await requireTenantBySlug(slug);
        await saveTokensFromCodeForTenant(tenant, code);
        logger.info({ tenant: tenant.slug }, "google oauth completed");
      } else {
        await saveTokensFromCode(code);
        logger.info("google oauth completed (legacy default tenant)");
      }

      return reply.type("text/html; charset=utf-8").send(`
        <!doctype html>
        <html lang="pt-BR">
          <head><meta charset="utf-8"><title>Google conectado</title></head>
          <body style="font-family: system-ui, sans-serif; padding: 32px;">
            <h1>Google Calendar conectado.</h1>
            <p>Pode fechar esta aba e voltar para o painel.</p>
            <script>setTimeout(() => window.close(), 1500)</script>
          </body>
        </html>
      `);
    } catch (err) {
      logger.error({ err }, "google oauth callback failed");
      return reply.code(500).send({ error: String(err) });
    }
  });

  app.get("/admin/tenants/:slug/google/status", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    const row = await getGoogleTokens(tenant.id);
    return {
      connected: !!row?.refresh_token || !!row?.access_token,
      connect_url: connectUrl(slug),
      owner_email: row?.owner_email ?? null,
      calendar_id: row?.calendar_id ?? "primary",
      scope: row?.scope ?? null,
      expires_at: row?.expiry_date ? new Date(row.expiry_date).toISOString() : null,
      updated_at: row?.updated_at ?? null,
    };
  });

  app.get("/admin/tenants/:slug/google/calendars", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    try {
      return { calendars: await listUserCalendars(tenant) };
    } catch (err) {
      logger.error({ err, tenant: slug }, "google calendars list failed");
      return reply.code(500).send({ error: String(err) });
    }
  });

  app.patch("/admin/tenants/:slug/google/calendar", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const body = req.body as { calendar_id?: string };
    const calendarId = (body.calendar_id ?? "").trim();
    if (!calendarId) return reply.code(400).send({ error: "calendar_id required" });
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    await chooseCalendar(tenant, calendarId);
    return { ok: true, calendar_id: calendarId };
  });

  app.delete("/admin/tenants/:slug/google", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return reply.code(404).send({ error: "tenant not found" });
    await deleteGoogleTokens(tenant.id);
    return { ok: true };
  });
}
