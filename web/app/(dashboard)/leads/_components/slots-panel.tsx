import type { Lead } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export function SlotsPanel({ lead }: { lead: Lead }) {
  const s = lead.slots;
  return (
    <div className="space-y-3 pb-4">
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold">Perfil financeiro</h3>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <Row k="Interesse" v={s.interesse ?? "—"} />
          <Row k="Valor do bem" v={formatCurrency(s.valor_bem)} />
          <Row k="Capacidade mensal" v={formatCurrency(s.capacidade_mensal)} />
          <Row k="Prazo" v={s.prazo_meses ? `${s.prazo_meses} meses` : "—"} />
          <Row k="Intenção de lance" v={bool(s.intencao_lance)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold">BANT do Juan</h3>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <Row k="Tem clareza do produto?" v={bool(s.sabe_consorcio)} />
          <Row k="Timing" v={s.prazo_decisao ?? "—"} />
          <Row k="Fecha se proposta boa?" v={bool(s.fecha_se_proposta_boa)} highlight={s.fecha_se_proposta_boa} />
          <Row k="Decisão com cônjuge?" v={bool(s.decisao_com_conjuge)} />
          <Row k="Mora no exterior?" v={bool(s.mora_exterior)} />
        </CardBody>
      </Card>

      {s.observacoes && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">Observações</h3>
          </CardHeader>
          <CardBody>
            <p className="text-sm whitespace-pre-wrap">{s.observacoes}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-2 last:border-0 last:pb-0">
      <span className="text-xs uppercase text-ink-muted">{k}</span>
      <span className={`text-sm font-medium ${highlight ? "text-emerald-600" : ""}`}>{v}</span>
    </div>
  );
}

function bool(v: boolean | undefined) {
  if (v === true) return <span className="text-emerald-600">sim</span>;
  if (v === false) return <span className="text-ink-muted">não</span>;
  return <span className="text-ink-muted">—</span>;
}
