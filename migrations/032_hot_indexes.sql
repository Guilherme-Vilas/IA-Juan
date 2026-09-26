-- Índices das queries quentes dos scans periódicos (rodam a cada tick).

-- scan de no_reply nas automações
CREATE INDEX IF NOT EXISTS idx_leads_noreply
  ON leads (tenant_id, status, last_user_at);

-- scan de SLA por etapa (parcial: só o que ainda pode alertar)
CREATE INDEX IF NOT EXISTS idx_leads_sla_scan
  ON leads (pipeline_stage_id, stage_entered_at)
  WHERE status = 'open' AND sla_alerted_at IS NULL;

-- dispatcher de prospecção (fila do que está pronto pra enviar)
CREATE INDEX IF NOT EXISTS idx_prospects_dispatch
  ON prospects (campaign_id, status, next_step_at);

-- lembretes de tarefas (parcial: pendentes com prazo)
CREATE INDEX IF NOT EXISTS idx_lead_tasks_reminder
  ON lead_tasks (due_at)
  WHERE done_at IS NULL AND reminded_at IS NULL AND due_at IS NOT NULL;

-- reativação de leads mortos (lead_dormant)
CREATE INDEX IF NOT EXISTS idx_leads_dormant_closed
  ON leads (tenant_id, closed_reason, closed_at) WHERE status = 'closed';
CREATE INDEX IF NOT EXISTS idx_leads_dormant_lost
  ON leads (tenant_id, outcome_at) WHERE outcome = 'lost';
