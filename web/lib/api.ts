import { getSessionToken } from "./session";

const FASTIFY = process.env.FASTIFY_BASE_URL ?? "http://localhost:3000";

// Server-side helper: chama o Fastify autenticando como o USUÁRIO logado
// (JWT do cookie httpOnly como Bearer). O Fastify valida o vínculo user<->tenant.
export async function adminCall(path: string, init?: RequestInit) {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${FASTIFY}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Fastify admin ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// Tenants — listagem (server). Provisionamento é client-side via admin-proxy (QR no browser).
export const tenantsApi = {
  list: () => adminCall(`/admin/tenants`, { method: "GET" }),
};

// Leads — agora todos os endpoints sao per-tenant
export function leadActionsApi(slug: string) {
  return {
    pause: (waId: string) =>
      adminCall(`/admin/tenants/${slug}/leads/${waId}/pause`, { method: "POST" }),
    reopen: (waId: string) =>
      adminCall(`/admin/tenants/${slug}/leads/${waId}/reopen`, { method: "POST" }),
    close: (waId: string, reason: string) =>
      adminCall(`/admin/tenants/${slug}/leads/${waId}/close`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    send: (waId: string, text: string) =>
      adminCall(`/admin/tenants/${slug}/leads/${waId}/send`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    setState: (waId: string, state: string) =>
      adminCall(`/admin/tenants/${slug}/leads/${waId}/state`, {
        method: "POST",
        body: JSON.stringify({ state }),
      }),
  };
}

// Campanhas per-tenant
export function campaignApi(slug: string) {
  return {
    list: () => adminCall(`/admin/tenants/${slug}/campaigns`, { method: "GET" }),
    get: (id: number) => adminCall(`/admin/tenants/${slug}/campaigns/${id}`, { method: "GET" }),
    create: (body: Record<string, unknown>) =>
      adminCall(`/admin/tenants/${slug}/campaigns`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: number, body: Record<string, unknown>) =>
      adminCall(`/admin/tenants/${slug}/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    remove: (id: number) =>
      adminCall(`/admin/tenants/${slug}/campaigns/${id}`, { method: "DELETE" }),
    uploadCsv: (id: number, csv: string) =>
      adminCall(`/admin/tenants/${slug}/campaigns/${id}/prospects`, {
        method: "POST",
        body: JSON.stringify({ csv }),
      }),
    preview: (id: number, limit = 3) =>
      adminCall(`/admin/tenants/${slug}/campaigns/${id}/preview`, {
        method: "POST",
        body: JSON.stringify({ limit }),
      }),
    start: (id: number) =>
      adminCall(`/admin/tenants/${slug}/campaigns/${id}/start`, { method: "POST" }),
    pause: (id: number) =>
      adminCall(`/admin/tenants/${slug}/campaigns/${id}/pause`, { method: "POST" }),
  };
}

// Prospects sao global por id (mark-sent/skip)
export const prospectApi = {
  markSent: (id: number) =>
    adminCall(`/admin/prospects/${id}/mark-sent`, { method: "POST" }),
  skip: (id: number, reason?: string) =>
    adminCall(`/admin/prospects/${id}/skip`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};

export function googleApi(slug: string) {
  return {
    status: () => adminCall(`/admin/tenants/${slug}/google/status`, { method: "GET" }),
    calendars: () => adminCall(`/admin/tenants/${slug}/google/calendars`, { method: "GET" }),
    diagnostics: () => adminCall(`/admin/tenants/${slug}/google/diagnostics`, { method: "GET" }),
    setCalendar: (calendarId: string) =>
      adminCall(`/admin/tenants/${slug}/google/calendar`, {
        method: "PATCH",
        body: JSON.stringify({ calendar_id: calendarId }),
      }),
    disconnect: () => adminCall(`/admin/tenants/${slug}/google`, { method: "DELETE" }),
  };
}

export function calendarApi(slug: string) {
  return {
    workingHours: () => adminCall(`/admin/tenants/${slug}/working-hours`, { method: "GET" }),
    setWorkingHour: (weekday: number, body: Record<string, unknown>) =>
      adminCall(`/admin/tenants/${slug}/working-hours/${weekday}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    blocks: () => adminCall(`/admin/tenants/${slug}/calendar-blocks`, { method: "GET" }),
    createBlock: (body: Record<string, unknown>) =>
      adminCall(`/admin/tenants/${slug}/calendar-blocks`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    deleteBlock: (id: number) =>
      adminCall(`/admin/tenants/${slug}/calendar-blocks/${id}`, { method: "DELETE" }),
  };
}

export function agentApi(slug: string) {
  return {
    get: () => adminCall(`/admin/tenants/${slug}/agent-settings`, { method: "GET" }),
    update: (body: Record<string, unknown>) =>
      adminCall(`/admin/tenants/${slug}/agent-settings`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    playbooks: () => adminCall(`/admin/playbooks`, { method: "GET" }),
    setPlaybook: (playbookSlug: string) =>
      adminCall(`/admin/tenants/${slug}/playbook`, {
        method: "PATCH",
        body: JSON.stringify({ playbook_slug: playbookSlug }),
      }),
    getPrompts: () => adminCall(`/admin/tenants/${slug}/prompts`, { method: "GET" }),
    updatePrompts: (body: Record<string, unknown>) =>
      adminCall(`/admin/tenants/${slug}/prompts`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  };
}

export function pipelineApi(slug: string) {
  return {
    get: () => adminCall(`/admin/tenants/${slug}/pipeline`, { method: "GET" }),
    saveStages: (stages: unknown[]) =>
      adminCall(`/admin/tenants/${slug}/pipeline/stages`, {
        method: "PUT",
        body: JSON.stringify({ stages }),
      }),
    moveLead: (waId: string, toStageId: number, reason?: string) =>
      adminCall(`/admin/tenants/${slug}/leads/${waId}/move`, {
        method: "POST",
        body: JSON.stringify({ to_stage_id: toStageId, reason }),
      }),
    returnToAuto: (waId: string) =>
      adminCall(`/admin/tenants/${slug}/leads/${waId}/return-to-auto`, { method: "POST" }),
    stageEvents: (waId: string) =>
      adminCall(`/admin/tenants/${slug}/leads/${waId}/stage-events`, { method: "GET" }),
  };
}

export function knowledgeApi(slug: string) {
  return {
    list: () => adminCall(`/admin/tenants/${slug}/knowledge`, { method: "GET" }),
    create: (body: Record<string, unknown>) =>
      adminCall(`/admin/tenants/${slug}/knowledge`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    remove: (id: number) =>
      adminCall(`/admin/tenants/${slug}/knowledge/${id}`, { method: "DELETE" }),
    reindex: (id: number) =>
      adminCall(`/admin/tenants/${slug}/knowledge/${id}/reindex`, { method: "POST" }),
  };
}
