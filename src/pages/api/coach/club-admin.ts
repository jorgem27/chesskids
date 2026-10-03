import type { APIRoute } from 'astro';
import { createPasswordReset, RESET_TTL_ADMIN } from '../../../lib/auth';
import { canResetCoach, createInvite, isClubAdmin } from '../../../lib/clubs';
import { json, readJson } from '../../../lib/db';
import { importStarterPack } from '../../../lib/starter';

interface Body {
  action: 'invite' | 'revoke-invite' | 'role' | 'remove-coach' | 'reset-link' | 'rename' | 'starter';
  clubId: number; coachId?: number; inviteId?: number; classId?: number;
  role?: string; note?: string; maxUses?: number | string; days?: number | string; name?: string;
}

// Club administration. Every action requires the caller to be an admin of `clubId`, and every
// target (coach, class, invite) is checked to belong to that club.
export const POST: APIRoute = async ({ locals, request, url }) => {
  const db = locals.db;
  const me = locals.coach!.id;
  const b = await readJson<Body>(request);
  const clubId = Number(b.clubId);
  if (!clubId || !(await isClubAdmin(db, me, clubId))) return json({ error: 'Solo los administradores del club pueden hacer esto' }, 403);
  const member = async (coachId: number) =>
    db.prepare('SELECT role FROM club_coaches WHERE club_id = ? AND coach_id = ?').bind(clubId, coachId).first<{ role: string }>();

  switch (b.action) {
    case 'invite': {
      const role = b.role === 'admin' ? 'admin' : 'coach';
      const code = await createInvite(db, clubId, me, { role, note: String(b.note ?? '').trim(), maxUses: Number(b.maxUses) || 1, days: Number(b.days) || 7 });
      return json({ code, link: `${url.origin}/profe/registro?invitacion=${code}` });
    }
    case 'revoke-invite': {
      await db.prepare('UPDATE club_invites SET revoked = 1 WHERE id = ? AND club_id = ?').bind(Number(b.inviteId), clubId).run();
      return json({ ok: true });
    }
    case 'role': {
      const coachId = Number(b.coachId);
      const role = b.role === 'admin' ? 'admin' : 'coach';
      if (!(await member(coachId))) return json({ error: 'Ese profe no es del club' }, 404);
      if (role === 'coach') {
        const admins = await db.prepare("SELECT COUNT(*) AS n FROM club_coaches WHERE club_id = ? AND role = 'admin'").bind(clubId).first<{ n: number }>();
        if ((admins?.n ?? 0) <= 1) return json({ error: 'El club necesita al menos un administrador' }, 400);
      }
      await db.prepare('UPDATE club_coaches SET role = ? WHERE club_id = ? AND coach_id = ?').bind(role, clubId, coachId).run();
      return json({ ok: true });
    }
    case 'remove-coach': {
      // Their classes in this club pass to the admin who removes them; they lose every permission here.
      const coachId = Number(b.coachId);
      if (coachId === me) return json({ error: 'No puedes quitarte a ti mismo' }, 400);
      if (!(await member(coachId))) return json({ error: 'Ese profe no es del club' }, 404);
      const inClub = 'class_id IN (SELECT id FROM classes WHERE club_id = ?)';
      await db.batch([
        db.prepare(`INSERT INTO class_permissions (class_id, coach_id, is_owner, can_view_progress, can_create_content, can_manage_students)
          SELECT class_id, ?, 1, 1, 1, 1 FROM class_permissions WHERE coach_id = ? AND is_owner = 1 AND ${inClub}
          ON CONFLICT(class_id, coach_id) DO UPDATE SET is_owner = 1, can_view_progress = 1, can_create_content = 1, can_manage_students = 1`).bind(me, coachId, clubId),
        db.prepare(`DELETE FROM class_permissions WHERE coach_id = ? AND ${inClub}`).bind(coachId, clubId),
        db.prepare("UPDATE activities SET visibility = 'public' WHERE club_id = ? AND created_by = ? AND visibility = 'private'").bind(clubId, coachId),
        db.prepare('DELETE FROM club_coaches WHERE club_id = ? AND coach_id = ?').bind(clubId, coachId),
      ]);
      return json({ ok: true });
    }
    case 'reset-link': {
      const coachId = Number(b.coachId);
      if (!(await member(coachId))) return json({ error: 'Ese profe no es del club' }, 404);
      if (!(await canResetCoach(db, me, coachId))) {
        return json({ error: 'No puedes crear este enlace (es administrador, está en otro club o es tu cuenta). Tiene que pedirlo por email desde «¿Olvidaste tu contraseña?»' }, 403);
      }
      const token = await createPasswordReset(db, coachId, me, RESET_TTL_ADMIN);
      return json({ link: `${url.origin}/profe/restablecer#t=${token}` });
    }
    case 'rename': {
      const name = String(b.name ?? '').trim().slice(0, 60);
      if (!name) return json({ error: 'Pon un nombre al club' }, 400);
      await db.prepare('UPDATE clubs SET name = ? WHERE id = ?').bind(name, clubId).run();
      return json({ ok: true });
    }
    case 'starter': {
      const done = await importStarterPack(db, clubId, me);
      return done ? json({ ok: true }) : json({ error: 'Este club ya tiene el contenido inicial' }, 409);
    }
    default:
      return json({ error: 'Acción desconocida' }, 400);
  }
};
