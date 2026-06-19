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
          profissao: {
            type: "string",
            description:
              "Com o que o lead trabalha (texto livre curto, ex: 'dentista', 'engenheiro civil', 'sócio de restaurante'). Só envie quando o lead disser.",
          },
          renda_aproximada: {
            type: "string",
            description:
              "Faixa de renda mensal do lead. Valores esperados: '4-8k', '8-15k', '15-25k', '25k+', ou texto livre curto se o lead disse outra coisa. Só envie quando o lead indicar.",
          },
          modelo_carro: {
            type: "string",
            description:
              "Modelo/marca do carro pretendido (texto livre, ex: 'Compass', 'BMW X3', 'HB20'). Só envie quando interesse for 'auto' e o lead mencionar.",
          },
          interesse: {
            type: "string",
            description:
              "Tipo de bem/uso. Valores esperados: 'imovel', 'auto', 'investimento' ou 'outro'. Só envie quando souber.",
          },
          capacidade_mensal: {
            type: "number",
            description:
              "Parcela suportada por mês em R$ (número, sem pontuação). Use quando o lead disser uma parcela específica ou faixa de parcela.",
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
          // ===== Imobiliario (tenant Facilita/Apolar) =====
          entrada_disponivel: {
            type: "number",
            description:
              "R$ disponíveis pra entrada do imóvel (FGTS + recursos próprios + saldo etc). Só envie se o lead disser um valor concreto.",
          },
          usa_fgts: {
            type: "boolean",
            description: "Vai usar saldo do FGTS na entrada/lance (true) ou não (false).",
          },
          finalidade: {
            type: "string",
            enum: ["moradia", "investimento", "renda_locacao"],
            description:
              "Pra que vai usar o imóvel: 'moradia' (vai morar), 'investimento' (compra pra ganho de capital/revenda), 'renda_locacao' (compra pra alugar).",
          },
          tipo_imovel: {
            type: "string",
            enum: ["lancamento", "usado", "comercial"],
            description:
              "Tipo do imóvel: 'lancamento' (novo/planta), 'usado' (revenda), 'comercial' (sala/loja).",
          },
          regiao_interesse: {
            type: "string",
            description: "Bairro ou região que o lead quer (texto livre curto).",
          },
          pretende_financiar: {
            type: "boolean",
            description:
              "true se pretende financiar parte do imóvel; false se vai à vista/recursos próprios.",
          },
          ja_visitou_imovel: {
            type: "boolean",
            description: "true se o lead já visitou esse imóvel ou outros similares com algum corretor.",
          },
          observacoes: {
            type: "string",
            description: "Observação livre relevante (anotação pro corretor).",
          },
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

// Tool de catalogo de imoveis — incluida SO para tenants com catalogo (imobiliaria).
// Ver fsm.ts (countProperties decide se entra na lista de tools do turno).
export const PROPERTY_TOOL: ToolDef = {
  type: "function",
  function: {
    name: "buscar_imoveis",
    description:
      "Busca imóveis no catálogo da imobiliária que batem com o perfil do lead. Use quando o lead indicar finalidade/região/orçamento e você quiser sugerir opções REAIS. Apresente 2-3 de forma natural (não despeje a lista crua) e ofereça agendar uma visita.",
    parameters: {
      type: "object",
      properties: {
        transaction: { type: "string", enum: ["venda", "locacao"], description: "venda ou locação" },
        type: {
          type: "string",
          description: "tipo do imóvel (apartamento, casa, terreno, comercial...)",
        },
        max_preco: { type: "number", description: "orçamento máximo em R$ (número, sem pontuação)" },
        min_quartos: { type: "integer", description: "mínimo de quartos/dormitórios" },
        vagas: { type: "integer", description: "mínimo de vagas de garagem" },
        cidade: { type: "string", description: "cidade desejada" },
        bairro: { type: "string", description: "bairro/região desejada" },
      },
      additionalProperties: false,
    },
  },
};
