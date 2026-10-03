// Family report: a read-only link (/familia/<token>) and a weekly WhatsApp summary written by the coach.
import { dailyActivityQuery, today, type StudentRow } from './db';
import { addDays } from './dates';
import { fmtDuration, totals, dailySeries, type DailyActivity } from './analytics';
import { levelFromXp } from './rewards';

export interface WeekSummary { xp: number; solved: number; secs: number; activeDays: number; streak: number; level: number; stickers: number }

/** Last 7 days (today included) for one student. */
export async function weekSummary(db: D1Database, s: StudentRow): Promise<WeekSummary> {
  const t = today();
  const [daily, st] = await db.batch<any>([
    dailyActivityQuery(db, s.id, addDays(t, -6)),
    db.prepare('SELECT COUNT(*) AS n FROM student_stickers WHERE student_id = ? AND earned_at >= ?').bind(s.id, Math.floor(Date.now() / 1000) - 7 * 86400),
  ]);
  const tot = totals(dailySeries(daily.results as DailyActivity[], t, 7));
  const streak = s.last_active_day && s.last_active_day >= addDays(t, -1) ? s.streak : 0;
  return { xp: tot.xp, solved: tot.solved, secs: tot.secs, activeDays: tot.activeDays, streak, level: levelFromXp(s.xp), stickers: st.results[0]?.n ?? 0 };
}

/** Friendly WhatsApp text for the family. Pure, so it can be tested. */
export function familyMessage(name: string, w: WeekSummary, link: string): string {
  const lines = [`¡Hola, familia! ♟️ Así ha ido la semana de ${name} en Odisea Miranda:`];
  if (w.activeDays === 0) {
    lines.push('', 'Esta semana no ha jugado. ¡Un ratito al día de ajedrez marca la diferencia! 💪');
  } else {
    lines.push(
      '',
      `📅 ${w.activeDays} ${w.activeDays === 1 ? 'día' : 'días'} practicando`,
      `🧩 ${w.solved} ${w.solved === 1 ? 'problema resuelto' : 'problemas resueltos'}`,
      `⏱️ ${fmtDuration(w.secs)} aprendiendo`,
      `⭐ ${w.xp} XP ganados (nivel ${w.level})`,
    );
    if (w.streak >= 2) lines.push(`🔥 Racha de ${w.streak} días`);
    if (w.stickers > 0) lines.push(`📒 ${w.stickers} ${w.stickers === 1 ? 'cromo nuevo' : 'cromos nuevos'}`);
  }
  lines.push('', `Aquí podéis ver todo su progreso (solo lectura, no lo compartáis):`, link);
  return lines.join('\n');
}
