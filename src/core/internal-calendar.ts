import { DateTime, Interval } from "luxon";
import { pool } from "./db.js";
import type { TenantRow } from "./tenants.js";

export type WorkingHourRow = {
  id: number;
  tenant_id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
};

export type CalendarBlockRow = {
  id: number;
  tenant_id: number;
  starts_at: Date;
  ends_at: Date;
  reason: string | null;
  created_at: Date;
};

export async function listWorkingHours(tenantId: number): Promise<WorkingHourRow[]> {
  const { rows } = await pool.query<WorkingHourRow>(
    `SELECT * FROM tenant_working_hours WHERE tenant_id = $1 ORDER BY weekday ASC`,
    [tenantId],
  );
  return rows;
}

export async function upsertWorkingHour(
  tenantId: number,
  weekday: number,
  patch: { start_time: string; end_time: string; active: boolean },
) {
  await pool.query(
    `INSERT INTO tenant_working_hours (tenant_id, weekday, start_time, end_time, active)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, weekday) DO UPDATE SET
       start_time = EXCLUDED.start_time,
       end_time = EXCLUDED.end_time,
       active = EXCLUDED.active,
       updated_at = now()`,
    [tenantId, weekday, patch.start_time, patch.end_time, patch.active],
  );
}

export async function listCalendarBlocks(tenantId: number, from = new Date(), to?: Date) {
  const end = to ?? DateTime.fromJSDate(from).plus({ days: 30 }).toJSDate();
  const { rows } = await pool.query<CalendarBlockRow>(
    `SELECT * FROM tenant_calendar_blocks
      WHERE tenant_id = $1
        AND starts_at < $3
        AND ends_at > $2
      ORDER BY starts_at ASC`,
    [tenantId, from, end],
  );
  return rows;
}

export async function createCalendarBlock(
  tenantId: number,
  input: { starts_at: string; ends_at: string; reason?: string | null },
) {
  const { rows } = await pool.query<CalendarBlockRow>(
    `INSERT INTO tenant_calendar_blocks (tenant_id, starts_at, ends_at, reason)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tenantId, input.starts_at, input.ends_at, input.reason ?? null],
  );
  return rows[0]!;
}

export async function deleteCalendarBlock(tenantId: number, blockId: number) {
  await pool.query(`DELETE FROM tenant_calendar_blocks WHERE tenant_id = $1 AND id = $2`, [
    tenantId,
    blockId,
  ]);
}

export async function listInternalBusyIntervals(
  tenantId: number,
  from: DateTime,
  to: DateTime,
): Promise<Interval[]> {
  const { rows } = await pool.query<{ starts_at: Date; ends_at: Date }>(
    `SELECT scheduled_at AS starts_at, ends_at
       FROM appointments
      WHERE tenant_id = $1
        AND status = 'scheduled'
        AND scheduled_at < $3
        AND ends_at > $2
     UNION ALL
     SELECT starts_at, ends_at
       FROM tenant_calendar_blocks
      WHERE tenant_id = $1
        AND starts_at < $3
        AND ends_at > $2`,
    [tenantId, from.toJSDate(), to.toJSDate()],
  );
  return rows.map((r) =>
    Interval.fromDateTimes(DateTime.fromJSDate(r.starts_at), DateTime.fromJSDate(r.ends_at)),
  );
}

export async function listWorkingWindows(
  tenant: TenantRow,
  from: DateTime,
  to: DateTime,
): Promise<Interval[]> {
  const configured = await listWorkingHours(tenant.id);
  const byWeekday = new Map(configured.map((w) => [w.weekday, w]));
  const windows: Interval[] = [];
  let day = from.setZone(tenant.timezone).startOf("day");

  while (day < to) {
    const row = byWeekday.get(day.weekday);
    const active = row?.active ?? day.weekday <= 5;
    if (active) {
      const startParts = (row?.start_time ?? `${tenant.work_start_hour}:00`).split(":").map(Number);
      const endParts = (row?.end_time ?? `${tenant.work_end_hour}:00`).split(":").map(Number);
      const start = day.set({
        hour: startParts[0] ?? tenant.work_start_hour,
        minute: startParts[1] ?? 0,
        second: 0,
        millisecond: 0,
      });
      const end = day.set({
        hour: endParts[0] ?? tenant.work_end_hour,
        minute: endParts[1] ?? 0,
        second: 0,
        millisecond: 0,
      });
      if (end > start) windows.push(Interval.fromDateTimes(start, end));
    }
    day = day.plus({ days: 1 });
  }

  return windows;
}
