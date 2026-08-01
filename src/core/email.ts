import { config } from "../config.js";
import { logger } from "./logger.js";

// ============================================================================
// E-mail transacional via Resend (https://resend.com).
// Uso: sendEmail() genérico + templates prontos (convite, boas-vindas, código
// de acesso). Sem RESEND_API_KEY configurada, tudo degrada com elegância —
// quem chama decide se o e-mail é crítico (await+throw) ou best-effort.
// A mesma fundação serve pro e-mail marketing depois (broadcast = sendEmail
// em lote com template próprio + descadastro).
// ============================================================================

export function emailEnabled(): boolean {
  return !!config.RESEND_API_KEY;
}

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
}): Promise<void> {
  if (!emailEnabled()) {
    logger.debug({ to: input.to, subject: input.subject }, "email suprimido (RESEND_API_KEY ausente)");
    return;
  }
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`${config.RESEND_BASE_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: config.EMAIL_FROM,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.replyTo || config.EMAIL_REPLY_TO
          ? { reply_to: input.replyTo ?? config.EMAIL_REPLY_TO }
          : {}),
        ...(input.headers ? { headers: input.headers } : {}),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`resend ${res.status}: ${body.slice(0, 300)}`);
    }
    logger.info({ to: input.to, subject: input.subject }, "email enviado");
  } finally {
    clearTimeout(timeout);
  }
}

// ===== Template da marca (dark + bronze, e-mail-safe com estilos inline) =====

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderEmail(opts: {
  title: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  footerNote?: string;
}): string {
  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 8px"><tr><td style="border-radius:8px;background:linear-gradient(180deg,#C9A876,#B08D57)">
        <a href="${opts.cta.url}" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#0A0A0C;text-decoration:none">${escapeHtml(opts.cta.label)}</a>
      </td></tr></table>`
    : "";
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0C">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0C;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td align="center" style="padding-bottom:24px">
          <div style="display:inline-block;width:44px;height:44px;line-height:44px;border-radius:10px;background:#16161A;border:1px solid rgba(176,141,87,.45);text-align:center;font-family:Georgia,serif;font-size:22px;color:#C9A876">V</div>
          <div style="font-family:Georgia,serif;font-size:20px;color:#E6E6E6;margin-top:10px">Vita OS</div>
        </td></tr>
        <tr><td style="background:#16161A;border:1px solid #232329;border-radius:14px;padding:32px 28px">
          <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;font-weight:normal;color:#E6E6E6">${escapeHtml(opts.title)}</h1>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:#A1A1AA">${opts.bodyHtml}</div>
          ${cta}
        </td></tr>
        <tr><td align="center" style="padding-top:20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#52525B">
          ${escapeHtml(opts.footerNote ?? "Vita OS · systemvita.com.br")}<br>
          Se você não esperava este e-mail, pode ignorá-lo com segurança.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ===== Templates prontos =====

export async function sendInviteEmail(to: string, inviteUrl: string, note?: string | null): Promise<void> {
  await sendEmail({
    to,
    subject: "Seu convite pra Vita OS chegou",
    html: renderEmail({
      title: "Você foi convidado pra Vita OS",
      bodyHtml: `Você recebeu um convite pra acessar a plataforma de atendimento e vendas com IA.${
        note ? `<br><br><em style="color:#C9A876">"${escapeHtml(note)}"</em>` : ""
      }<br><br>O link é pessoal, de uso único e expira em breve — ative sua conta agora:`,
      cta: { label: "Ativar minha conta", url: inviteUrl },
    }),
  });
}

export async function sendWelcomeEmail(to: string, name: string | null): Promise<void> {
  await sendEmail({
    to,
    subject: "Bem-vindo à Vita OS — seu acesso está pronto",
    html: renderEmail({
      title: `${name ? escapeHtml(name.split(" ")[0]!) + ", seu" : "Seu"} acesso está pronto`,
      bodyHtml:
        "Sua conta na Vita OS foi criada. Entre com o e-mail e a senha definidos no cadastro.<br><br>" +
        "Primeiro passo recomendado: abra a aba <strong style=\"color:#E6E6E6\">Treinamentos</strong> e veja o tour de 3 minutos.",
      cta: { label: "Entrar na plataforma", url: config.APP_PUBLIC_URL },
    }),
  });
}

export async function sendResetCodeEmail(to: string, code: string): Promise<void> {
  await sendEmail({
    to,
    subject: `${code} é o seu código de acesso — Vita OS`,
    html: renderEmail({
      title: "Seu código de acesso",
      bodyHtml:
        `Use o código abaixo pra redefinir a sua senha. Ele vale por <strong style="color:#E6E6E6">15 minutos</strong>.` +
        `<div style="margin:24px 0;text-align:center"><span style="display:inline-block;padding:14px 28px;border-radius:10px;background:#0A0A0C;border:1px solid rgba(176,141,87,.45);font-family:'Courier New',monospace;font-size:30px;letter-spacing:10px;color:#C9A876">${escapeHtml(code)}</span></div>` +
        `Se você não pediu a troca de senha, ignore este e-mail — sua conta continua segura.`,
    }),
  });
}
