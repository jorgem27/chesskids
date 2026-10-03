// Class progress report for coaches: the same rows feed the CSV download and the printable (PDF) page.
import { today } from './db';
import { addDays } from './dates';
import { AGE_GROUPS, type AgeGroup } from './catalog';
import { levelFromXp } from './rewards';

export interface ReportRow {
  id: number; name: string; username: string; group: string; level: number; xp: number;
  streak: number; bestStreak: number; solved: number; minutes: number; games: number;
  homeworkDone: number; homeworkTotal: number; avgStars: number | null;
  xp7: number; solved7: number; xp30: number; activeDays30: number; lastDay: string | null;
}

export async function classReport(db: D1Database, classId: number): Promise<{ rows: ReportRow[]; homeworkTotal: number; since30: string; today: string }> {
  const t = today();
  const since30 = addDays(t, -29);
  const since7 = addDays(t, -6);
  const kids = 'SELECT id FROM students WHERE class_id = ? AND archived = 0';
  const [students, daily, hw, total, stars] = await db.batch<any>([
    db.prepare('SELECT * FROM students WHERE class_id = ? AND archived = 0 ORDER BY display_name').bind(classId),
    db.prepare(
      `SELECT sid, day, SUM(xp) AS xp, SUM(solved) AS solved FROM (
         SELECT student_id AS sid, day, xp_earned AS xp, puzzles_solved AS solved FROM attempts WHERE student_id IN (${kids}) AND day >= ?
         UNION ALL SELECT student_id, day, xp_earned, solved FROM practice_sessions WHERE student_id IN (${kids}) AND day >= ? AND finished_at IS NOT NULL
         UNION ALL SELECT student_id, day, xp_earned, solved FROM projector_results WHERE student_id IN (${kids}) AND day >= ?
       ) GROUP BY sid, day`,
    ).bind(classId, since30, classId, since30, classId, since30),
    db.prepare(
      `SELECT at.student_id AS sid, COUNT(DISTINCT x.id) AS n FROM assignments x JOIN attempts at ON at.activity_id = x.activity_id
       WHERE x.class_id = ? AND x.starts_on <= ? AND at.student_id IN (${kids}) GROUP BY at.student_id`,
    ).bind(classId, t, classId),
    db.prepare('SELECT COUNT(*) AS n FROM assignments WHERE class_id = ? AND starts_on <= ?').bind(classId, t),
    db.prepare(
      `SELECT sid, AVG(best) AS avg FROM (
         SELECT at.student_id AS sid, x.id, MAX(at.stars) AS best FROM assignments x JOIN attempts at ON at.activity_id = x.activity_id
         WHERE x.class_id = ? AND at.student_id IN (${kids}) GROUP BY at.student_id, x.id
       ) GROUP BY sid`,
    ).bind(classId, classId),
  ]);
  const homeworkTotal = (total.results[0] as { n: number }).n;
  const hwBy = new Map((hw.results as { sid: number; n: number }[]).map((r) => [r.sid, r.n]));
  const starsBy = new Map((stars.results as { sid: number; avg: number }[]).map((r) => [r.sid, r.avg]));
  const rows = (students.results as any[]).map((s): ReportRow => {
    const days = (daily.results as { sid: number; day: string; xp: number; solved: number }[]).filter((d) => d.sid === s.id);
    const last7 = days.filter((d) => d.day >= since7);
    return {
      id: s.id, name: s.display_name, username: s.username, group: AGE_GROUPS[s.age_group as AgeGroup]?.label ?? s.age_group,
      level: levelFromXp(s.xp), xp: s.xp,
      streak: s.last_active_day && s.last_active_day >= addDays(t, -1) ? s.streak : 0, bestStreak: s.best_streak,
      solved: s.puzzles_solved, minutes: Math.round(s.total_seconds / 60), games: s.games_completed,
      homeworkDone: hwBy.get(s.id) ?? 0, homeworkTotal,
      avgStars: starsBy.has(s.id) ? Math.round(starsBy.get(s.id)! * 10) / 10 : null,
      xp7: last7.reduce((n, d) => n + d.xp, 0), solved7: last7.reduce((n, d) => n + d.solved, 0),
      xp30: days.reduce((n, d) => n + d.xp, 0), activeDays30: days.filter((d) => d.xp > 0 || d.solved > 0).length,
      lastDay: s.last_active_day,
    };
  });
  return { rows, homeworkTotal, since30, today: t };
}

export const CSV_COLUMNS: [string, (r: ReportRow) => string | number | null][] = [
  ['Alumno', (r) => r.name],
  ['Grupo', (r) => r.group],
  ['Nivel', (r) => r.level],
  ['XP total', (r) => r.xp],
  ['Racha actual', (r) => r.streak],
  ['Mejor racha', (r) => r.bestStreak],
  ['Problemas resueltos', (r) => r.solved],
  ['Minutos de aprendizaje', (r) => r.minutes],
  ['Actividades completadas', (r) => r.games],
  ['Misiones hechas', (r) => r.homeworkDone],
  ['Misiones asignadas', (r) => r.homeworkTotal],
  ['Media de estrellas', (r) => (r.avgStars === null ? '' : String(r.avgStars).replace('.', ','))],
  ['XP 7 días', (r) => r.xp7],
  ['Problemas 7 días', (r) => r.solved7],
  ['XP 30 días', (r) => r.xp30],
  ['Días activos (30)', (r) => r.activeDays30],
  ['Última actividad', (r) => r.lastDay ?? 'nunca'],
];

/** Excel-friendly CSV for Spain: UTF-8 BOM, ";" separator, CRLF, quoted cells, no formula injection. */
export function toCsv(rows: ReportRow[]): string {
  const cell = (v: string | number | null) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [CSV_COLUMNS.map(([h]) => cell(h)).join(';'), ...rows.map((r) => CSV_COLUMNS.map(([, f]) => cell(f(r))).join(';'))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
