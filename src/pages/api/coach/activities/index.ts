import type { APIRoute } from 'astro';
import { checkActivity, clampXp, type ActivityBody } from '../../../../lib/activities';
import { isClubMember, json, readJson } from '../../../../lib/db';

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const b = await readJson<ActivityBody>(request);
  if (!(await isClubMember(db, locals.coach!.id, Number(b.clubId)))) return json({ error: 'No perteneces a ese club' }, 403);
  const errors = checkActivity(b);
  if (errors.length) return json({ error: errors.join(' · '), errors }, 400);
  const row = await db.prepare(
    `INSERT INTO activities (club_id, created_by, type, title, description, content_json, xp_reward) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(Number(b.clubId), locals.coach!.id, b.type, b.title.trim(), String(b.description ?? '').trim(), JSON.stringify(b.content),
    clampXp(b.xpReward, b.type)).first<{ id: number }>();
  return json({ id: row!.id });
};
