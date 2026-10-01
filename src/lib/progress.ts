// Shared tail of every scoring endpoint (/api/attempts, /api/practice): stickers, weekly goal,
// and the reward payload the Results screen animates.
import { checkWeeklyGoal, studentStats, xpToday, type StudentRow } from './db';
import { earnedStickers, eventStickers, kingdomIndex, levelFromXp, madridClock, type XpBreakdown } from './rewards';
import type { ItemResult } from '../games/types';

/**
 * Inserts the stickers the student just earned: derived from totals (`after` must already be
 * saved), `extra` ones (event / campaign rewards) and the class weekly goal. Returns the new ids.
 */
export async function awardStickers(db: D1Database, after: StudentRow, extra: string[], play?: { puzzlesSolved: number; mistakes: number }): Promise<string[]> {
  const [{ results: owned }, stats] = await Promise.all([
    db.prepare('SELECT sticker_id FROM student_stickers WHERE student_id = ?').bind(after.id).all<{ sticker_id: string }>(),
    studentStats(db, after),
  ]);
  const have = new Set(owned.map((o) => o.sticker_id));
  const events = play ? eventStickers({ ...madridClock(new Date()), ...play }) : [];
  const fresh = [...new Set([...extra, ...events, ...earnedStickers(stats)])].filter((id) => !have.has(id));
  if (fresh.length) {
    await db.batch(fresh.map((id) => db.prepare('INSERT OR IGNORE INTO student_stickers (student_id, sticker_id) VALUES (?, ?)').bind(after.id, id)));
  }
  if ((play?.puzzlesSolved ?? 0) > 0 && (await checkWeeklyGoal(db, after.class_id, after.id))) fresh.push('reto-clase');
  return fresh;
}

export async function rewardPayload(db: D1Database, before: StudentRow, after: StudentRow, xp: XpBreakdown, opts: {
  firstTime: boolean; streak: { value: number; extended: boolean }; newStickers: string[]; extra?: Record<string, unknown>;
}) {
  return {
    xp,
    firstTime: opts.firstTime,
    before: { xp: before.xp, level: levelFromXp(before.xp), kingdom: kingdomIndex(before.xp) },
    after: { xp: after.xp, level: levelFromXp(after.xp), kingdom: kingdomIndex(after.xp) },
    streak: opts.streak,
    newStickers: opts.newStickers,
    dailyXp: await xpToday(db, after.id),
    ...opts.extra,
  };
}

/** Cleans per-item results sent by the client: at most `count` items, bounded numbers. */
export function cleanItems(raw: unknown, count: number): ItemResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, Math.min(count, 100)).map((r: any) => ({
    ok: !!r?.ok,
    mistakes: Math.max(0, Math.min(50, Math.round(Number(r?.mistakes) || 0))),
    seconds: Math.max(0, Math.min(3600, Math.round(Number(r?.seconds) || 0))),
  }));
}
