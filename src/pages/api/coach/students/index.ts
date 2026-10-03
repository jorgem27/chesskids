import type { APIRoute } from 'astro';
import { hashSecret } from '../../../../lib/auth';
import { AVATARS, makeKidPassword, makeRandomPin, makeToken, makeUsername, type AgeGroup } from '../../../../lib/catalog';
import { classPerm, json, readJson } from '../../../../lib/db';

// Bulk-create students. Returns their credentials ONCE so the coach can print/share them.
export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.db;
  const b = await readJson<{ classId: number; consent?: boolean; students: { name: string; avatar?: string; ageGroup?: AgeGroup }[] }>(request);
  const perm = await classPerm(db, locals.coach!.id, Number(b.classId));
  if (!perm || !(perm.is_owner || perm.can_manage_students)) return json({ error: 'No tienes permiso para gestionar alumnos' }, 403);
  const list = (b.students ?? []).filter((s) => String(s.name ?? '').trim()).slice(0, 40);
  if (!list.length) return json({ error: 'Escribe al menos un nombre' }, 400);
  // GDPR / LOPDGDD art. 7: under-14s need their parents' consent before we store anything.
  if (b.consent !== true) return json({ error: 'Confirma que tienes el consentimiento de sus familias' }, 400);

  const created = [];
  for (const [i, s] of list.entries()) {
    let username = makeUsername(s.name);
    while (await db.prepare('SELECT 1 FROM students WHERE username = ?').bind(username).first()) username = makeUsername(s.name);
    const password = makeKidPassword();
    const pin = makeRandomPin();
    const avatar = s.avatar && (AVATARS as readonly string[]).includes(s.avatar) ? s.avatar : AVATARS[(Date.now() + i) % AVATARS.length];
    const age = ['peque', 'explorador', 'maestro'].includes(s.ageGroup ?? '') ? s.ageGroup : 'explorador';
    const row = await db.prepare(
      `INSERT INTO students (class_id, display_name, avatar, age_group, username, password_hash, pin_hash, login_token, consent_at, consent_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), ?) RETURNING id, login_token`,
    ).bind(Number(b.classId), s.name.trim().slice(0, 30), avatar, age, username,
      await hashSecret(password), await hashSecret(pin), makeToken(), locals.coach!.id).first<{ id: number; login_token: string }>();
    created.push({ id: row!.id, name: s.name.trim(), avatar, username, password, pin, token: row!.login_token });
  }
  return json({ created });
};
