-- Vendedor atribuído recebe notificação no WhatsApp DELE (antes tudo ia só pro
-- dono da conta). Telefone é opcional — sem ele, o alerta cai no dono.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS whatsapp_e164 TEXT NOT NULL DEFAULT '';
