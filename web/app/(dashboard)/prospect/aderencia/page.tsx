import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { campaignApi } from "@/lib/api";
import { getCurrentTenant } from "@/lib/tenant";
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  REPLY_CLASSES,
  REPLY_CLASS_COLORS,
  REPLY_CLASS_LABELS,
  type AdherenceRow,
  type CampaignAdherence,
} from "@/lib/types";
import { AlertTriangle, ArrowLeft, Activity } from "lucide-react";
import { RepliesByDayChart } from "./_components/replies-chart";

export const dynamic = "force-dynamic";

const PERIODS = [7, 30, 90] as const;
// Acima disso a campanha está incomodando a lista — vale revisar texto/segmentação.
const OPT_OUT_ALERT = 0.03;

function ratio(part: number, whole: number): number | null {
  return whole ? part / whole : null;
}
function fmtPct(r: number | null): string {
  return r == null ? "—" : `${Math.round(r * 100)}%`;
}

function sum(rows: AdherenceRow[], key: keyof AdherenceRow): number {
  return rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);
}

function Kpi({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div
      className={`rounded-lg p-3 ${alert ? "border border-danger/40 bg-danger/10" : "bg-canvas-deep/60"}`}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-muted">
        {alert && <AlertTriangle size={10} className="text-danger" aria-label="Atenção" />}
        {label}
      </div>
      <div className="font-serif text-2xl text-ink">{value}</div>
      {sub && <div className="text-[11px] text-ink-soft">{sub}</div>}
    </div>
  );
}

// Barra 100% empilhada da distribuição de respostas (2px de respiro entre fatias).
function DistributionBar({ row }: { row: AdherenceRow }) {
  const classified = REPLY_CLASSES.reduce((a, k) => a + row[k], 0);
  if (!classified) return <span className="text-[11px] text-ink-faint">sem respostas classificadas</span>;
  return (
    <div className="flex h-2.5 w-full min-w-[120px] gap-[2px]" role="img" aria-label="Distribuição das respostas">
      {REPLY_CLASSES.filter((k) => row[k] > 0).map((k) => (
        <div
          key={k}
          title={`${REPLY_CLASS_LABELS[k]}: ${row[k]} (${fmtPct(row[k] / classified)})`}
          className="h-full first:rounded-l-[4px] last:rounded-r-[4px]"
          style={{ width: `${(row[k] / classified) * 100}%`, backgroundColor: REPLY_CLASS_COLORS[k] }}
        />
      ))}
    </div>
  );
}

export default async function AdherencePage({ searchParams }: { searchParams: { days?: string } }) {
  const tenant = await getCurrentTenant();
  const days = PERIODS.includes(Number(searchParams.days) as (typeof PERIODS)[number])
    ? Number(searchParams.days)
    : 30;

  let data: CampaignAdherence | null = null;
  let error: string | null = null;
  try {
    data = (await campaignApi(tenant.slug).adherence(days)) as CampaignAdherence;
  } catch (err) {
    error = String(err);
  }

  const rows = data?.campaigns ?? [];
  const contatados = sum(rows, "contatados");
  const respostas = sum(rows, "respostas");
  const interessados = sum(rows, "interessado");
  const rejeicao = sum(rows, "nao_interessado") + sum(rows, "opt_out");
  const optOut = sum(rows, "opt_out");
  const avancaram = sum(rows, "avancaram");
  const semClasse = sum(rows, "sem_classe");
  const optOutRate = ratio(optOut, contatados);

  return (
    <>
      <Header
        title="Aderência de campanhas"
        subtitle={`${tenant.name} · como os contatos estão reagindo às campanhas`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/prospect"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm text-ink-soft hover:text-ink"
            >
              <ArrowLeft size={14} /> Campanhas
            </Link>
            <div className="flex rounded-md border border-line p-0.5" role="group" aria-label="Período">
              {PERIODS.map((p) => (
                <Link
                  key={p}
                  href={`/prospect/aderencia?days=${p}`}
                  aria-current={p === days ? "page" : undefined}
                  className={`rounded px-2.5 py-1 text-xs ${
                    p === days ? "bg-canvas-surface-2 text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {p} dias
                </Link>
              ))}
            </div>
          </div>
        }
      />
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {error && (
          <Card>
            <CardBody className="text-sm text-danger">Erro ao carregar: {error}</CardBody>
          </Card>
        )}

        {!error && rows.length === 0 && (
          <div className="grid h-64 place-items-center text-center text-sm text-ink-muted">
            <div>
              <Activity size={32} className="mx-auto mb-2 text-accent-bronze/50" />
              <p className="font-serif text-lg text-ink">Nenhum contato nos últimos {days} dias.</p>
              <p className="mt-1 text-xs">Assim que uma campanha disparar, a reação dos leads aparece aqui.</p>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
              <Kpi label="Contatados" value={String(contatados)} />
              <Kpi label="Respostas" value={String(respostas)} sub={`${fmtPct(ratio(respostas, contatados))} dos contatados`} />
              <Kpi
                label="Resposta positiva"
                value={fmtPct(ratio(interessados, respostas))}
                sub={`${interessados} interessado(s)`}
              />
              <Kpi label="Rejeição" value={fmtPct(ratio(rejeicao, respostas))} sub="sem interesse + opt-out" />
              <Kpi
                label="Opt-out"
                value={fmtPct(optOutRate)}
                sub={`${optOut} de ${contatados} contatados`}
                alert={optOutRate != null && optOutRate > OPT_OUT_ALERT}
              />
              <Kpi label="Avançaram no CRM" value={String(avancaram)} sub={`${fmtPct(ratio(avancaram, respostas))} das respostas`} />
            </div>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold">Respostas por dia, por reação</h2>
              </CardHeader>
              <CardBody>
                <RepliesByDayChart daily={data!.daily} days={days} />
                {semClasse > 0 && (
                  <p className="mt-2 text-[11px] text-ink-faint">
                    {semClasse} resposta(s) ainda sem classificação (anteriores a esta versão ou aguardando o turno da IA).
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold">Por campanha</h2>
              </CardHeader>
              <CardBody className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line text-left text-[10px] uppercase tracking-wide text-ink-muted">
                      <th className="py-2 pr-3 font-medium">Campanha</th>
                      <th className="py-2 pr-3 text-right font-medium">Contatados</th>
                      <th className="py-2 pr-3 text-right font-medium">Respostas</th>
                      <th className="w-[28%] py-2 pr-3 font-medium">Reação</th>
                      <th className="py-2 pr-3 text-right font-medium">Positiva</th>
                      <th className="py-2 pr-3 text-right font-medium">Opt-out</th>
                      <th className="py-2 pr-3 text-right font-medium">Avançaram</th>
                      <th className="py-2 text-right font-medium">Agendados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const oRate = ratio(r.opt_out, r.contatados);
                      const oAlert = oRate != null && oRate > OPT_OUT_ALERT;
                      return (
                        <tr key={r.campaign_id} className="border-b border-line/50 align-middle">
                          <td className="py-2 pr-3">
                            <Link href={`/prospect/${r.campaign_id}`} className="text-ink hover:text-accent-bronze-soft">
                              {r.name}
                            </Link>
                            <Badge className={`${CAMPAIGN_STATUS_COLORS[r.status]} ml-2 text-white`}>
                              {CAMPAIGN_STATUS_LABELS[r.status]}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3 text-right text-ink">{r.contatados}</td>
                          <td className="py-2 pr-3 text-right text-ink">
                            {r.respostas}{" "}
                            <span className="text-ink-muted">({fmtPct(ratio(r.respostas, r.contatados))})</span>
                          </td>
                          <td className="py-2 pr-3">
                            <DistributionBar row={r} />
                          </td>
                          <td className="py-2 pr-3 text-right text-ink">{fmtPct(ratio(r.interessado, r.respostas))}</td>
                          <td className={`py-2 pr-3 text-right ${oAlert ? "text-danger" : "text-ink"}`}>
                            <span className="inline-flex items-center gap-1">
                              {oAlert && <AlertTriangle size={11} aria-label="Opt-out alto" />}
                              {fmtPct(oRate)}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right text-ink">{r.avancaram}</td>
                          <td className="py-2 text-right text-ink">{r.agendados}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-ink-soft">
                  {REPLY_CLASSES.map((k) => (
                    <span key={k} className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: REPLY_CLASS_COLORS[k] }} />
                      {REPLY_CLASS_LABELS[k]}
                    </span>
                  ))}
                  <span className="text-ink-faint">· Opt-out acima de {OPT_OUT_ALERT * 100}% dos contatados fica em alerta</span>
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
