import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json, readJson } from '../../lib/db';
import { validPushEndpoint, vapidFromEnv } from '../../lib/push';

// Opt-in streak reminders for the logged-in student. GET tells the page whether push is set up.
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.student) return json({ error: 'Inicia sesión' }, 401);
  return json({ key: vapidFromEnv(env as Env)?.publicKey ?? null });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const s = locals.student;
  if (!s) return json({ error: 'Inicia sesión' }, 401);
  const { endpoint } = await readJson<{ endpoint: string }>(request);
  if (!validPushEndpoint(endpoint)) return json({ error: 'Suscripción no válida' }, 400);
  const count = await locals.db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE student_id = ? AND endpoint != ?').bind(s.id, endpoint).first<{ n: number }>();
  if ((count?.n ?? 0) >= 5) return json({ error: 'Ya tienes avisos en 5 dispositivos' }, 400);
  // One device = one endpoint; a shared tablet that changes kid moves the subscription to the new one.
  await locals.db.prepare(
    'INSERT INTO push_subscriptions (endpoint, student_id) VALUES (?, ?) ON CONFLICT(endpoint) DO UPDATE SET student_id = excluded.student_id, last_sent_day = NULL',
  ).bind(endpoint, s.id).run();
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ locals, request }) => {
  const s = locals.student;
  if (!s) return json({ error: 'Inicia sesión' }, 401);
  const { endpoint } = await readJson<{ endpoint?: string }>(request);
  if (typeof endpoint === 'string') {
    await locals.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND student_id = ?').bind(endpoint, s.id).run();
  } else {
    await locals.db.prepare('DELETE FROM push_subscriptions WHERE student_id = ?').bind(s.id).run();
  }
  return json({ ok: true });
};
