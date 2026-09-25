"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  REPLY_CLASSES,
  REPLY_CLASS_COLORS,
  REPLY_CLASS_LABELS,
  type CampaignAdherence,
  type ReplyClass,
} from "@/lib/types";

type Daily = CampaignAdherence["daily"];

// Preenche os dias sem resposta com zero — o eixo do tempo não pode "pular" dias.
function fillDays(daily: Daily, days: number) {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const out: Array<Record<string, number | string>> = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const row = byDay.get(key);
    const entry: Record<string, number | string> = { day: key, label: `${d.getDate()}/${d.getMonth() + 1}` };
    for (const k of REPLY_CLASSES) entry[k] = row ? Number(row[k]) : 0;
    out.push(entry);
  }
  return out;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((a, p) => a + (p.value ?? 0), 0);
  return (
    <div className="rounded-md border border-line-strong bg-canvas-surface px-3 py-2 text-xs shadow-elevated">
      <div className="mb-1 font-medium text-ink">
        {label} · {total} resposta(s)
      </div>
      {[...payload].reverse().map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: REPLY_CLASS_COLORS[p.dataKey as ReplyClass] }}
            />
            {REPLY_CLASS_LABELS[p.dataKey as ReplyClass]}
          </span>
          <span className="text-ink">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function RepliesByDayChart({ daily, days }: { daily: Daily; days: number }) {
  const data = useMemo(() => fillDays(daily, days), [daily, days]);
  const lastKey = REPLY_CLASSES[REPLY_CLASSES.length - 1];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={days > 30 ? 1 : 4}>
          <CartesianGrid vertical={false} stroke="#232329" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#71717A", fontSize: 10 }}
            axisLine={{ stroke: "#2E2E38" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis allowDecimals={false} tick={{ fill: "#71717A", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend
            iconType="square"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "#A1A1AA", paddingTop: 8 }}
            formatter={(v: string) => REPLY_CLASS_LABELS[v as ReplyClass] ?? v}
          />
          {REPLY_CLASSES.map((k) => (
            <Bar
              key={k}
              dataKey={k}
              stackId="r"
              fill={REPLY_CLASS_COLORS[k]}
              stroke="#16161A"
              strokeWidth={1}
              radius={k === lastKey ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
