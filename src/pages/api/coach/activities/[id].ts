import type { APIRoute } from 'astro';
import { canEditActivity, json, readJson } from '../../../../lib/db';
import { checkActivity, clampXp, type ActivityBody } from '../../../../lib/activities';

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const a = await canEditActivity(locals.db, locals.coach!.id, Number(params.id));
  if (!a) return json({ error: 'Sin permiso' }, 403);
  const b = await readJson<ActivityBody>(request);
  b.type = a.type;
  const errors = checkActivity(b);
  if (errors.length) return json({ error: errors.join(' · '), errors }, 400);
  await locals.db.prepare(
    `UPDATE activities SET title = ?, description = ?, content_json = ?, xp_reward = ?, updated_at = unixepoch() WHERE id = ?`,
  ).bind(b.title.trim(), String(b.description ?? '').trim(), JSON.stringify(b.content), clampXp(b.xpReward, a.type), a.id).run();
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const a = await canEditActivity(locals.db, locals.coach!.id, Number(params.id));
  if (!a) return json({ error: 'Sin permiso' }, 403);
  await locals.db.prepare('DELETE FROM activities WHERE id = ?').bind(a.id).run();
  return json({ ok: true });
};
