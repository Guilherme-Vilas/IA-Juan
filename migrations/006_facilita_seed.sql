-- Atualiza tenant `facilita` com dados reais do briefing (Apolar - Centro SJP, socios Juan e Hugo).
-- `active` continua false: usuario revisa prompts antes de virar a chave.
-- `owner_whatsapp_e164` segue placeholder; trocar pelo numero real do Juan/Hugo antes de ativar.

UPDATE tenants
   SET name = 'Apolar Imóveis - Centro SJP',
       owner_name = 'Juan e Hugo',
       timezone = 'America/Sao_Paulo',
       work_start_hour = 9,
       work_end_hour = 18,
       meeting_duration_min = 60,
       updated_at = now()
 WHERE slug = 'facilita';
