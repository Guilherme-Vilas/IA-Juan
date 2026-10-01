-- Recontato intencional: na importação dá pra marcar "permitir recontato" —
-- ignora a janela de 90 dias e a trava de lead existente (refazer campanha,
-- testes). A flag viaja com o prospect até a hora do envio. A BLACKLIST
-- (opt-out/LGPD) continua valendo SEMPRE, com ou sem a flag.

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS allow_recontact BOOLEAN NOT NULL DEFAULT false;
