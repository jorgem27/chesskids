import type { APIRoute } from 'astro';
import { clearFailures, createSession, isLocked, recordFailure, verifySecret } from '../../../lib/auth';
import { json, readJson } from '../../../lib/db';

// Class code + avatar + emoji PIN login.
export const POST: APIRoute = async ({ locals, request, cookies, url }) => {
  const db = locals.db;
  const { code, studentId, pin } = await readJson<{ code: string; studentId: number; pin: string }>(request);
  const st = await db.prepare(
    `SELECT s.id, s.pin_hash FROM students s JOIN classes c ON c.id = s.class_id
     WHERE s.id = ? AND c.code = ? AND s.archived = 0`,
  ).bind(Number(studentId), String(code ?? '').toUpperCase()).first<{ id: number; pin_hash: string }>();
  if (!st) return json({ error: 'No encontramos a ese alumno' }, 404);
  const key = `pin:${st.id}`;
  if (await isLocked(db, key)) return json({ error: 'Demasiados intentos. Espera 10 minutos o pide ayuda a tu profe.', locked: true }, 429);
  if (!(await verifySecret(String(pin ?? ''), st.pin_hash))) {
    await recordFailure(db, key);
    return json({ error: '¡Uy! Esa no es tu contraseña secreta' }, 401);
  }
  await clearFailures(db, key);
  await createSession(db, cookies, 'student', st.id, url.protocol === 'https:');
  return json({ ok: true });
};
