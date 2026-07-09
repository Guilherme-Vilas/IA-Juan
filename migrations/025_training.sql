-- Área de Treinamentos: catálogo global de vídeos (superadmin gerencia),
-- liberação por tenant e progresso por usuário.

CREATE TABLE IF NOT EXISTS training_videos (
  id           BIGSERIAL PRIMARY KEY,
  module       TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  -- URL do vídeo (YouTube não listado, Vimeo, Loom...) — o front converte pra embed.
  video_url    TEXT NOT NULL DEFAULT '',
  duration_min INTEGER,
  position     INTEGER NOT NULL DEFAULT 0,
  published    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS training_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS training_progress (
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id     BIGINT NOT NULL REFERENCES training_videos(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

-- Currículo pré-cadastrado como RASCUNHO (published=false): é só gravar,
-- colar a URL no gerenciador e publicar. Semeia apenas se a tabela está vazia.
INSERT INTO training_videos (module, title, description, duration_min, position)
SELECT * FROM (VALUES
  ('1. Primeiros passos', 'Tour geral pelo painel', 'O que é cada área do sistema e onde encontrar as coisas.', 3, 1),
  ('1. Primeiros passos', 'Conectando seu WhatsApp (QR code)', 'Como conectar o número e o que é o aquecimento do chip.', 4, 2),
  ('1. Primeiros passos', 'Conhecendo a Stella', 'Como a IA atende, qualifica e agenda — o coração da plataforma.', 4, 3),
  ('2. Pipeline & CRM', 'O funil: colunas, cards e score', 'Entendendo quente/morno/frio e a leitura do pipeline.', 3, 10),
  ('2. Pipeline & CRM', 'A ficha do lead', 'Slots, valor do negócio, notas e tarefas.', 4, 11),
  ('2. Pipeline & CRM', 'Movendo leads e Ganho/Perdido', 'Arrastar etapas, desfecho e motivo de perda.', 3, 12),
  ('2. Pipeline & CRM', 'Configurando etapas e SLA', 'Personalizando o funil pro seu processo.', 3, 13),
  ('2. Pipeline & CRM', 'Distribuição de leads (round-robin)', 'Como os leads novos são divididos entre a equipe.', 2, 14),
  ('3. Você + a IA', 'Assumindo uma conversa (takeover)', 'Como entrar na conversa, pausar a IA e devolver pra ela.', 3, 20),
  ('3. Você + a IA', 'Agenda: Google Calendar e bloqueios', 'Conectando a agenda e bloqueando horários.', 3, 21),
  ('4. Personalizando a Stella', 'Editando o tom e as regras da IA', 'A aba Personalização na prática.', 4, 30),
  ('4. Personalizando a Stella', 'Base de conhecimento', 'Ensinando a IA sobre o SEU negócio.', 3, 31),
  ('4. Personalizando a Stella', 'Regras de preço e limites', 'O que a IA nunca deve dizer.', 3, 32),
  ('5. Imóveis', 'Cadastro e importador universal', 'CSV, Excel, PDF ou link virando imóvel cadastrado.', 4, 40),
  ('5. Imóveis', 'Match da IA', 'Como ela oferece o imóvel certo pro perfil do lead.', 2, 41),
  ('5. Imóveis', 'Feed XML para os portais', 'Publicando o catálogo automaticamente.', 2, 42),
  ('6. Prospecção ativa', 'Sua primeira campanha', 'Criando a campanha e importando uma lista.', 4, 50),
  ('6. Prospecção ativa', 'Cadência multi-etapa e A/B', 'Follow-ups automáticos e variantes de mensagem.', 4, 51),
  ('6. Prospecção ativa', 'Boas práticas anti-banimento', 'Limites, aquecimento de chip e opt-out.', 4, 52),
  ('6. Prospecção ativa', 'Buscar leads com créditos', 'Filtros de ICP, busca validada e campanha em 1 clique.', 4, 53),
  ('7. Gestão', 'Métricas: lendo o funil e o ROI', 'Os números que importam e como agir sobre eles.', 3, 60),
  ('7. Gestão', 'Usuários, convites e captura de leads', 'Montando a equipe e ligando formulários/anúncios.', 3, 61)
) AS seed(module, title, description, duration_min, position)
WHERE NOT EXISTS (SELECT 1 FROM training_videos);
