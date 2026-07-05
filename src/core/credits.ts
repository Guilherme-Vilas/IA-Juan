import { pool } from "./db.js";
import { logger } from "./logger.js";

// ============================================================================
// Créditos de prospecção. 1 crédito = 1 lead com telefone.
//
// Contas (tenant_credits): balance = gastável, reserved = em hold por buscas.
// Total da conta = balance + reserved; só cai em débito real, só sobe em recarga.
//
// Fluxo de uma busca:
//   holdForSearch  → move min(pedido, balance) de balance p/ reserved
//   settleSearch   → cobra os leads-com-telefone (do reserved), devolve o resto
//   releaseHold    → cancela a reserva inteira (busca falhou/apagada sem rodar)
//
// Todas as mutações passam por SELECT ... FOR UPDATE na linha do tenant, então
// duas buscas simultâneas nunca furam o saldo.
// ============================================================================

export type Credits = { balance: number; reserved: number };

export type CreditTx = {
  id: number;
  amount: number;
  balance_after: number;
  kind: "topup" | "debit" | "adjust";
  reason: string | null;
  ref_type: string | null;
  ref_id: number | null;
  actor: string | null;
  created_at: Date;
};

async function ensureRow(tenantId: number): Promise<void> {
  await pool.query(
    `INSERT INTO tenant_credits (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId],
  );
}

export async function getCredits(tenantId: number): Promise<Credits> {
  await ensureRow(tenantId);
  const { rows } = await pool.query<Credits>(
    `SELECT balance, reserved FROM tenant_credits WHERE tenant_id = $1`,
    [tenantId],
  );
  return rows[0] ?? { balance: 0, reserved: 0 };
}

export async function listTransactions(tenantId: number, limit = 50): Promise<CreditTx[]> {
  const { rows } = await pool.query<CreditTx>(
    `SELECT id, amount, balance_after, kind, reason, ref_type, ref_id, actor, created_at
       FROM credit_transactions WHERE tenant_id = $1 ORDER BY id DESC LIMIT $2`,
    [tenantId, limit],
  );
  return rows;
}

// Recarga manual (superadmin). Retorna o novo total da conta.
export async function topup(
  tenantId: number,
  amount: number,
  actor: string,
  reason?: string,
): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("amount deve ser inteiro positivo");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO tenant_credits (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId],
    );
    const { rows } = await client.query<Credits>(
      `SELECT balance, reserved FROM tenant_credits WHERE tenant_id = $1 FOR UPDATE`,
      [tenantId],
    );
    const cur = rows[0]!;
    const newBalance = cur.balance + amount;
    const total = newBalance + cur.reserved;
    await client.query(
      `UPDATE tenant_credits SET balance = $1, updated_at = now() WHERE tenant_id = $2`,
      [newBalance, tenantId],
    );
    await client.query(
      `INSERT INTO credit_transactions (tenant_id, amount, balance_after, kind, reason, actor)
       VALUES ($1,$2,$3,'topup',$4,$5)`,
      [tenantId, amount, total, reason ?? null, actor],
    );
    await client.query("COMMIT");
    logger.info({ tenantId, amount, actor, total }, "credits: recarga");
    return total;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Reserva até `want` créditos (o que o saldo cobrir). Retorna o quanto reservou
// — a busca deve rodar SÓ essa quantidade (entrega parcial).
export async function holdForSearch(tenantId: number, want: number): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO tenant_credits (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId],
    );
    const { rows } = await client.query<Credits>(
      `SELECT balance, reserved FROM tenant_credits WHERE tenant_id = $1 FOR UPDATE`,
      [tenantId],
    );
    const cur = rows[0]!;
    const hold = Math.max(0, Math.min(want, cur.balance));
    if (hold > 0) {
      await client.query(
        `UPDATE tenant_credits SET balance = balance - $1, reserved = reserved + $1, updated_at = now()
           WHERE tenant_id = $2`,
        [hold, tenantId],
      );
    }
    await client.query("COMMIT");
    return hold;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Fecha a conta da busca: cobra `used` (≤ reserva), devolve o restante ao saldo,
// grava o débito no ledger. Idempotente via ledger ref (ref_id).
export async function settleSearch(
  tenantId: number,
  searchId: number,
  reserved: number,
  used: number,
): Promise<{ charged: number; refunded: number }> {
  const charge = Math.max(0, Math.min(used, reserved));
  const refund = reserved - charge;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<Credits>(
      `SELECT balance, reserved FROM tenant_credits WHERE tenant_id = $1 FOR UPDATE`,
      [tenantId],
    );
    const cur = rows[0] ?? { balance: 0, reserved: 0 };
    const newReserved = Math.max(0, cur.reserved - reserved);
    const newBalance = cur.balance + refund;
    await client.query(
      `UPDATE tenant_credits SET balance = $1, reserved = $2, updated_at = now() WHERE tenant_id = $3`,
      [newBalance, newReserved, tenantId],
    );
    if (charge > 0) {
      await client.query(
        `INSERT INTO credit_transactions (tenant_id, amount, balance_after, kind, reason, ref_type, ref_id, actor)
         VALUES ($1,$2,$3,'debit',$4,'discovery_search',$5,'system')`,
        [tenantId, -charge, newBalance + newReserved, `${charge} leads com telefone`, searchId],
      );
    }
    await client.query("COMMIT");
    logger.info({ tenantId, searchId, charged: charge, refunded: refund }, "credits: busca liquidada");
    return { charged: charge, refunded: refund };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Cancela a reserva inteira (nada foi entregue). Devolve tudo ao saldo.
export async function releaseHold(tenantId: number, reserved: number): Promise<void> {
  if (reserved <= 0) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<Credits>(
      `SELECT reserved FROM tenant_credits WHERE tenant_id = $1 FOR UPDATE`,
      [tenantId],
    );
    const curReserved = rows[0]?.reserved ?? 0;
    const release = Math.min(reserved, curReserved);
    await client.query(
      `UPDATE tenant_credits SET balance = balance + $1, reserved = reserved - $1, updated_at = now()
         WHERE tenant_id = $2`,
      [release, tenantId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
