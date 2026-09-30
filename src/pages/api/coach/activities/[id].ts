import type { APIRoute } from 'astro';
import { activityAccess, forkActivity, json, readJson } from '../../../../lib/db';
import { checkActivity, clampXp, type ActivityBody } from '../../../../lib/activities';

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const acc = await activityAccess(locals.db, locals.coach!.id, Number(params.id));
  if (!acc) return json({ error: 'Sin permiso' }, 403);
  const a = acc.activity;
  const b = await readJson<ActivityBody>(request);
  b.type = a.type;
  const errors = checkActivity(b);
  if (errors.length) return json({ error: errors.join(' · '), errors }, 400);
  const title = b.title.trim();
  const description = String(b.description ?? '').trim();
  const xp = clampXp(b.xpReward, a.type);

  // A coach who is not a club admin never touches a public activity: they get their own private copy.
  if (acc.needsFork) {
    const id = await forkActivity(locals.db, locals.coach!.id, a, { title, description, content: b.content, xpReward: xp });
    return json({ ok: true, forked: true, id });
  }
  await locals.db.prepare(
    `UPDATE activities SET title = ?, description = ?, content_json = ?, xp_reward = ?, updated_at = unixepoch() WHERE id = ?`,
  ).bind(title, description, JSON.stringify(b.content), xp, a.id).run();
  return json({ ok: true, id: a.id });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const acc = await activityAccess(locals.db, locals.coach!.id, Number(params.id));
  if (!acc || acc.needsFork) return json({ error: 'Sin permiso: las actividades públicas solo las borra el admin del club' }, 403);
  await locals.db.prepare('DELETE FROM activities WHERE id = ?').bind(acc.activity.id).run();
  return json({ ok: true });
};
