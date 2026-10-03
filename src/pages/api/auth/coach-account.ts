import type { APIRoute } from 'astro';
import { checkCoachPassword, hashSecret, MIN_PASSWORD, SESSION_COOKIE, sha256 } from '../../../lib/auth';
import { json, readJson } from '../../../lib/db';

// The logged-in coach changes their name or password (current password required for the latter).
export const PATCH: APIRoute = async ({ locals, request, cookies }) => {
  const coach = locals.coach;
  if (!coach) return json({ error: 'No autorizado' }, 401);
  const db = locals.db;
  const b = await readJson<{ name?: string; current?: string; password?: string }>(request);
  if (b.password !== undefined) {
    if (typeof b.password !== 'string' || b.password.length < MIN_PASSWORD) return json({ error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres` }, 400);
    const bad = await checkCoachPassword(db, coach.id, b.current);
    if (bad) return json({ error: bad === 'Contraseña incorrecta' ? 'La contraseña actual no es correcta' : bad }, 403);
    // Other devices are logged out (a stolen session must not survive a password change).
    const current = await sha256(cookies.get(SESSION_COOKIE)?.value ?? '');
    await db.batch([
      db.prepare('UPDATE coaches SET password_hash = ? WHERE id = ?').bind(await hashSecret(b.password), coach.id),
      db.prepare("DELETE FROM sessions WHERE user_type = 'coach' AND user_id = ? AND id != ?").bind(coach.id, current),
    ]);
    return json({ ok: true });
  }
  const name = String(b.name ?? '').trim().slice(0, 60);
  if (!name) return json({ error: 'Escribe tu nombre' }, 400);
  await db.prepare('UPDATE coaches SET name = ? WHERE id = ?').bind(name, coach.id).run();
  return json({ ok: true });
};
