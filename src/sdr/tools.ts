import type { ToolDef } from "../core/llm.js";

export const SDR_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "save_slots",
      description:
        "Salva informações de qualificação coletadas do lead. IMPORTANTE: só chame quando tiver pelo menos 1 valor CONCRETO extraído da conversa. NUNCA envie campos vazios, null ou strings em branco. Se não souber um campo, simplesmente não inclua ele.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome/apelido do lead (só envie se o lead disse)" },
          interesse: {
            type: "string",
            description:
              "Tipo de bem/uso. Valores esperados: 'imovel', 'auto', 'investimento' ou 'outro'. Só envie quando souber.",
          },
          capacidade_mensal: {
            type: "number",
            description: "Quanto o lead pode pagar por mês em R$ (número, sem pontuação)",
          },
          valor_bem: {
            type: "number",
            description: "Valor do bem/carta que o lead quer em R$",
          },
          prazo_meses: { type: "number", description: "Prazo em meses que o lead considera" },
          intencao_lance: {
            type: "boolean",
            description: "Se o lead tem reserva/intenção de dar lance (true/false)",
          },
          sabe_consorcio: {
            type: "boolean",
            description: "Lead demonstra clareza do que é consórcio e como funciona",
          },
          prazo_decisao: {
            type: "string",
            description:
              "Quando pretende decidir/fechar. Valores sugeridos: 'proximos_meses', 'sem_pressa', 'indefinido' — ou texto livre curto.",
          },
          fecha_se_proposta_boa: {
            type: "boolean",
            description:
              "Se o lead disse que fecharia se a proposta fosse adequada (compromisso real)",
          },
          decisao_com_conjuge: {
            type: "boolean",
            description: "true = decide com cônjuge/parceiro; false = decide sozinho",
          },
          mora_exterior: {
            type: "boolean",
            description: "true se o lead é brasileiro morando no exterior",
          },
          observacoes: { type: "string", description: "Observação livre relevante para o Juan" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_handoff",
      description:
        "Chame quando o lead pedir explicitamente pra falar com humano, ficar bravo, sair do escopo de forma séria, ou quando a conversa travou.",
      parameters: {
        type: "object",
        properties: {
          motivo: { type: "string", description: "Motivo curto do handoff" },
        },
        required: ["motivo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "close_conversation",
      description:
        "Encerra a conversa (marca status=closed). Chame apenas quando: (a) o lead disser claramente que NÃO tem interesse ou 'não quero mais', (b) pedir para conversar em outro dia/depois/semana que vem (adiamento explícito), ou (c) mandar encerrar. NÃO chame se o lead só sumiu no meio da conversa — nesse caso deixe em aberto para os follow-ups automáticos.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            enum: ["not_interested", "postponed"],
            description:
              "'not_interested' quando o lead não quer; 'postponed' quando pediu para falar em outro momento.",
          },
        },
        required: ["reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_schedule",
      description:
        "Chame quando o lead estiver qualificado e topar marcar conversa. A orquestração busca horários livres no Google Calendar e devolve as opções pra você oferecer.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_schedule",
      description:
        "Chame quando o lead escolher um dos horários que você ofereceu E disser o canal preferido. Passe o índice (0-based) do slot e o canal.",
      parameters: {
        type: "object",
        properties: {
          slot_index: { type: "integer", description: "Índice do slot escolhido (0, 1, 2...)" },
          channel: {
            type: "string",
            enum: ["ligacao", "video"],
            description: "Canal preferido: 'ligacao' (telefone) ou 'video' (vídeo chamada)",
          },
        },
        required: ["slot_index", "channel"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "advance_state",
      description: "Avança o estado da FSM quando a etapa atual foi cumprida.",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            enum: ["S1_DESCOBERTA", "S2_QUALIFICACAO", "S3_EDUCACAO", "S4_AGENDAMENTO"],
          },
        },
        required: ["to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_parcela",
      description:
        "Checagem INTERNA: verifica se uma faixa de carta cabe no perfil. NUNCA mencione números de parcela ao lead. Esta tool serve apenas pra você (Stella) saber qualitativamente se o valor cabe ou se precisa calibrar o lead pra cima.",
      parameters: {
        type: "object",
        properties: {
          valor_carta: {
            type: "number",
            description: "Valor da carta de crédito em R$ (ex: 400000)",
          },
          tipo: {
            type: "string",
            enum: ["imovel", "auto"],
            description: "Tipo do bem (opcional; se souber)",
          },
        },
        required: ["valor_carta"],
      },
    },
  },
];
