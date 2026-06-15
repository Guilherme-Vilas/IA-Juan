import pino from "pino";
import { config } from "../config.js";

// Sanitiza erros do Axios: o objeto cru inclui request/response/socket (8KB+)
// e pode vazar apikey/token/conteudo de mensagem nos logs. Reduz pra o essencial.
function sanitizeError(err: unknown): unknown {
  if (!err || typeof err !== "object") return err;
  const e = err as Record<string, unknown>;

  // Heuristica de erro Axios
  const isAxios = e.isAxiosError === true || (e.config && e.request);
  if (isAxios) {
    const cfg = (e.config ?? {}) as Record<string, unknown>;
    const res = (e.response ?? {}) as Record<string, unknown>;
    const method = typeof cfg.method === "string" ? cfg.method.toUpperCase() : undefined;
    const baseURL = typeof cfg.baseURL === "string" ? cfg.baseURL : "";
    const url = typeof cfg.url === "string" ? cfg.url : "";
    return {
      type: "AxiosError",
      message: typeof e.message === "string" ? e.message : "axios error",
      status: (res.status as number) ?? (e.status as number) ?? undefined,
      method,
      url: stripQueryToken(`${baseURL}${url}`),
      data: truncate(res.data),
    };
  }

  // Erro generico: mantem message/status/stack curto, descarta o resto.
  return {
    type: (e.name as string) ?? "Error",
    message: (e.message as string) ?? String(err),
    status: (e.status as number) ?? undefined,
    code: (e.code as string) ?? undefined,
  };
}

function stripQueryToken(url: string): string {
  return url.replace(/([?&]token=)[^&]+/gi, "$1***");
}

function truncate(v: unknown, max = 300): unknown {
  if (v == null) return v;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + "…(truncated)" : (typeof v === "string" ? v : v);
}

export const logger = pino({
  level: config.LOG_LEVEL,
  serializers: {
    // Pino usa o serializer `err` para qualquer campo `err`/`error`.
    err: sanitizeError,
    error: sanitizeError,
  },
  transport:
    config.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
      : undefined,
});
