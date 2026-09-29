import type { APIRoute } from 'astro';
import { classPerm, json, readJson, today } from '../../../../lib/db';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const b = await readJson<{ classId: number; activityIds: number[]; startsOn?: string; dueOn?: string; note?: string }>(request);
  const perm = await classPerm(db, locals.coach!.id, Number(b.classId));
  if (!perm || !(perm.is_owner || perm.can_create_content)) return json({ error: 'No tienes permiso para poner deberes en esta clase' }, 403);
  const cls = await db.prepare('SELECT club_id FROM classes WHERE id = ?').bind(Number(b.classId)).first<{ club_id: number }>();
  const ids = (b.activityIds ?? []).map(Number).filter(Boolean);
  if (!ids.length) return json({ error: 'Elige al menos una actividad' }, 400);
  const startsOn = b.startsOn && DATE.test(b.startsOn) ? b.startsOn : today();
  const dueOn = b.dueOn && DATE.test(b.dueOn) ? b.dueOn : null;
  const stmts = [];
  for (const id of ids) {
    const ok = await db.prepare('SELECT 1 FROM activities WHERE id = ? AND club_id = ?').bind(id, cls!.club_id).first();
    // Skip if this activity is already an active mission in the class
    const dup = await db.prepare('SELECT 1 FROM assignments WHERE class_id = ? AND activity_id = ? AND (due_on IS NULL OR due_on >= ?)')
      .bind(Number(b.classId), id, today()).first();
    if (ok && !dup) stmts.push(db.prepare('INSERT INTO assignments (class_id, activity_id, assigned_by, starts_on, due_on, note) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(Number(b.classId), id, locals.coach!.id, startsOn, dueOn, String(b.note ?? '').slice(0, 200)));
  }
  if (stmts.length) await db.batch(stmts);
  if (!stmts.length) return json({ error: 'Esas actividades ya están asignadas' }, 400);
  return json({ ok: true, count: stmts.length });
};
