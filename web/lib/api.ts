const FASTIFY = process.env.FASTIFY_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.ADMIN_API_TOKEN ?? "";

export async function adminCall(path: string, init?: RequestInit) {
  const res = await fetch(`${FASTIFY}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": TOKEN,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Fastify admin ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export const adminApi = {
  pause: (waId: string) => adminCall(`/admin/leads/${waId}/pause`, { method: "POST" }),
  reopen: (waId: string) => adminCall(`/admin/leads/${waId}/reopen`, { method: "POST" }),
  close: (waId: string, reason: string) =>
    adminCall(`/admin/leads/${waId}/close`, { method: "POST", body: JSON.stringify({ reason }) }),
  send: (waId: string, text: string) =>
    adminCall(`/admin/leads/${waId}/send`, { method: "POST", body: JSON.stringify({ text }) }),
  setState: (waId: string, state: string) =>
    adminCall(`/admin/leads/${waId}/state`, { method: "POST", body: JSON.stringify({ state }) }),
};

export const campaignApi = {
  list: () => adminCall(`/admin/campaigns`, { method: "GET" }),
  get: (id: number) => adminCall(`/admin/campaigns/${id}`, { method: "GET" }),
  create: (body: Record<string, unknown>) =>
    adminCall(`/admin/campaigns`, { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Record<string, unknown>) =>
    adminCall(`/admin/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => adminCall(`/admin/campaigns/${id}`, { method: "DELETE" }),
  uploadCsv: (id: number, csv: string) =>
    adminCall(`/admin/campaigns/${id}/prospects`, { method: "POST", body: JSON.stringify({ csv }) }),
  preview: (id: number, limit = 3) =>
    adminCall(`/admin/campaigns/${id}/preview`, { method: "POST", body: JSON.stringify({ limit }) }),
  start: (id: number) => adminCall(`/admin/campaigns/${id}/start`, { method: "POST" }),
  pause: (id: number) => adminCall(`/admin/campaigns/${id}/pause`, { method: "POST" }),
};

export const prospectApi = {
  markSent: (id: number) => adminCall(`/admin/prospects/${id}/mark-sent`, { method: "POST" }),
  skip: (id: number, reason?: string) =>
    adminCall(`/admin/prospects/${id}/skip`, { method: "POST", body: JSON.stringify({ reason }) }),
};
