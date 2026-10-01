import type { APIRoute } from 'astro';
import { classPerm, json, readJson, today } from '../../../../lib/db';
import { scheduleDates, type ScheduleMode } from '../../../../lib/dates';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MODES: ScheduleMode[] = ['all', 'daily', 'every2', 'weekly'];

interface Body {
  classId: number;
  /** Extra classes (same club) that get the same missions. */
  classIds?: number[];
  activityIds: number[];
  startsOn?: string;
  dueOn?: string;
  note?: string;
  /** 'all' = all at once; otherwise one mission every 1/2/7 days, each open `spanDays`. */
  schedule?: ScheduleMode;
  spanDays?: number;
}

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const coachId = locals.coach!.id;
  const b = await readJson<Body>(request);
  const classIds = [...new Set([Number(b.classId), ...(Array.isArray(b.classIds) ? b.classIds.map(Number) : [])].filter(Boolean))].slice(0, 20);
  const ids = [...new Set((b.activityIds ?? []).map(Number).filter(Boolean))].slice(0, 50);
  if (!ids.length) return json({ error: 'Elige al menos una actividad' }, 400);
  if (!classIds.length) return json({ error: 'Elige una clase' }, 400);

  // Every class must be one where this coach can set homework, all in the same club.
  const perms = await Promise.all(classIds.map((c) => classPerm(db, coachId, c)));
  if (perms.some((p) => !p || !(p.is_owner || p.can_create_content))) return json({ error: 'No tienes permiso para poner deberes en alguna de esas clases' }, 403);
  const marks = (n: number) => Array(n).fill('?').join(',');
  const { results: classes } = await db.prepare(`SELECT id, club_id FROM classes WHERE id IN (${marks(classIds.length)})`).bind(...classIds).all<{ id: number; club_id: number }>();
  const clubId = classes.find((c) => c.id === Number(b.classId))?.club_id ?? classes[0]?.club_id;
  if (classes.length !== classIds.length || classes.some((c) => c.club_id !== clubId)) return json({ error: 'Las clases deben ser del mismo club' }, 400);

  const t = today();
  const startsOn = b.startsOn && DATE.test(b.startsOn) ? b.startsOn : t;
  const dueOn = b.dueOn && DATE.test(b.dueOn) ? b.dueOn : null;
  const mode = MODES.includes(b.schedule as ScheduleMode) ? (b.schedule as ScheduleMode) : 'all';
  if (mode === 'all' && dueOn && dueOn < startsOn) return json({ error: 'La fecha final es anterior a la de inicio' }, 400);

  const [visible, active] = await db.batch<any>([
    db.prepare(`SELECT id FROM activities WHERE club_id = ? AND (visibility = 'public' OR created_by = ?) AND id IN (${marks(ids.length)})`).bind(clubId, coachId, ...ids),
    // Skip activities that are already an active mission in that class.
    db.prepare(`SELECT class_id, activity_id FROM assignments WHERE class_id IN (${marks(classIds.length)}) AND activity_id IN (${marks(ids.length)}) AND (due_on IS NULL OR due_on >= ?)`)
      .bind(...classIds, ...ids, t),
  ]);
  const ok = new Set<number>(visible.results.map((r: any) => r.id));
  const dup = new Set<string>(active.results.map((r: any) => `${r.class_id}:${r.activity_id}`));
  const ordered = ids.filter((id) => ok.has(id)); // keep the coach's order for scheduling
  const dates = scheduleDates(startsOn, dueOn, ordered.length, mode, Number(b.spanDays) || 7);
  const note = String(b.note ?? '').slice(0, 200);

  const stmts: D1PreparedStatement[] = [];
  for (const classId of classIds) {
    ordered.forEach((activityId, i) => {
      if (dup.has(`${classId}:${activityId}`)) return;
      stmts.push(db.prepare('INSERT INTO assignments (class_id, activity_id, assigned_by, starts_on, due_on, note) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(classId, activityId, coachId, dates[i].startsOn, dates[i].dueOn, note));
    });
  }
  if (!stmts.length) return json({ error: 'Esas actividades ya están asignadas' }, 400);
  await db.batch(stmts);
  return json({ ok: true, count: stmts.length });
};
