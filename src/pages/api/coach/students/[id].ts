import type { APIRoute } from 'astro';
import { checkCoachPassword, hashSecret } from '../../../../lib/auth';
import { AVATARS, makeKidPassword, makeRandomPin, makeToken, PIN_EMOJIS, splitPin } from '../../../../lib/catalog';
import { classPerm, json, readJson } from '../../../../lib/db';

async function load(locals: App.Locals, id: number) {
  const st = await locals.db.prepare('SELECT id, class_id FROM students WHERE id = ?').bind(id).first<{ id: number; class_id: number }>();
  if (!st) return null;
  const perm = await classPerm(locals.db, locals.coach!.id, st.class_id);
  if (!perm || !(perm.is_owner || perm.can_manage_students)) return null;
  return st;
}

// Actions: update | reset-password | reset-pin | new-link
export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db;
  const st = await load(locals, Number(params.id));
  if (!st) return json({ error: 'Sin permiso' }, 403);
  const b = await readJson<{ action: string; name?: string; avatar?: string; ageGroup?: string; pin?: string }>(request);

  switch (b.action) {
    case 'update': {
      const avatar = b.avatar && (AVATARS as readonly string[]).includes(b.avatar) ? b.avatar : null;
      const age = ['peque', 'explorador', 'maestro'].includes(b.ageGroup ?? '') ? b.ageGroup : null;
      await db.prepare(`UPDATE students SET display_name = COALESCE(?, display_name), avatar = COALESCE(?, avatar), age_group = COALESCE(?, age_group) WHERE id = ?`)
        .bind(b.name?.trim().slice(0, 30) || null, avatar, age, st.id).run();
      return json({ ok: true });
    }
    case 'reset-password': {
      const password = makeKidPassword();
      await db.prepare('UPDATE students SET password_hash = ? WHERE id = ?').bind(await hashSecret(password), st.id).run();
      return json({ password });
    }
    case 'reset-pin': {
      const chosen = b.pin && splitPin(b.pin).length === 3 ? splitPin(b.pin).join('') : makeRandomPin();
      if (!splitPin(chosen).every((e) => (PIN_EMOJIS as readonly string[]).includes(e))) return json({ error: 'PIN no válido' }, 400);
      await db.prepare('UPDATE students SET pin_hash = ? WHERE id = ?').bind(await hashSecret(chosen), st.id).run();
      return json({ pin: chosen });
    }
    case 'new-link': {
      // Revokes the old personal link AND logs out every device of this student.
      const token = makeToken();
      await db.batch([
        db.prepare('UPDATE students SET login_token = ? WHERE id = ?').bind(token, st.id),
        db.prepare("DELETE FROM sessions WHERE user_type = 'student' AND user_id = ?").bind(st.id),
      ]);
      return json({ token });
    }
  }
  return json({ error: 'Acción desconocida' }, 400);
};

// Permanently deletes the student and their progress (password required).
export const DELETE: APIRoute = async ({ locals, params, request }) => {
  const st = await load(locals, Number(params.id));
  if (!st) return json({ error: 'Sin permiso' }, 403);
  const b = await readJson<{ password: string }>(request).catch(() => ({ password: '' }));
  const bad = await checkCoachPassword(locals.db, locals.coach!.id, b.password);
  if (bad) return json({ error: bad }, 403);
  await locals.db.batch([
    locals.db.prepare("DELETE FROM sessions WHERE user_type = 'student' AND user_id = ?").bind(st.id),
    locals.db.prepare('DELETE FROM attempts WHERE student_id = ?').bind(st.id),
    locals.db.prepare('DELETE FROM student_stickers WHERE student_id = ?').bind(st.id),
    locals.db.prepare('DELETE FROM projector_results WHERE student_id = ?').bind(st.id),
    locals.db.prepare('DELETE FROM students WHERE id = ?').bind(st.id),
  ]);
  return json({ ok: true });
};
