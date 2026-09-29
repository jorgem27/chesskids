import type { APIRoute } from 'astro';
import { json, readJson } from '../../../lib/db';

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const { name } = await readJson<{ name: string }>(request);
  const n = String(name ?? '').trim();
  if (!n) return json({ error: 'Pon un nombre al club' }, 400);
  const slug = n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
  const club = await db.prepare('INSERT INTO clubs (name, slug) VALUES (?, ?) RETURNING id').bind(n, slug).first<{ id: number }>();
  await db.prepare("INSERT INTO club_coaches (club_id, coach_id, role) VALUES (?, ?, 'admin')").bind(club!.id, locals.coach!.id).run();
  return json({ id: club!.id });
};
