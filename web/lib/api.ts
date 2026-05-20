const FASTIFY = process.env.FASTIFY_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.ADMIN_API_TOKEN ?? "";

async function adminCall(path: string, init?: RequestInit) {
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
