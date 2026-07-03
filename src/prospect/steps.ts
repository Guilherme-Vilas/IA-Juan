import { pool } from "../core/db.js";

// ============================================================================
// Cadência multi-etapa + variantes A/B.
// O template do próprio passo é a variante base ("A"); as linhas de
// campaign_step_variants são as alternativas (B, C...), sorteadas com peso igual.
// ============================================================================

export type StepVariantRow = {
  id: number;
  step_id: number;
  label: string;
  template_text: string;
  active: boolean;
  created_at: Date;
};

export type StepRow = {
  id: number;
  campaign_id: number;
  position: number;
  wait_hours: number;
  template_text: string;
  created_at: Date;
  updated_at: Date;
};

export type StepWithVariants = StepRow & { variants: StepVariantRow[] };

export type StepInput = {
  wait_hours: number;
  template_text: string;
  variants?: Array<{ label: string; template_text: string; active?: boolean }>;
};

export async function listSteps(campaignId: number): Promise<StepWithVariants[]> {
  const { rows: steps } = await pool.query<StepRow>(
    `SELECT * FROM campaign_steps WHERE campaign_id = $1 ORDER BY position ASC`,
    [campaignId],
  );
  if (steps.length === 0) return [];
  const { rows: variants } = await pool.query<StepVariantRow>(
    `SELECT * FROM campaign_step_variants WHERE step_id = ANY($1) ORDER BY label ASC`,
    [steps.map((s) => s.id)],
  );
  const byStep = new Map<number, StepVariantRow[]>();
  for (const v of variants) {
    const list = byStep.get(v.step_id) ?? [];
    list.push(v);
    byStep.set(v.step_id, list);
  }
  return steps.map((s) => ({ ...s, variants: byStep.get(s.id) ?? [] }));
}

// Substitui a cadência inteira preservando os ids dos passos por posição
// (upsert) — assim o histórico em prospect_sends não perde a atribuição.
export async function replaceSteps(campaignId: number, steps: StepInput[]): Promise<StepWithVariants[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (let i = 0; i < steps.length; i++) {
      const position = i + 1;
      const s = steps[i]!;
      const waitHours = position === 1 ? 0 : Math.max(1, s.wait_hours);
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO campaign_steps (campaign_id, position, wait_hours, template_text)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (campaign_id, position)
         DO UPDATE SET wait_hours = EXCLUDED.wait_hours, template_text = EXCLUDED.template_text, updated_at = now()
         RETURNING id`,
        [campaignId, position, waitHours, s.template_text],
      );
      const stepId = rows[0]!.id;

      // Variantes: upsert por label, remove as que saíram.
      const labels = (s.variants ?? []).map((v) => v.label);
      await client.query(
        `DELETE FROM campaign_step_variants WHERE step_id = $1 AND NOT (label = ANY($2))`,
        [stepId, labels],
      );
      for (const v of s.variants ?? []) {
        await client.query(
          `INSERT INTO campaign_step_variants (step_id, label, template_text, active)
           VALUES ($1,$2,$3,COALESCE($4,true))
           ON CONFLICT (step_id, label)
           DO UPDATE SET template_text = EXCLUDED.template_text, active = EXCLUDED.active`,
          [stepId, v.label, v.template_text, v.active ?? true],
        );
      }
    }

    // Remove passos além do novo tamanho da cadência.
    await client.query(
      `DELETE FROM campaign_steps WHERE campaign_id = $1 AND position > $2`,
      [campaignId, steps.length],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return listSteps(campaignId);
}

// Sorteio da variante (peso igual entre base + ativas).
export function pickVariant(step: StepWithVariants): { variantId: number | null; label: string; template: string } {
  const options: Array<{ variantId: number | null; label: string; template: string }> = [
    { variantId: null, label: "A", template: step.template_text },
    ...step.variants
      .filter((v) => v.active)
      .map((v) => ({ variantId: v.id, label: v.label, template: v.template_text })),
  ];
  return options[Math.floor(Math.random() * options.length)]!;
}

export async function recordSend(input: {
  tenantId: number;
  campaignId: number;
  prospectId: number;
  stepId: number | null;
  variantId: number | null;
  messageText: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO prospect_sends (tenant_id, campaign_id, prospect_id, step_id, variant_id, message_text)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [input.tenantId, input.campaignId, input.prospectId, input.stepId, input.variantId, input.messageText],
  );
}

// ===== Funil da campanha =====

export type FunnelCell = {
  step_id: number | null;
  position: number | null;
  variant_id: number | null;
  variant_label: string; // 'A' = base
  sends: number;
  replies: number;
};

export type CampaignFunnel = {
  cells: FunnelCell[];
  totals: {
    sends: number;
    replies: number;
    positivos: number;
    leads: number;
    agendados: number;
    ganhos: number;
    valor_ganho_cents: number;
  };
};

export async function getCampaignFunnel(campaignId: number): Promise<CampaignFunnel> {
  const [sendsRes, repliesRes, totalsRes] = await Promise.all([
    pool.query<{ step_id: number | null; position: number | null; variant_id: number | null; variant_label: string | null; n: string }>(
      `SELECT s.step_id, st.position, s.variant_id, v.label AS variant_label, COUNT(*)::text AS n
         FROM prospect_sends s
         LEFT JOIN campaign_steps st ON st.id = s.step_id
         LEFT JOIN campaign_step_variants v ON v.id = s.variant_id
        WHERE s.campaign_id = $1
        GROUP BY 1,2,3,4`,
      [campaignId],
    ),
    // Resposta atribuída ao ÚLTIMO envio antes dela.
    pool.query<{ step_id: number | null; variant_id: number | null; n: string }>(
      `SELECT ls.step_id, ls.variant_id, COUNT(*)::text AS n
         FROM prospects p
         JOIN LATERAL (
           SELECT step_id, variant_id FROM prospect_sends s
            WHERE s.prospect_id = p.id
            ORDER BY s.sent_at DESC, s.id DESC LIMIT 1
         ) ls ON true
        WHERE p.campaign_id = $1 AND p.replied_at IS NOT NULL
        GROUP BY 1,2`,
      [campaignId],
    ),
    pool.query<{
      sends: string;
      replies: string;
      positivos: string;
      leads: string;
      agendados: string;
      ganhos: string;
      valor_ganho_cents: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM prospect_sends WHERE campaign_id = $1)::text AS sends,
         COUNT(*) FILTER (WHERE p.replied_at IS NOT NULL)::text AS replies,
         COUNT(*) FILTER (WHERE p.reply_class = 'interessado')::text AS positivos,
         COUNT(l.id)::text AS leads,
         COUNT(*) FILTER (WHERE l.closed_reason = 'scheduled' OR l.state = 'S5_CONFIRMADO')::text AS agendados,
         COUNT(*) FILTER (WHERE l.outcome = 'won')::text AS ganhos,
         COALESCE(SUM(l.value_cents) FILTER (WHERE l.outcome = 'won'), 0)::text AS valor_ganho_cents
       FROM prospects p
       LEFT JOIN leads l ON l.id = p.lead_id
       WHERE p.campaign_id = $1`,
      [campaignId],
    ),
  ]);

  const replyMap = new Map<string, number>();
  for (const r of repliesRes.rows) {
    replyMap.set(`${r.step_id ?? 0}:${r.variant_id ?? 0}`, Number(r.n));
  }

  const cells: FunnelCell[] = sendsRes.rows
    .map((r) => ({
      step_id: r.step_id,
      position: r.position,
      variant_id: r.variant_id,
      variant_label: r.variant_label ?? "A",
      sends: Number(r.n),
      replies: replyMap.get(`${r.step_id ?? 0}:${r.variant_id ?? 0}`) ?? 0,
    }))
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99) || a.variant_label.localeCompare(b.variant_label));

  const t = totalsRes.rows[0]!;
  return {
    cells,
    totals: {
      sends: Number(t.sends),
      replies: Number(t.replies),
      positivos: Number(t.positivos),
      leads: Number(t.leads),
      agendados: Number(t.agendados),
      ganhos: Number(t.ganhos),
      valor_ganho_cents: Number(t.valor_ganho_cents),
    },
  };
}
