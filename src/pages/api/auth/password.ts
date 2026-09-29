import type { APIRoute } from 'astro';
import { clearFailures, createSession, isLocked, recordFailure, verifySecret } from '../../../lib/auth';
import { json, readJson } from '../../../lib/db';

// Username + password login (new devices, older kids).
export const POST: APIRoute = async ({ locals, request, cookies, url }) => {
  const db = locals.db;
  const { username, password } = await readJson<{ username: string; password: string }>(request);
  const name = String(username ?? '').trim().toLowerCase();
  const key = `user:${name}`;
  if (await isLocked(db, key)) return json({ error: 'Demasiados intentos. Espera 10 minutos.' }, 429);
  const st = await db.prepare('SELECT id, password_hash FROM students WHERE username = ? AND archived = 0')
    .bind(name).first<{ id: number; password_hash: string }>();
  if (!st || !(await verifySecret(String(password ?? '').trim().toLowerCase(), st.password_hash))) {
    await recordFailure(db, key);
    return json({ error: 'Usuario o contraseña incorrectos' }, 401);
  }
  await clearFailures(db, key);
  await createSession(db, cookies, 'student', st.id, url.protocol === 'https:');
  return json({ ok: true });
};
