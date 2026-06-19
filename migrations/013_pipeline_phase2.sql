-- CRM Fase 2: desfechos Ganho/Perdido, tempo-em-etapa/SLA, objetivo da IA por etapa.

-- Leads: resultado comercial (won/lost) + relogio de etapa.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS outcome TEXT CHECK (outcome IN ('won','lost')),
  ADD COLUMN IF NOT EXISTS outcome_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS outcome_at TIMESTAMPTZ,
  -- quando o lead entrou na etapa atual (base do tempo-em-etapa / SLA).
  ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- evita re-alertar o mesmo lead/etapa; zerado a cada troca de etapa.
  ADD COLUMN IF NOT EXISTS sla_alerted_at TIMESTAMPTZ;

-- Etapas: SLA (horas ate "esfriar") + objetivo que a IA persegue nesta etapa.
ALTER TABLE pipeline_stages
  ADD COLUMN IF NOT EXISTS sla_hours INT,
  ADD COLUMN IF NOT EXISTS ai_goal TEXT NOT NULL DEFAULT '';

-- Inicializa o relogio de etapa nos leads existentes (usa updated_at como proxy).
UPDATE leads SET stage_entered_at = COALESCE(updated_at, now())
 WHERE stage_entered_at IS NULL;
