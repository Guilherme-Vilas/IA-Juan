"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Leads novos x reuniões marcadas por dia. Duas séries da mesma unidade
// (contagem) num único eixo; cores validadas contra a superfície escura.
const COLORS = { novos: "#6B6B75", agendados: "#3F83F0" } as const;
const LABELS = { novos: "Leads novos", agendados: "Reuniões marcadas" } as const;

type Row = { day: string; novos: number; agendados: number };

function Tip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line-strong bg-canvas-surface px-3 py-2 text-xs shadow-elevated">
      <div className="mb-1 font-medium text-ink">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: COLORS[p.dataKey as keyof typeof COLORS] }} />
            {LABELS[p.dataKey as keyof typeof LABELS]}
          </span>
          <span className="text-ink">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DailyChart({ data }: { data: Row[] }) {
  const rows = data.map((d) => ({ ...d, label: `${Number(d.day.slice(8, 10))}/${Number(d.day.slice(5, 7))}` }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap={rows.length > 35 ? 1 : 3}>
          <CartesianGrid vertical={false} stroke="#232329" />
          <XAxis dataKey="label" tick={{ fill: "#71717A", fontSize: 10 }} axisLine={{ stroke: "#2E2E38" }} tickLine={false} minTickGap={18} />
          <YAxis allowDecimals={false} tick={{ fill: "#71717A", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#A1A1AA", paddingTop: 6 }} formatter={(v: string) => LABELS[v as keyof typeof LABELS] ?? v} />
          <Bar dataKey="novos" fill={COLORS.novos} stroke="#16161A" strokeWidth={1} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="agendados" fill={COLORS.agendados} stroke="#16161A" strokeWidth={1} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
