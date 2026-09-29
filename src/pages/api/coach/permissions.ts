import type { APIRoute } from 'astro';
import { classPerm, json, readJson } from '../../../lib/db';

interface Body { classId: number; email?: string; coachId?: number; can_view_progress?: boolean; can_create_content?: boolean; can_manage_students?: boolean }

// Class owners share a class with another coach, choosing exactly what they can do.
export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const b = await readJson<Body>(request);
  const perm = await classPerm(db, locals.coach!.id, Number(b.classId));
  if (!perm?.is_owner) return json({ error: 'Solo el profe responsable de la clase puede dar permisos' }, 403);
  const other = b.coachId
    ? await db.prepare('SELECT id FROM coaches WHERE id = ?').bind(Number(b.coachId)).first<{ id: number }>()
    : await db.prepare('SELECT id FROM coaches WHERE email = ?').bind(String(b.email ?? '').trim()).first<{ id: number }>();
  if (!other) return json({ error: 'Ese profe aún no tiene cuenta. Pídele que se registre primero.' }, 404);
  if (other.id === locals.coach!.id) return json({ error: 'Ya eres el responsable de esta clase' }, 400);
  await db.prepare(`INSERT INTO class_permissions (class_id, coach_id, is_owner, can_view_progress, can_create_content, can_manage_students)
      VALUES (?, ?, 0, ?, ?, ?)
      ON CONFLICT(class_id, coach_id) DO UPDATE SET can_view_progress = excluded.can_view_progress,
        can_create_content = excluded.can_create_content, can_manage_students = excluded.can_manage_students`)
    .bind(Number(b.classId), other.id, b.can_view_progress ? 1 : 0, b.can_create_content ? 1 : 0, b.can_manage_students ? 1 : 0).run();
  // Make sure the colleague belongs to the club so they can see its activity library.
  await db.prepare(`INSERT OR IGNORE INTO club_coaches (club_id, coach_id, role) SELECT club_id, ?, 'coach' FROM classes WHERE id = ?`)
    .bind(other.id, Number(b.classId)).run();
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const b = await readJson<Body>(request);
  const perm = await classPerm(db, locals.coach!.id, Number(b.classId));
  if (!perm?.is_owner) return json({ error: 'Sin permiso' }, 403);
  await db.prepare('DELETE FROM class_permissions WHERE class_id = ? AND coach_id = ? AND is_owner = 0').bind(Number(b.classId), Number(b.coachId)).run();
  return json({ ok: true });
};
