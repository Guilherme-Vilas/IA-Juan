-- Alertas operacionais no WhatsApp (handoff, reunião agendada, SLA, tarefas):
-- número dedicado configurável no painel + liga/desliga por tenant.
-- alert_whatsapp_e164 vazio = usa o owner_whatsapp_e164 (comportamento atual).
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS alert_whatsapp_e164 TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN NOT NULL DEFAULT true;
