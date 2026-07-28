-- Busca de leads: cada cliente contrata a PRÓPRIA API da Casa dos Dados.
-- A chave fica no tenant (colada pelo painel em Buscar leads → Fonte de dados)
-- e pode ser trocada/removida a qualquer momento. O env CASADOSDADOS_API_KEY
-- global vira fallback (útil pra demo/tenants internos).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS casadosdados_api_key TEXT;
