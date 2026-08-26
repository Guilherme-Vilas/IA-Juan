-- Mídia por passo da cadência: vídeo/áudio/imagem/documento enviados junto
-- da mensagem (imagem/vídeo/doc vão com o texto como legenda; áudio vai como
-- áudio + texto em mensagem separada).

ALTER TABLE campaign_steps
  ADD COLUMN IF NOT EXISTS media_type TEXT
    CHECK (media_type IN ('image','video','audio','document') OR media_type IS NULL),
  -- referência do arquivo no volume de mídia: "<tenantId>/<hash>.<ext>"
  ADD COLUMN IF NOT EXISTS media_ref TEXT,
  ADD COLUMN IF NOT EXISTS media_name TEXT;
