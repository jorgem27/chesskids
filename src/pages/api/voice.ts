import type { APIRoute } from 'astro';
import { json, readJson } from '../../lib/db';
import { VOICE_PREFS } from '../../lib/voice/coaches';

/** The logged-in student picks Potróculo's voice for their activities. */
export const POST: APIRoute = async ({ request, locals }) => {
  const s = locals.student;
  if (!s) return json({ error: 'Inicia sesión' }, 401);
  const body = await readJson<{ voice?: unknown }>(request);
  const voice = typeof body.voice === 'string' ? body.voice : '';
  if (!VOICE_PREFS.includes(voice)) return json({ error: 'Esa voz no existe' }, 400);
  if (s.voice !== voice) await locals.db.prepare('UPDATE students SET voice = ? WHERE id = ?').bind(voice, s.id).run();
  return json({ ok: true });
};
