-- Multi-tenancy: cada tenant tem sua propria instancia Evolution, prompts, agenda Juan, timezone.
-- Backfill: tudo que ja existe vira tenant_id=1 (Juan), preservando comportamento atual.

CREATE TABLE IF NOT EXISTS tenants (
  id                    BIGSERIAL PRIMARY KEY,
  slug                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  evolution_instance    TEXT NOT NULL UNIQUE,
  owner_whatsapp_e164   TEXT NOT NULL,
  owner_name            TEXT NOT NULL DEFAULT '',
  timezone              TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  work_start_hour       INTEGER NOT NULL DEFAULT 9,
  work_end_hour         INTEGER NOT NULL DEFAULT 19,
  meeting_duration_min  INTEGER NOT NULL DEFAULT 15,
  prompt_dir            TEXT NOT NULL,
  active                BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Juan (tenant 1) com valores antigos do .env, pra nao perder configuracao
INSERT INTO tenants (slug, name, evolution_instance, owner_whatsapp_e164, owner_name, prompt_dir)
VALUES ('juan', 'Juan Monteiro - Consorcio', 'Juan', '5551999999999', 'Juan Monteiro', 'juan')
ON CONFLICT (slug) DO NOTHING;

-- Facilita Imob (tenant 2) — placeholder; usuario ajusta evolution_instance/owner_whatsapp depois
INSERT INTO tenants (slug, name, evolution_instance, owner_whatsapp_e164, owner_name, prompt_dir, active)
VALUES ('facilita', 'Facilita Imob', 'FacilitaImob', '5500000000000', 'Facilita Imob', 'facilita', false)
ON CONFLICT (slug) DO NOTHING;

-- ============== LEADS ==============
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1
  REFERENCES tenants(id);

-- Antes a unicidade era apenas wa_id. Agora o mesmo numero pode existir em tenants distintos.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_wa_id_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_tenant_wa_unique'
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_tenant_wa_unique UNIQUE (tenant_id, wa_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads (tenant_id);

-- ============== APPOINTMENTS ==============
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1
  REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments (tenant_id);

-- ============== CAMPAIGNS ==============
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1
  REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns (tenant_id);

-- ============== PROSPECTS ==============
-- Prospect tem tenant via campaign.tenant_id, mas ter colunizado evita joins em queries comuns.
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1
  REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_prospects_tenant ON prospects (tenant_id);
