# IA Juan — SDR WhatsApp

IA conversacional no WhatsApp que atua como **SDR** do Juan Monteiro: acolhe o lead, qualifica, trata objeção-chave e agenda uma call de 15 min no Google Calendar.

## Stack

- **TypeScript** (Node 20+) / Fastify
- **Evolution API** — WhatsApp (webhook in, REST out)
- **Groq** — `llama-3.3-70b-versatile` (diálogo + tool calling) + `llama-3.1-8b-instant` (classificação) + `whisper-large-v3` (transcrição de áudio)
- **Redis** — estado por lead, histórico de 16 turnos, debounce buffer, BullMQ
- **Postgres** — leads, mensagens, agendamentos
- **Google Calendar** — freebusy + criação de evento

## Arquitetura

```
WhatsApp → Evolution → POST /webhook/evolution
                          │
                          ├─ áudio? → Whisper (Groq)
                          ├─ append no buffer Redis
                          └─ enfileira job com jobId=debounce:<waId>, delay=5s
                                      │
                         (novas mensagens no mesmo waId reusam o jobId —
                          job só executa depois de 5s de silêncio)
                                      │
                                      ▼
                          inbound.worker ─ drena buffer → runTurn()
                                      │
                          ┌───────────┼───────────┐
                          ▼           ▼           ▼
                        Groq       Redis       Postgres
                       (chat +    (histórico)  (lead/msgs)
                        tools)
                                      │
                           tool calls: save_slots,
                                       advance_state,
                                       propose_schedule,
                                       confirm_schedule,
                                       request_handoff
                                      │
                                      ▼
                             Evolution sendText
```

## FSM

| Estado | Objetivo |
|---|---|
| S0_ABERTURA | Saúda, pega nome |
| S1_DESCOBERTA | Descobre interesse (imóvel/auto/investimento) |
| S2_QUALIFICACAO | Slots: capacidade_mensal, valor_bem, prazo_meses, intencao_lance |
| S3_EDUCACAO | Trata objeções (contemplação, parcela, vs financiamento) |
| S4_AGENDAMENTO | Oferece 2-3 slots Calendar |
| S5_CONFIRMADO | Cria evento, notifica Juan, pausa IA |
| HANDOFF | Pediu humano / fora de escopo — pausa IA |

Transições ocorrem por **tool call** (`advance_state`, `save_slots`, `propose_schedule`, `confirm_schedule`, `request_handoff`) ou por auto-advance quando slots ficam completos.

## Setup

Tem dois modos:

### Modo A — Docker full (recomendado para o cliente testar)

Sobe **tudo**: Redis, Postgres, Evolution API e o app num único `docker compose up`.

```bash
# 1. .env a partir do template
cp .env.example .env

# 2. edite .env — apenas os obrigatórios:
#    GROQ_API_KEY=...
#    EVOLUTION_API_KEY=<escolha um valor seu>
#    EVOLUTION_WEBHOOK_TOKEN=<escolha outro valor>
#    JUAN_WHATSAPP_E164=55...   (WhatsApp do Juan para receber handoff)
#    SIMULATOR_MODE=true        (pra testar sem conectar WhatsApp real)

# 3. sobe tudo
docker compose up -d --build

# 4. logs
docker compose logs -f app
```

Pronto:
- **Simulador (UI de testes):** http://localhost:3000/
- **Evolution Manager (QR code / instâncias):** http://localhost:8080/manager (use `EVOLUTION_API_KEY` como apikey)
- **Webhook da Evolution pro app:** já vem pré-configurado via `WEBHOOK_GLOBAL_URL=http://app:3000/webhook/evolution?token=...` — toda instância criada no Evolution envia eventos automaticamente.

Para testar com WhatsApp real: no `.env` coloque `SIMULATOR_MODE=false`, derrube e suba de novo (`docker compose up -d`), e:
1. Abra http://localhost:8080/manager, autentique com `EVOLUTION_API_KEY`.
2. Crie instância com o nome igual a `EVOLUTION_INSTANCE` do `.env` (default `juan`).
3. Escaneie o QR code com o WhatsApp do Juan.
4. Mande mensagem de outro número — vai cair no webhook do app e a IA responde.

### Modo B — Dev local (Node direto, com hot-reload)

Para editar código e iterar rápido:

```bash
docker compose up -d redis postgres evolution     # só a infra
cp .env.example .env                              # edite e ajuste
npm install
npm run migrate
npm run dev                                       # tsx watch
```

Em produção com múltiplos workers:

```bash
npm run build
npm run start                  # API
npm run worker:prod            # worker inbound
npm run worker:followup:prod   # worker follow-up
```

## Google Calendar

1. Crie credenciais OAuth2 em https://console.cloud.google.com (tipo "Aplicativo da Web").
2. Adicione `http://localhost:3000/oauth/google/callback` como URI de redirecionamento autorizado.
3. Preencha `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` no `.env`.
4. Com a API rodando, acesse `http://localhost:3000/oauth/google/start` logado na conta Google do Juan. O token é salvo em `.tokens/google.json` (não comitar).

Se o Calendar não estiver autorizado, o agendamento ainda roda — cria um event_id fake pra não quebrar o fluxo em dev.

## Estrutura

```
src/
  api/webhook.ts           # Fastify routes (webhook + OAuth Google)
  config.ts                # env com validação zod
  core/
    calendar.ts            # Google Calendar (freebusy + insert)
    db.ts                  # Postgres (leads, messages, appointments)
    evolution.ts           # WhatsApp via Evolution
    llm.ts                 # Groq wrapper (chat + classify)
    logger.ts              # pino
    redis.ts               # ioredis + keys helper
    transcribe.ts          # Whisper via Groq
  sdr/
    prompts/
      system.md            # persona + tom Juan
      knowledge.md         # consórcio: lance, contemplação, faixas
      objections.md        # objeções-tipo
      loader.ts            # lê os .md em runtime
    fsm.ts                 # loop de turno com tool calling
    tools.ts               # schemas das tools
    scheduler.ts           # oferta de slots + confirmação
    handoff.ts             # notifica Juan via WhatsApp
  workers/
    queues.ts              # BullMQ queues (inbound + followup) + cancel/schedule
    buffer.ts              # debounce buffer em Redis
    inbound.worker.ts      # dequeue → runTurn → sendText → agenda follow-up
    followup.worker.ts     # envia nudge 15min / 24h / auto-close
  api/
    webhook.ts             # Evolution webhook + OAuth Google
    simulator.ts           # UI + endpoints do simulador
  index.ts                 # bootstrap
public/
  simulator.html           # front WhatsApp-like para testes
migrations/
  001_init.sql
  002_conversation_status.sql
scripts/
  migrate.ts
  calendar-auth.ts
```

## Conversa aberta × fechada

Toda conversa tem `status ∈ {open, closed}` e, se fechada, um `closed_reason`.

| Evento | status | closed_reason |
|---|---|---|
| Lead agendou call (S5_CONFIRMADO) | closed | `scheduled` |
| Lead pediu pra falar com humano (handoff) | closed | `handoff` |
| Lead disse "não tenho interesse" | closed | `not_interested` |
| Lead pediu pra conversar outro dia | closed | `postponed` |
| Lead sumiu no meio → 2 follow-ups sem resposta | closed | `no_response` |
| Lead sumiu no meio, antes de esgotar follow-ups | **open** | — |

**Fechamento por não-interesse / adiamento** é decisão da IA via tool `close_conversation` (ver `src/sdr/tools.ts`). **Fechamento por agendamento ou handoff** acontece automaticamente no [fsm.ts](src/sdr/fsm.ts). **Fechamento por silêncio** é do worker de follow-up após esgotar a cadência.

Conversas fechadas ignoram novas mensagens do lead até serem reabertas manualmente (endpoint `POST /sim/reopen` ou UI).

## Follow-ups automáticos

Cadência quando o lead some no meio da conversa:

```
IA responde ──► status=open ──► agenda FU stage 1 (+15 min)
                                        │
         ┌──────────────────────────────┴──────────────────┐
         │                                                 │
 lead responde antes                          15 min sem resposta
         │                                                 │
 cancela TODOS os FUs                  FU 1: "Opa, conseguiu ver a mensagem? 👀"
         │                                                 │
 fluxo normal FSM                       agenda FU stage 2 (+24 h)
                                                 │
                               24 h sem resposta │  lead responde → cancela
                                                 ▼
                            FU 2: "Ainda faz sentido seguir essa conversa…?"
                                                 │
                                    agenda FU stage 3 (+24 h)
                                                 │
                               24 h sem resposta │  lead responde → cancela
                                                 ▼
                              FU 3: auto-close como `no_response`
```

Detalhes:
- Jobs BullMQ com `jobId = followup:<stage>:<waId>` — cancelados em cascata em qualquer inbound (ver [`cancelFollowups`](src/workers/queues.ts)).
- Antes de disparar, o worker revalida: `status='open'` + `last_assistant_at > last_user_at` (ver [followup.worker.ts](src/workers/followup.worker.ts)).
- Tempos configuráveis via `.env`: `FOLLOWUP_1_MS`, `FOLLOWUP_2_MS`, `FOLLOWUP_CLOSE_MS`.
- Follow-ups são mensagens determinísticas (não chamam LLM) pra evitar custo e variabilidade.
- A IA é instruída a **não** fechar a conversa quando o lead só some — deixa pros follow-ups.

## Simulador WhatsApp

UI de teste em `GET /` (quando `SIMULATOR_MODE=true` no `.env`). Nesse modo:

- `evolution.sendText` não chama a API real — só registra no banco e aparece na UI.
- Webhook real fica disponível (pode usar os dois ao mesmo tempo), mas o fluxo normal de teste é pela UI.
- Endpoints do simulador:
  - `GET /sim/leads` — lista leads
  - `GET /sim/messages?waId=X&sinceId=N` — mensagens + estado do lead
  - `POST /sim/inbound { waId, text, pushName? }` — injeta mensagem como se fosse do lead
  - `POST /sim/reset { waId }` — apaga lead e todas as mensagens
  - `POST /sim/reopen { waId }` — reabre conversa fechada
  - `POST /sim/trigger-followup { waId, stage: 1|2|3 }` — força o follow-up em ~1s (para testar sem esperar 15 min)

A UI tem botões **FU1** / **FU2** / **Reabrir** / **Reset** no header do chat. Slots coletados aparecem no rodapé.

## Decisões

- **Debounce** via BullMQ com `jobId` determinístico por `waId` + `delay: 5000`. Mensagens novas no mesmo waId reusam o jobId e o worker dreina todo o buffer de uma vez.
- **Histórico** mantido em Redis (16 últimos turnos) para prompt da LLM; Postgres guarda tudo pra auditoria/analytics.
- **Handoff**: para todos os qualificados (teste A/B conforme onboarding). Mensagem chega no WhatsApp do Juan com resumo dos slots.
- **Preço**: IA só dá faixa aproximada (conforme regra do Juan). Knowledge base explicita o que pode e o que não pode.
- **Áudio**: transcrição via Whisper Groq. IA responde só texto no MVP.
- **Calendar** opcional em dev — se não configurado, segue fluxo com evento fake.
- **Follow-ups** só rodam com `last_assistant_at > last_user_at` — evita disparar sobre conversa já retomada.

## Próximos passos

- [ ] Handoff via botões no WhatsApp Juan ("pausar IA" / "reativar")
- [ ] Painel /admin simples pra Juan ver leads e forçar handoff
- [ ] BDR (LinkedIn via Unipile)
