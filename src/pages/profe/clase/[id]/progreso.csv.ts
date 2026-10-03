import type { APIRoute } from 'astro';
import { classPerm } from '../../../../lib/db';
import { classReport, toCsv } from '../../../../lib/report';

// Class progress as a spreadsheet (needs "view progress" on the class).
export const GET: APIRoute = async ({ locals, params }) => {
  const db = locals.db;
  const classId = Number(params.id);
  const perm = await classPerm(db, locals.coach!.id, classId);
  if (!perm || !(perm.is_owner || perm.can_view_progress)) return new Response('Sin permiso', { status: 403 });
  const cls = await db.prepare('SELECT name FROM classes WHERE id = ?').bind(classId).first<{ name: string }>();
  const { rows, today } = await classReport(db, classId);
  const file = `progreso-${(cls?.name ?? 'clase').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').toLowerCase()}-${today}.csv`;
  return new Response(toCsv(rows), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${file}"`, 'cache-control': 'no-store' },
  });
};
