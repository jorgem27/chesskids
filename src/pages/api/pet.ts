import type { APIRoute } from 'astro';
import { readJson, json } from '../../lib/db';
import { studentUnlocks, unlockedPetItems } from '../../lib/campaigns';
import { getUnlockedItems, sanitizePet } from '../../lib/pets';

export const POST: APIRoute = async ({ request, locals }) => {
  const s = locals.student;
  const db = locals.db;
  if (!s) return json({ error: 'Inicia sesión' }, 401);

  const body = await readJson<{ base_pet: string; equipped: Record<string, string> }>(request);
  const unlocked = getUnlockedItems(s.xp, unlockedPetItems(await studentUnlocks(db, s.id)));
  const pet = sanitizePet(body.base_pet, body.equipped, unlocked);
  if (!pet) return json({ error: 'Faltan datos' }, 400);

  await db.prepare(
    `INSERT INTO student_pets (student_id, base_pet, equipped_json)
     VALUES (?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET
       base_pet = excluded.base_pet,
       equipped_json = excluded.equipped_json`
  ).bind(s.id, pet.base, JSON.stringify(pet.equipped)).run();

  return json({ success: true });
};
