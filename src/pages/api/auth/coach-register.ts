import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createSession, hashSecret, isLocked, MIN_PASSWORD, recordFailure, sha256 } from '../../../lib/auth';
import { clubSlug, normalizeInvite, peekInvite, redeemInvite, sameSecret } from '../../../lib/clubs';
import { json, readJson } from '../../../lib/db';
import { importStarterPack } from '../../../lib/starter';

// Registration is closed: a coach joins with an invitation from a club admin, or creates a new club
// with the platform sign-up code (SIGNUP_CODE secret). The very first account of an empty install
// needs neither, so a fresh deployment can be bootstrapped.
export const POST: APIRoute = async ({ locals, request, cookies, url, clientAddress }) => {
  const db = locals.db;
  const b = await readJson<{ name: string; email: string; password: string; invite?: string; signupCode?: string; clubName?: string }>(request);
  const name = String(b.name ?? '').trim().slice(0, 60);
  const email = String(b.email ?? '').trim().toLowerCase();
  const clubName = String(b.clubName ?? '').trim().slice(0, 60);
  const invite = String(b.invite ?? '').trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || email.length > 120) return json({ error: 'Nombre y email válidos, por favor' }, 400);
  if (typeof b.password !== 'string' || b.password.length < MIN_PASSWORD) return json({ error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres` }, 400);

  // Guessing invite / sign-up codes shares the login lockout (per IP).
  const key = `register:${clientAddress ?? ''}`;
  if (await isLocked(db, key)) return json({ error: 'Demasiados intentos. Espera 10 minutos.' }, 429);
  const emailTaken = async () => !!(await db.prepare('SELECT 1 FROM coaches WHERE email = ?').bind(email).first());
  const taken = { error: 'Ese email ya está registrado. ¿Has olvidado tu contraseña?' };

  // The invite / sign-up code is checked BEFORE saying whether the email exists (no enumeration).
  let join: { club_id: number; role: string } | null = null;
  if (invite) {
    if (!(await peekInvite(db, invite))) {
      await recordFailure(db, key);
      return json({ error: 'La invitación no es válida o ha caducado. Pide una nueva a tu club.' }, 403);
    }
    if (await emailTaken()) return json(taken, 409);
    join = await redeemInvite(db, invite);
    if (!join) return json({ error: 'La invitación ya se ha usado. Pide una nueva a tu club.' }, 403);
  } else {
    const platform = String((env as Env).SIGNUP_CODE ?? '');
    const bootstrap = !(await db.prepare('SELECT 1 FROM coaches LIMIT 1').first());
    if (!bootstrap && !sameSecret(String(b.signupCode ?? '').trim(), platform)) {
      await recordFailure(db, key);
      return json({ error: 'Para crear una cuenta necesitas una invitación de tu club.' }, 403);
    }
    if (!clubName) return json({ error: 'Pon el nombre de tu club' }, 400);
    if (await emailTaken()) return json(taken, 409);
  }

  let coach: { id: number } | null = null;
  try {
    coach = await db.prepare('INSERT INTO coaches (email, name, password_hash) VALUES (?, ?, ?) RETURNING id')
      .bind(email, name, await hashSecret(b.password)).first<{ id: number }>();
  } catch {
    // Same email registered at the same moment: give the invitation seat back.
    if (join) await db.prepare('UPDATE club_invites SET uses = uses - 1 WHERE code_hash = ? AND uses > 0').bind(await sha256(normalizeInvite(invite))).run();
    return json(taken, 409);
  }
  if (join) {
    await db.prepare('INSERT OR IGNORE INTO club_coaches (club_id, coach_id, role) VALUES (?, ?, ?)').bind(join.club_id, coach!.id, join.role).run();
  } else {
    const club = await db.prepare('INSERT INTO clubs (name, slug) VALUES (?, ?) RETURNING id').bind(clubName, clubSlug(clubName, coach!.id)).first<{ id: number }>();
    await db.prepare("INSERT INTO club_coaches (club_id, coach_id, role) VALUES (?, ?, 'admin')").bind(club!.id, coach!.id).run();
    await importStarterPack(db, club!.id, coach!.id);
  }
  await createSession(db, cookies, 'coach', coach!.id, url.protocol === 'https:');
  return json({ ok: true });
};
