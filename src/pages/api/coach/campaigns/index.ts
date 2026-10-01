import type { APIRoute } from 'astro';
import { campaignMeta, type CampaignMetaBody } from '../../../../lib/campaigns';
import { isClubMember, json, readJson } from '../../../../lib/db';

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const b = await readJson<CampaignMetaBody & { clubId: number }>(request);
  if (!(await isClubMember(db, locals.coach!.id, Number(b.clubId)))) return json({ error: 'No perteneces a ese club' }, 403);
  const m = campaignMeta(b);
  if ('error' in m) return json({ error: m.error }, 400);
  const row = await db.prepare(
    'INSERT INTO campaigns (club_id, created_by, title, description, reward_type, theme, emoji) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
  ).bind(Number(b.clubId), locals.coach!.id, m.title, m.description, m.reward, m.theme, m.emoji).first<{ id: number }>();
  return json({ id: row!.id });
};
