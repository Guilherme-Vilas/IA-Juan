import { Plus } from "lucide-react";

// FAQ anti-objeção — enfrenta de frente o que o público cético pensa
// e não pergunta. Cada resposta cita capacidade REAL do produto.

const FAQS = [
  {
    q: "Meu cliente vai perceber que é um robô e desistir?",
    a: "A IA conversa como uma assistente de verdade: comenta o que o lead traz, faz uma pergunta por vez e escreve como gente — sem menu de opções nem respostas engessadas. E ela se apresenta como assistente da sua equipe, que prepara a conversa antes de você entrar. Na prática, o lead recebe resposta em segundos em vez de esperar horas — a experiência dele melhora, não piora.",
  },
  {
    q: "E se a IA falar uma besteira ou prometer algo errado?",
    a: "Ela trabalha com regras suas: o que pode e o que não pode dizer, quando falar de valores (nunca, faixa ou liberado — você escolhe) e quando passar pra você. Toda conversa fica registrada no painel, e você assume qualquer atendimento com um clique — a IA pausa na hora e só volta quando você devolver.",
  },
  {
    q: "Meu número de WhatsApp pode ser banido?",
    a: "Esse risco existe pra qualquer disparo em massa mal feito — e é exatamente por isso que a plataforma tem proteções de fábrica: aquecimento gradual de número novo, limite diário por chip, envios espaçados em horário comercial e descadastro automático de quem pede pra sair. É o oposto do 'disparador' que queima chip.",
  },
  {
    q: "Preciso trocar de CRM ou mudar meu jeito de trabalhar?",
    a: "Não. A Vita OS já vem com pipeline, agenda e ficha de lead — você abre o painel e está tudo lá, organizado pela própria IA. Quem usa outro CRM pode continuar usando; o essencial (lead qualificado + agendamento) chega pronto no seu WhatsApp.",
  },
  {
    q: "E a LGPD? Os dados dos meus clientes ficam seguros?",
    a: "Os dados dos seus leads pertencem a você e são usados apenas para operar o seu atendimento — nunca vendidos ou compartilhados entre clientes. Quem pede pra não receber mensagens entra automaticamente numa lista de bloqueio permanente. Os detalhes estão na nossa Política de Privacidade.",
  },
  {
    q: "Tem fidelidade? E se eu quiser cancelar?",
    a: "Sem fidelidade. Você cancela quando quiser e leva o histórico dos seus leads. Nossa aposta é que a plataforma se pague pelos agendamentos que gera — não por contrato de permanência.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-accent-bronze">
          Perguntas diretas, respostas diretas
        </p>
        <h2 className="font-serif text-section-title text-ink">
          O que você está pensando <span className="italic text-accent-bronze-soft">(e não perguntou)</span>.
        </h2>
      </div>

      <div className="mt-12 space-y-2.5">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group rounded-xl border border-line bg-canvas-surface transition-colors open:border-accent-bronze/30"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[14.5px] font-medium text-ink [&::-webkit-details-marker]:hidden">
              {f.q}
              <Plus
                size={16}
                className="shrink-0 text-accent-bronze-soft transition-transform duration-200 group-open:rotate-45"
              />
            </summary>
            <p className="border-t border-line/60 px-5 py-4 text-[13.5px] leading-relaxed text-ink-muted">
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
