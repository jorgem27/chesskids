import type { APIRoute } from 'astro';
import { classPerm, json } from '../../../../lib/db';

export const DELETE: APIRoute = async ({ locals, params }) => {
  const db = locals.db;
  const a = await db.prepare('SELECT id, class_id FROM assignments WHERE id = ?').bind(Number(params.id)).first<{ id: number; class_id: number }>();
  if (!a) return json({ error: 'No existe' }, 404);
  const perm = await classPerm(db, locals.coach!.id, a.class_id);
  if (!perm || !(perm.is_owner || perm.can_create_content)) return json({ error: 'Sin permiso' }, 403);
  await db.prepare('DELETE FROM assignments WHERE id = ?').bind(a.id).run();
  return json({ ok: true });
};
