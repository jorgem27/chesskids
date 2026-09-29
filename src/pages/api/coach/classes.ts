import type { APIRoute } from 'astro';
import { makeClassCode } from '../../../lib/catalog';
import { isClubMember, json, readJson } from '../../../lib/db';

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
    .bind(Number(b.clubId), name, code, b.emoji || '♞', b.color || 'violet', coach.id).first<{ id: number }>();
  await db.prepare('INSERT INTO class_permissions (class_id, coach_id, is_owner, can_view_progress, can_create_content, can_manage_students) VALUES (?, ?, 1, 1, 1, 1)')
    .bind(cl!.id, coach.id).run();
  return json({ id: cl!.id, code });
};
