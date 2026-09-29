import type { APIRoute } from 'astro';
import { createSession, hashSecret } from '../../../lib/auth';
import { json, readJson } from '../../../lib/db';

// Creates a coach and (optionally) a new club where they are admin.
export const POST: APIRoute = async ({ locals, request, cookies, url }) => {
  const db = locals.db;
  const b = await readJson<{ name: string; email: string; password: string; clubName: string }>(request);
  const name = String(b.name ?? '').trim();
  const email = String(b.email ?? '').trim().toLowerCase();
  const clubName = String(b.clubName ?? '').trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Nombre y email válidos, por favor' }, 400);
  if (String(b.password ?? '').length < 8) return json({ error: 'La contraseña necesita al menos 8 caracteres' }, 400);
  if (await db.prepare('SELECT 1 FROM coaches WHERE email = ?').bind(email).first()) return json({ error: 'Ese email ya está registrado' }, 409);

  const coach = await db.prepare('INSERT INTO coaches (email, name, password_hash) VALUES (?, ?, ?) RETURNING id')
    .bind(email, name, await hashSecret(b.password)).first<{ id: number }>();
  if (clubName) {
    const slug = clubName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + coach!.id;
    const club = await db.prepare('INSERT INTO clubs (name, slug) VALUES (?, ?) RETURNING id').bind(clubName, slug).first<{ id: number }>();
    await db.prepare("INSERT INTO club_coaches (club_id, coach_id, role) VALUES (?, ?, 'admin')").bind(club!.id, coach!.id).run();
  }
  await createSession(db, cookies, 'coach', coach!.id, url.protocol === 'https:');
  return json({ ok: true });
};
