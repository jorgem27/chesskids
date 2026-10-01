import type { APIRoute } from 'astro';
import { classColorHex, makeClassCode } from '../../../lib/catalog';
import { checkCoachPassword } from '../../../lib/auth';
import { classPerm, isClubMember, json, readJson } from '../../../lib/db';

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const coach = locals.coach!;
  const b = await readJson<{ clubId: number; name: string; emoji?: string; color?: string }>(request);
  if (!(await isClubMember(db, coach.id, Number(b.clubId)))) return json({ error: 'No perteneces a ese club' }, 403);
  const name = String(b.name ?? '').trim();
  if (!name) return json({ error: 'Pon un nombre a la clase' }, 400);
  let code = makeClassCode();
  while (await db.prepare('SELECT 1 FROM classes WHERE code = ?').bind(code).first()) code = makeClassCode();
  const cl = await db.prepare('INSERT INTO classes (club_id, name, code, emoji, color, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(Number(b.clubId), name, code, b.emoji || '♞', classColorHex(b.color), coach.id).first<{ id: number }>();
  await db.prepare('INSERT INTO class_permissions (class_id, coach_id, is_owner, can_view_progress, can_create_content, can_manage_students) VALUES (?, ?, 1, 1, 1, 1)')
    .bind(cl!.id, coach.id).run();
  return json({ id: cl!.id, code });
};

// Rename a class or set its weekly goal (responsible coach only).
export const PATCH: APIRoute = async ({ locals, request }) => {
  const b = await readJson<{ classId: number; name?: string; weeklyGoal?: string | number }>(request);
  const perm = await classPerm(locals.db, locals.coach!.id, Number(b.classId));
  if (!perm?.is_owner) return json({ error: 'Solo el profe responsable puede cambiar la clase' }, 403);
  if (b.weeklyGoal !== undefined) {
    const goal = Math.max(0, Math.min(5000, Math.round(Number(b.weeklyGoal) || 0))); // 0 = automatic
    await locals.db.prepare('UPDATE classes SET weekly_goal = ? WHERE id = ?').bind(goal, Number(b.classId)).run();
    return json({ ok: true, weeklyGoal: goal });
  }
  const name = String(b.name ?? '').trim().slice(0, 40);
  if (!name) return json({ error: 'Pon un nombre a la clase' }, 400);
  await locals.db.prepare('UPDATE classes SET name = ? WHERE id = ?').bind(name, Number(b.classId)).run();
  return json({ ok: true, name });
};

// Delete a class with all its students and progress (responsible coach + password).
export const DELETE: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const b = await readJson<{ classId: number; password: string }>(request);
  const classId = Number(b.classId);
  const perm = await classPerm(db, locals.coach!.id, classId);
  if (!perm?.is_owner) return json({ error: 'Solo el profe responsable puede borrar la clase' }, 403);
  const bad = await checkCoachPassword(db, locals.coach!.id, b.password);
  if (bad) return json({ error: bad }, 403);
  const kids = "(SELECT id FROM students WHERE class_id = ?)";
  await db.batch([
    db.prepare(`DELETE FROM sessions WHERE user_type = 'student' AND user_id IN ${kids}`).bind(classId),
    db.prepare(`DELETE FROM attempts WHERE student_id IN ${kids}`).bind(classId),
    db.prepare(`DELETE FROM student_stickers WHERE student_id IN ${kids}`).bind(classId),
    db.prepare(`DELETE FROM projector_results WHERE student_id IN ${kids}`).bind(classId),
    db.prepare('DELETE FROM projector_sessions WHERE class_id = ?').bind(classId),
    db.prepare('DELETE FROM students WHERE class_id = ?').bind(classId),
    db.prepare('DELETE FROM assignments WHERE class_id = ?').bind(classId),
    db.prepare('DELETE FROM class_permissions WHERE class_id = ?').bind(classId),
    db.prepare('DELETE FROM classes WHERE id = ?').bind(classId),
  ]);
  return json({ ok: true });
};
