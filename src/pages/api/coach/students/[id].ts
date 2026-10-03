import type { APIRoute } from 'astro';
import { checkCoachPassword, hashSecret } from '../../../../lib/auth';
import { AVATARS, makeKidPassword, makeRandomPin, makeToken, PIN_EMOJIS, splitPin } from '../../../../lib/catalog';
import { classPerm, json, readJson, type StudentRow } from '../../../../lib/db';
import { familyMessage, weekSummary } from '../../../../lib/family';
import { eraseStudentsStatements, exportStudent } from '../../../../lib/privacy';

async function load(locals: App.Locals, id: number) {
  const st = await locals.db.prepare('SELECT id, class_id FROM students WHERE id = ?').bind(id).first<{ id: number; class_id: number }>();
  if (!st) return null;
  const perm = await classPerm(locals.db, locals.coach!.id, st.class_id);
  if (!perm || !(perm.is_owner || perm.can_manage_students)) return null;
  return st;
}

// Right of access / portability: download everything stored about the student as JSON.
export const GET: APIRoute = async ({ locals, params }) => {
  const st = await load(locals, Number(params.id));
  if (!st) return json({ error: 'Sin permiso' }, 403);
  const data = await exportStudent(locals.db, st.id);
  const name = String(data.student?.username ?? st.id).replace(/[^a-z0-9.]+/gi, '_');
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="datos-${name}.json"`,
      'cache-control': 'no-store',
    },
  });
};

// Actions: update | reset-password | reset-pin | new-link | consent | family-link | family-revoke
export const PATCH: APIRoute = async ({ locals, params, request, url }) => {
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
    case 'consent': {
      // The coach confirms they hold the parents' consent (students created before it was required).
      await db.prepare('UPDATE students SET consent_at = unixepoch(), consent_by = ? WHERE id = ?').bind(locals.coach!.id, st.id).run();
      return json({ ok: true });
    }
    case 'family-link': {
      // Creates the read-only family link if needed and returns this week's WhatsApp summary.
      let row = await db.prepare('SELECT * FROM students WHERE id = ?').bind(st.id).first<StudentRow>();
      if (!row) return json({ error: 'Alumno no encontrado' }, 404);
      if (!row.family_token) {
        const token = makeToken();
        await db.prepare('UPDATE students SET family_token = ? WHERE id = ?').bind(token, st.id).run();
        row = { ...row, family_token: token };
      }
      const link = `${url.origin}/familia/${row.family_token}`;
      return json({ link, message: familyMessage(row.display_name, await weekSummary(db, row), link) });
    }
    case 'family-revoke': {
      await db.prepare('UPDATE students SET family_token = NULL WHERE id = ?').bind(st.id).run();
      return json({ ok: true });
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
  // Right to erasure: the account and every row about the student.
  await locals.db.batch(eraseStudentsStatements(locals.db, 'id = ?', st.id));
  return json({ ok: true });
};
