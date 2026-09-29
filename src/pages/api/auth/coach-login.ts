import type { APIRoute } from 'astro';
import { clearFailures, createSession, isLocked, recordFailure, verifySecret } from '../../../lib/auth';
import { json, readJson } from '../../../lib/db';

export const POST: APIRoute = async ({ locals, request, cookies, url }) => {
  const db = locals.db;
  const { email, password } = await readJson<{ email: string; password: string }>(request);
  const key = `coach:${String(email ?? '').toLowerCase()}`;
  if (await isLocked(db, key)) return json({ error: 'Demasiados intentos. Espera 10 minutos.' }, 429);
  const c = await db.prepare('SELECT id, password_hash FROM coaches WHERE email = ?').bind(String(email ?? '').trim())
    .first<{ id: number; password_hash: string }>();
  if (!c || !(await verifySecret(String(password ?? ''), c.password_hash))) {
    await recordFailure(db, key);
    return json({ error: 'Email o contraseña incorrectos' }, 401);
  }
  await clearFailures(db, key);
  await createSession(db, cookies, 'coach', c.id, url.protocol === 'https:');
  return json({ ok: true });
};
