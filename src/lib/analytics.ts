// Student-facing progress analytics (the "Mi progreso" page). Pure functions: the queries live
// in db.ts (`dailyActivityQuery`) and the page.
import { addDays } from './dates';

export interface DailyActivity { day: string; xp: number; secs: number; solved: number }

/** `n` consecutive days ending on `end` (oldest first), with zeros for days without activity. */
export function dailySeries(rows: DailyActivity[], end: string, n: number): DailyActivity[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(end, i - n + 1);
    const r = byDay.get(day);
    return { day, xp: r?.xp ?? 0, secs: r?.secs ?? 0, solved: r?.solved ?? 0 };
  });
}

export interface Totals { xp: number; secs: number; solved: number; activeDays: number }

export function totals(series: DailyActivity[]): Totals {
  return series.reduce<Totals>(
    (t, d) => ({ xp: t.xp + d.xp, secs: t.secs + d.secs, solved: t.solved + d.solved, activeDays: t.activeDays + (d.xp > 0 || d.solved > 0 ? 1 : 0) }),
    { xp: 0, secs: 0, solved: 0, activeDays: 0 },
  );
}

/** Relative change from `prev` to `cur` as a whole percentage; null when there is no baseline. */
export function trend(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

/** Share of items solved first time, as a whole percentage (null when nothing was played). */
export function accuracy(ok: number, total: number): number | null {
  return total > 0 ? Math.round((ok / total) * 100) : null;
}

export function fmtDuration(secs: number): string {
  if (secs >= 3600) return `${Math.floor(secs / 3600)} h ${Math.floor((secs % 3600) / 60)} min`;
  return `${Math.floor(secs / 60)} min`;
}
