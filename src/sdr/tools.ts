import type { ToolDef } from "../core/llm.js";

// Descrições propositalmente curtas: o schema de tools vai em TODA chamada do
// modelo (2x por turno), então cada palavra aqui é token recorrente.
export const SDR_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "save_slots",
      description:
        "Salva dados de qualificação ditos pelo lead. Só chame com ao menos 1 valor concreto. NUNCA envie campo vazio/null — se não souber, omita.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "nome/apelido do lead" },
          profissao: { type: "string", description: "profissão (texto curto)" },
          renda_aproximada: {
            type: "string",
            description: "faixa de renda mensal: '4-8k','8-15k','15-25k','25k+'",
          },
          modelo_carro: { type: "string", description: "modelo/marca do carro (se interesse=auto)" },
          interesse: { type: "string", description: "'imovel'|'auto'|'investimento'|'outro'" },
          capacidade_mensal: { type: "number", description: "parcela suportada/mês em R$ (número)" },
          valor_bem: { type: "number", description: "valor do bem/carta em R$" },
          prazo_meses: { type: "number", description: "prazo em meses" },
          intencao_lance: { type: "boolean", description: "tem reserva/intenção de lance" },
          sabe_consorcio: { type: "boolean", description: "entende como consórcio funciona" },
          prazo_decisao: {
            type: "string",
            description: "'proximos_meses'|'sem_pressa'|'indefinido' ou texto curto",
          },
          fecha_se_proposta_boa: { type: "boolean", description: "fecharia com proposta adequada" },
          decisao_com_conjuge: { type: "boolean", description: "decide com cônjuge (true) ou sozinho (false)" },
          mora_exterior: { type: "boolean", description: "brasileiro morando no exterior" },
          entrada_disponivel: { type: "number", description: "R$ disponíveis p/ entrada do imóvel" },
          usa_fgts: { type: "boolean", description: "usa FGTS na entrada/lance" },
          finalidade: {
            type: "string",
            enum: ["moradia", "investimento", "renda_locacao"],
            description: "uso do imóvel",
          },
          tipo_imovel: {
            type: "string",
            enum: ["lancamento", "usado", "comercial"],
            description: "tipo do imóvel",
          },
          regiao_interesse: { type: "string", description: "bairro/região desejada" },
          pretende_financiar: { type: "boolean", description: "vai financiar parte do imóvel" },
          ja_visitou_imovel: { type: "boolean", description: "já visitou imóveis com corretor" },
          observacoes: { type: "string", description: "anotação livre relevante" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_handoff",
      description: "Lead pediu humano, ficou bravo, saiu do escopo sério, ou a conversa travou.",
      parameters: {
        type: "object",
        properties: { motivo: { type: "string", description: "motivo curto" } },
        required: ["motivo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "close_conversation",
      description:
        "Encerra a conversa. Só quando: (a) lead diz claramente que não quer, ou (b) pede pra falar depois (adiamento explícito). NÃO chame se o lead só sumiu.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            enum: ["not_interested", "postponed"],
            description: "'not_interested' = não quer; 'postponed' = falar depois",
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
      description: "Lead qualificado e topou marcar. A orquestração busca horários e devolve as opções.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_schedule",
      description: "Lead escolheu um horário oferecido e o canal. Passe o índice (0-based) e o canal.",
      parameters: {
        type: "object",
        properties: {
          slot_index: { type: "integer", description: "índice do slot (0,1,2...)" },
          channel: { type: "string", enum: ["ligacao", "video"], description: "canal preferido" },
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
        "Checagem INTERNA: vê se uma faixa de carta cabe no perfil. NUNCA mencione parcela ao lead — só pra você saber se cabe ou calibrar pra cima.",
      parameters: {
        type: "object",
        properties: {
          valor_carta: { type: "number", description: "valor da carta em R$ (ex: 400000)" },
          tipo: { type: "string", enum: ["imovel", "auto"], description: "tipo do bem (se souber)" },
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
      "Busca imóveis no catálogo que batem com o perfil do lead. Use quando ele indicar finalidade/região/orçamento. Apresente 2-3 de forma natural e ofereça visita.",
    parameters: {
      type: "object",
      properties: {
        transaction: { type: "string", enum: ["venda", "locacao"], description: "venda ou locação" },
        type: { type: "string", description: "tipo (apartamento, casa, terreno, comercial...)" },
        max_preco: { type: "number", description: "orçamento máximo em R$" },
        min_quartos: { type: "integer", description: "mínimo de quartos" },
        vagas: { type: "integer", description: "mínimo de vagas" },
        cidade: { type: "string", description: "cidade" },
        bairro: { type: "string", description: "bairro/região" },
      },
      additionalProperties: false,
    },
  },
};
