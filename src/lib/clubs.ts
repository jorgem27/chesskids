// Club administration: invitations to join a club as a coach, admin checks and club-wide stats.
import { sha256 } from './auth';
import { makeClassCode } from './catalog';

export type ClubRole = 'admin' | 'coach';

export async function isClubAdmin(db: D1Database, coachId: number, clubId: number): Promise<boolean> {
  const r = await db.prepare("SELECT 1 FROM club_coaches WHERE coach_id = ? AND club_id = ? AND role = 'admin'").bind(coachId, clubId).first();
  return !!r;
}

/** "ABCD-EFGH": 8 unambiguous characters (≈40 bits), easy to read aloud or type from WhatsApp. */
export function makeInviteCode(): string {
  return `${makeClassCode().slice(0, 4)}-${makeClassCode().slice(0, 4)}`;
}

/** Normalizes what a person typed ("abcd efgh", "ABCD-EFGH") to the stored form. */
export function normalizeInvite(code: string): string {
  const c = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : '';
}

export const INVITE_MAX_DAYS = 30;
export const INVITE_MAX_USES = 50;

export async function createInvite(
  db: D1Database, clubId: number, createdBy: number, opts: { role: ClubRole; note: string; maxUses: number; days: number },
): Promise<string> {
  const code = makeInviteCode();
  const days = Math.max(1, Math.min(INVITE_MAX_DAYS, Math.round(opts.days) || 7));
  const uses = Math.max(1, Math.min(INVITE_MAX_USES, Math.round(opts.maxUses) || 1));
  await db.prepare(
    'INSERT INTO club_invites (club_id, code_hash, role, note, max_uses, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(clubId, await sha256(code), opts.role === 'admin' ? 'admin' : 'coach', opts.note.slice(0, 60), uses,
    Math.floor(Date.now() / 1000) + days * 86400, createdBy).run();
  return code;
}

/** Looks an invite up without using it (to show the club name on the sign-up form). */
export async function peekInvite(db: D1Database, code: string) {
  const norm = normalizeInvite(code);
  if (!norm) return null;
  return db.prepare(
    `SELECT i.club_id, i.role, c.name AS club_name FROM club_invites i JOIN clubs c ON c.id = i.club_id
     WHERE i.code_hash = ? AND i.revoked = 0 AND i.uses < i.max_uses AND i.expires_at > unixepoch()`,
  ).bind(await sha256(norm)).first<{ club_id: number; role: ClubRole; club_name: string }>();
}

/** Uses one seat of an invite atomically. Returns the club and role, or null if it's not valid. */
export async function redeemInvite(db: D1Database, code: string) {
  const norm = normalizeInvite(code);
  if (!norm) return null;
  return db.prepare(
    `UPDATE club_invites SET uses = uses + 1
     WHERE code_hash = ? AND revoked = 0 AND uses < max_uses AND expires_at > unixepoch() RETURNING club_id, role`,
  ).bind(await sha256(norm)).first<{ club_id: number; role: ClubRole }>();
}

/** Constant-time comparison for the platform sign-up code. */
export function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function clubSlug(name: string, suffix: string | number): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + suffix;
}

/**
 * A club admin may create a password reset link for a coach only when that coach is not an admin
 * anywhere and belongs to no
 * club where the admin isn't also admin (so an admin of club A can't take over an account that
 * also has access to club B's children).
 */
export async function canResetCoach(db: D1Database, adminId: number, coachId: number): Promise<boolean> {
  if (adminId === coachId) return false;
  // Never another admin (anywhere): an admin could otherwise take over a peer or the founder.
  if (await db.prepare("SELECT 1 FROM club_coaches WHERE coach_id = ? AND role = 'admin'").bind(coachId).first()) return false;
  const r = await db.prepare(
    `SELECT COUNT(*) AS n, SUM(CASE WHEN EXISTS (SELECT 1 FROM club_coaches a WHERE a.club_id = cc.club_id AND a.coach_id = ? AND a.role = 'admin') THEN 1 ELSE 0 END) AS ok
     FROM club_coaches cc WHERE cc.coach_id = ?`,
  ).bind(adminId, coachId).first<{ n: number; ok: number }>();
  return !!r && r.n > 0 && r.n === r.ok;
}
