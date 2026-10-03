import type { APIRoute } from 'astro';
import { clubSlug } from '../../../lib/clubs';
import { json, readJson } from '../../../lib/db';
import { importStarterPack } from '../../../lib/starter';

// A logged-in coach creates another club (they become its admin). It starts with the starter pack.
export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const { name } = await readJson<{ name: string }>(request);
  const n = String(name ?? '').trim().slice(0, 60);
  if (!n) return json({ error: 'Pon un nombre al club' }, 400);
  // Registration is closed, so creating clubs is limited to people who already run one (max 5).
  const mine = await db.prepare("SELECT COUNT(*) AS n, SUM(role = 'admin') AS admin FROM club_coaches WHERE coach_id = ?").bind(locals.coach!.id).first<{ n: number; admin: number }>();
  if (!mine?.admin) return json({ error: 'Solo quien administra un club puede crear otro' }, 403);
  if (mine.n >= 5) return json({ error: 'Has llegado al máximo de clubs' }, 400);
  const club = await db.prepare('INSERT INTO clubs (name, slug) VALUES (?, ?) RETURNING id').bind(n, clubSlug(n, Date.now().toString(36))).first<{ id: number }>();
  await db.prepare("INSERT INTO club_coaches (club_id, coach_id, role) VALUES (?, ?, 'admin')").bind(club!.id, locals.coach!.id).run();
  await importStarterPack(db, club!.id, locals.coach!.id);
  return json({ id: club!.id });
};
