-- Tenant da demonstração pública da landing page.
-- A Stella real atende visitantes do site (sessões efêmeras, sem WhatsApp).
-- prompt_dir='demo' → o seed carrega os prompts de src/sdr/prompts/demo/.
-- evolution_instance é virtual: nunca conecta; envios são suprimidos no código.

INSERT INTO tenants
  (slug, name, evolution_instance, owner_whatsapp_e164, owner_name,
   timezone, work_start_hour, work_end_hour, meeting_duration_min, prompt_dir, active)
VALUES
  ('demo', 'Demo — Landing Page', 'demo-virtual', '', 'Equipe Vita OS',
   'America/Sao_Paulo', 0, 24, 30, 'demo', true)
ON CONFLICT (slug) DO NOTHING;
