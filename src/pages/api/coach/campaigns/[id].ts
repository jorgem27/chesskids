import type { APIRoute } from 'astro';
import { campaignMeta, coachCampaign, MAX_CAMPAIGN_NODES, type CampaignMetaBody } from '../../../../lib/campaigns';
import { classPerm, json, readJson } from '../../../../lib/db';

interface Body extends CampaignMetaBody {
  /** Full ordered list of levels. Existing nodes keep their id (and the students' progress). */
  nodes?: { id?: number; activityId: number }[];
}

/** Edit a campaign: fields + ordered levels (creator or club admin). */
export const PUT: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db;
  const coach = locals.coach!;
  const acc = await coachCampaign(db, coach.id, Number(params.id));
  if (!acc) return json({ error: 'Campaña no encontrada' }, 404);
  if (!acc.canEdit) return json({ error: 'Solo quien creó la campaña (o el admin del club) puede cambiarla' }, 403);
  const c = acc.campaign;
  const b = await readJson<Body>(request);
  const m = campaignMeta(b);
  if ('error' in m) return json({ error: m.error }, 400);

  const wanted = Array.isArray(b.nodes) ? b.nodes.slice(0, MAX_CAMPAIGN_NODES + 1) : [];
  if (wanted.length > MAX_CAMPAIGN_NODES) return json({ error: `Una campaña puede tener como mucho ${MAX_CAMPAIGN_NODES} niveles` }, 400);

  const { results: existing } = await db.prepare('SELECT id, activity_id FROM campaign_nodes WHERE campaign_id = ?')
    .bind(c.id).all<{ id: number; activity_id: number }>();
  const existingIds = new Set(existing.map((n) => n.id));

  // New levels must use activities this coach can see in the campaign's club.
  const newActivityIds = [...new Set(wanted.filter((n) => !existingIds.has(Number(n.id))).map((n) => Number(n.activityId)).filter(Boolean))];
  let allowed = new Set<number>();
  if (newActivityIds.length) {
    const { results } = await db.prepare(
      `SELECT id FROM activities a WHERE a.club_id = ? AND (a.visibility = 'public' OR a.created_by = ?) AND a.id IN (${newActivityIds.map(() => '?').join(',')})`,
    ).bind(c.club_id, coach.id, ...newActivityIds).all<{ id: number }>();
    allowed = new Set(results.map((r) => r.id));
  }

  const keep = new Set<number>();
  const stmts: D1PreparedStatement[] = [
    db.prepare('UPDATE campaigns SET title = ?, description = ?, reward_type = ?, theme = ?, emoji = ? WHERE id = ?')
      .bind(m.title, m.description, m.reward, m.theme, m.emoji, c.id),
  ];
  wanted.forEach((n, position) => {
    const id = Number(n.id);
    if (existingIds.has(id) && !keep.has(id)) {
      keep.add(id);
      stmts.push(db.prepare('UPDATE campaign_nodes SET position = ? WHERE id = ? AND campaign_id = ?').bind(position, id, c.id));
    } else if (allowed.has(Number(n.activityId))) {
      stmts.push(db.prepare('INSERT INTO campaign_nodes (campaign_id, activity_id, position) VALUES (?, ?, ?)').bind(c.id, Number(n.activityId), position));
    }
  });
  const removed = existing.filter((n) => !keep.has(n.id)).map((n) => n.id);
  if (removed.length) {
    stmts.push(db.prepare(`DELETE FROM campaign_nodes WHERE campaign_id = ? AND id IN (${removed.map(() => '?').join(',')})`).bind(c.id, ...removed));
  }
  await db.batch(stmts);
  return json({ ok: true });
};

/** Delete a campaign and its progress (creator or club admin). */
export const DELETE: APIRoute = async ({ locals, params }) => {
  const acc = await coachCampaign(locals.db, locals.coach!.id, Number(params.id));
  if (!acc) return json({ error: 'Campaña no encontrada' }, 404);
  if (!acc.canEdit) return json({ error: 'Solo quien creó la campaña (o el admin del club) puede borrarla' }, 403);
  await locals.db.prepare('DELETE FROM campaigns WHERE id = ?').bind(acc.campaign.id).run();
  return json({ ok: true });
};

/** Assign (assign: true) or remove (false) the campaign for one class. */
export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db;
  const coach = locals.coach!;
  const acc = await coachCampaign(db, coach.id, Number(params.id));
  if (!acc) return json({ error: 'Campaña no encontrada' }, 404);
  const b = await readJson<{ classId: number; assign: boolean }>(request);
  const classId = Number(b.classId);
  const [perm, cls] = await Promise.all([
    classPerm(db, coach.id, classId),
    db.prepare('SELECT club_id FROM classes WHERE id = ?').bind(classId).first<{ club_id: number }>(),
  ]);
  if (!perm || !(perm.is_owner || perm.can_create_content) || cls?.club_id !== acc.campaign.club_id) {
    return json({ error: 'No puedes poner campañas en esa clase' }, 403);
  }
  if (b.assign) {
    await db.prepare('INSERT OR IGNORE INTO class_campaigns (class_id, campaign_id, assigned_by) VALUES (?, ?, ?)').bind(classId, acc.campaign.id, coach.id).run();
  } else {
    await db.prepare('DELETE FROM class_campaigns WHERE class_id = ? AND campaign_id = ?').bind(classId, acc.campaign.id).run();
  }
  return json({ ok: true });
};
