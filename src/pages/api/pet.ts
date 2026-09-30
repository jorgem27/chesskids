import type { APIRoute } from 'astro';
import { readJson, json } from '../../lib/db';

export const POST: APIRoute = async ({ request, locals }) => {
  const s = locals.student;
  const db = locals.db;
  if (!s) return json({ error: 'Inicia sesión' }, 401);

  const body = await readJson<{ base_pet: string; equipped: Record<string, string> }>(request);
  if (!body.base_pet) return json({ error: 'Faltan datos' }, 400);

  await db.prepare(
    `INSERT INTO student_pets (student_id, base_pet, equipped_json)
     VALUES (?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET
       base_pet = excluded.base_pet,
       equipped_json = excluded.equipped_json`
  ).bind(s.id, body.base_pet, JSON.stringify(body.equipped || {})).run();

  return json({ success: true });
};
