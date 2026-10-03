import type { APIRoute } from 'astro';
import { consumePasswordReset, createSession, MIN_PASSWORD } from '../../../lib/auth';
import { json, readJson } from '../../../lib/db';

// Sets a new coach password from a one-time reset link and logs the coach in on this device.
export const POST: APIRoute = async ({ locals, request, cookies, url }) => {
  const { token, password } = await readJson<{ token: string; password: string }>(request);
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) return json({ error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres` }, 400);
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,80}$/.test(token)) return json({ error: 'El enlace no es válido' }, 400);
  const coachId = await consumePasswordReset(locals.db, token, password);
  if (!coachId) return json({ error: 'El enlace ha caducado o ya se ha usado. Pide uno nuevo.' }, 400);
  await createSession(locals.db, cookies, 'coach', coachId, url.protocol === 'https:');
  return json({ ok: true });
};
