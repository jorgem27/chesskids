// Campaigns ("mapas de aventura"): an ordered path of activities. A node unlocks when the one
// before it is passed (at least 1 star); finishing every node grants the campaign reward.
// Pure helpers first (tested in tests/campaigns.test.ts), then the D1 queries.
import { isClubMember } from './db';

export interface CampaignRow {
  id: number;
  club_id: number;
  created_by: number | null;
  title: string;
  description: string;
  reward_type: string;
  theme: string;
  emoji: string;
  created_at: number;
}

export interface CampaignNodeRow {
  id: number;
  campaign_id: number;
  activity_id: number;
  position: number;
  created_at: number;
}

export type CampaignNode = CampaignNodeRow & { activity_title: string; activity_type: string };

// ---------- Rewards ----------

export interface CampaignReward {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Pet item (src/lib/pets.ts) unlocked regardless of XP. */
  petItem?: string;
  /** Special sticker added to the album. */
  sticker?: string;
  /** Title shown under the student's name. */
  title?: string;
  /** Board background while playing. */
  board?: 'space';
}

export const CAMPAIGN_REWARDS: CampaignReward[] = [
  { id: 'pet_flip', name: 'Mascota: Voltereta', emoji: '🤸', description: '¡Tu mascota aprende a dar volteretas!', petItem: 'salto' },
  { id: 'sticker_dragon', name: 'Cromo: Dragón Dorado', emoji: '🐲', description: 'Un cromo exclusivo para tu álbum.', sticker: 'dragon-dorado' },
  { id: 'theme_space', name: 'Fondo espacial', emoji: '🌌', description: 'Juega con un fondo de estrellas.', board: 'space' },
  { id: 'pet_sunglasses', name: 'Mascota: Gafas de sol', emoji: '🕶️', description: 'Tu mascota se verá genial.', petItem: 'gafas_sol' },
  { id: 'title_master', name: 'Título: Maestro Táctico', emoji: '👑', description: 'Un título de leyenda bajo tu nombre.', title: 'Maestro Táctico' },
];

export function rewardById(id: string | null | undefined): CampaignReward {
  return CAMPAIGN_REWARDS.find((r) => r.id === id) ?? CAMPAIGN_REWARDS[0];
}

// ---------- Map themes ----------

export interface CampaignTheme {
  id: string;
  name: string;
  emoji: string;
  /** CSS background of the map. */
  bg: string;
  /** Dotted path color. */
  path: string;
  /** Scenery scattered around the path. */
  deco: string[];
  /** Big landmark at the end of the path, next to the reward. */
  goal: string;
}

export const CAMPAIGN_THEMES: CampaignTheme[] = [
  { id: 'bosque', name: 'Bosque', emoji: '🌲', bg: 'linear-gradient(180deg,#bbf7d0 0%,#86efac 55%,#4ade80 100%)', path: '#fef9c3', deco: ['🌲', '🌳', '🍄', '🌼', '🐿️', '🦔'], goal: '🏰' },
  { id: 'playa', name: 'Playa', emoji: '🏝️', bg: 'linear-gradient(180deg,#bae6fd 0%,#7dd3fc 45%,#fde68a 100%)', path: '#ffffff', deco: ['🌴', '🐚', '🦀', '⛱️', '🐠', '🌊'], goal: '🏝️' },
  { id: 'desierto', name: 'Desierto', emoji: '🐪', bg: 'linear-gradient(180deg,#fef3c7 0%,#fde68a 50%,#fbbf24 100%)', path: '#fffbeb', deco: ['🌵', '🐪', '🦂', '🏜️', '🪨', '☀️'], goal: '🛕' },
  { id: 'nieve', name: 'Montaña nevada', emoji: '🏔️', bg: 'linear-gradient(180deg,#e0f2fe 0%,#f1f5f9 50%,#cbd5e1 100%)', path: '#7dd3fc', deco: ['❄️', '⛄', '🌲', '🐧', '🏔️', '🦌'], goal: '🏔️' },
  { id: 'volcan', name: 'Volcán', emoji: '🌋', bg: 'linear-gradient(180deg,#7f1d1d 0%,#9a3412 55%,#431407 100%)', path: '#fde68a', deco: ['🔥', '🪨', '🦖', '🌋', '💎', '🦎'], goal: '🌋' },
  { id: 'espacio', name: 'Espacio', emoji: '🚀', bg: 'radial-gradient(circle at 30% 20%,#4c1d95 0%,#1e1b4b 55%,#0f172a 100%)', path: '#c4b5fd', deco: ['⭐', '🪐', '☄️', '🛸', '🌙', '✨'], goal: '🪐' },
];

export function themeById(id: string | null | undefined): CampaignTheme {
  return CAMPAIGN_THEMES.find((t) => t.id === id) ?? CAMPAIGN_THEMES[0];
}

export const CAMPAIGN_EMOJIS = ['🗺️', '⚔️', '🐉', '🏴‍☠️', '🧭', '🦄', '🚀', '👑', '🧙', '🐴', '♞', '🏆'];

export interface CampaignMetaBody { title?: string; description?: string; reward_type?: string; theme?: string; emoji?: string }
export type CampaignMeta = { title: string; description: string; reward: string; theme: string; emoji: string };

/** Validates the editable fields of a campaign (coach input is untrusted). */
export function campaignMeta(b: CampaignMetaBody): { error: string } | CampaignMeta {
  const title = String(b.title ?? '').trim().slice(0, 60);
  if (!title) return { error: 'Pon un título a la campaña' };
  const reward = CAMPAIGN_REWARDS.some((r) => r.id === b.reward_type) ? String(b.reward_type) : '';
  if (!reward) return { error: 'Elige una recompensa' };
  const theme = CAMPAIGN_THEMES.some((t) => t.id === b.theme) ? String(b.theme) : CAMPAIGN_THEMES[0].id;
  const emoji = CAMPAIGN_EMOJIS.includes(String(b.emoji)) ? String(b.emoji) : CAMPAIGN_EMOJIS[0];
  return { title, description: String(b.description ?? '').trim().slice(0, 160), reward, theme, emoji };
}

/** Max levels per campaign (keeps the map readable on a phone and the queries small). */
export const MAX_CAMPAIGN_NODES = 30;

// ---------- Progress rules ----------

export type NodeState = 'done' | 'next' | 'locked';

/**
 * State of every node, in path order. Nodes are played in order: a node is playable when it is
 * done (replay) or every node before it is done.
 */
export function nodeStates(orderedIds: number[], completed: Set<number>): NodeState[] {
  let open = true;
  return orderedIds.map((id) => {
    if (completed.has(id)) return 'done';
    if (open) { open = false; return 'next'; }
    return 'locked';
  });
}

export function isNodePlayable(orderedIds: number[], completed: Set<number>, nodeId: number): boolean {
  const i = orderedIds.indexOf(nodeId);
  if (i < 0) return false;
  return nodeStates(orderedIds, completed)[i] !== 'locked';
}

export function isCampaignComplete(orderedIds: number[], completed: Set<number>): boolean {
  return orderedIds.length > 0 && orderedIds.every((id) => completed.has(id));
}

/**
 * Winding layout for the map: x/y in % of the map box. Node 0 sits at `bottom`, the last node
 * at `top` (both in %), so the caller can keep room for the start flag and the goal.
 */
export function mapLayout(count: number, top = 10, bottom = 90): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const x = 50 + 24 * Math.sin(i * 1.1);
    const y = count === 1 ? (top + bottom) / 2 : bottom - (i * (bottom - top)) / (count - 1);
    pts.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }
  return pts;
}

/** Smooth SVG path (viewBox 0 0 100 100) through the layout points. */
export function mapPath(pts: { x: number; y: number }[]): string {
  if (!pts.length) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const my = (a.y + b.y) / 2;
    d += ` C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  }
  return d;
}

// ---------- Queries ----------

export async function getCampaigns(db: D1Database, clubId: number) {
  const { results } = await db.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM campaign_nodes n WHERE n.campaign_id = c.id) AS node_count,
       (SELECT COUNT(*) FROM class_campaigns cc WHERE cc.campaign_id = c.id) AS class_count
     FROM campaigns c WHERE c.club_id = ? ORDER BY c.id DESC`,
  ).bind(clubId).all<CampaignRow & { node_count: number; class_count: number }>();
  return results;
}

export async function getCampaignNodes(db: D1Database, campaignId: number): Promise<CampaignNode[]> {
  const { results } = await db.prepare(
    `SELECT n.id, n.campaign_id, n.activity_id, n.position, n.created_at, a.title AS activity_title, a.type AS activity_type
     FROM campaign_nodes n JOIN activities a ON a.id = n.activity_id
     WHERE n.campaign_id = ? ORDER BY n.position, n.id`,
  ).bind(campaignId).all<CampaignNode>();
  return results;
}

/**
 * Campaign as seen by a coach. Any club member can view it and assign it to their classes;
 * only its creator or a club admin can edit it.
 */
export async function coachCampaign(db: D1Database, coachId: number, campaignId: number) {
  const campaign = await db.prepare('SELECT * FROM campaigns WHERE id = ?').bind(campaignId).first<CampaignRow>();
  if (!campaign) return null;
  const role = await isClubMember(db, coachId, campaign.club_id);
  if (!role) return null;
  return { campaign, role, canEdit: role === 'admin' || campaign.created_by === coachId };
}

export interface StudentCampaign extends CampaignRow {
  nodes: CampaignNode[];
  completedNodeIds: Set<number>;
  /** Best stars per activity id (for the stars under each node). */
  bestStars: Map<number, number>;
}

/** Campaigns assigned to the student's class, with nodes and progress (3 queries in one batch). */
export async function getStudentCampaigns(db: D1Database, classId: number, studentId: number, onlyId?: number): Promise<StudentCampaign[]> {
  const only = onlyId ? ' AND c.id = ?' : '';
  const binds: number[] = onlyId ? [classId, onlyId] : [classId];
  const [camps, nodes, progress, stars] = await db.batch<any>([
    db.prepare(`SELECT c.* FROM campaigns c JOIN class_campaigns cc ON cc.campaign_id = c.id WHERE cc.class_id = ?${only} ORDER BY cc.id DESC`).bind(...binds),
    db.prepare(
      `SELECT n.id, n.campaign_id, n.activity_id, n.position, n.created_at, a.title AS activity_title, a.type AS activity_type
       FROM campaign_nodes n JOIN activities a ON a.id = n.activity_id
       JOIN class_campaigns cc ON cc.campaign_id = n.campaign_id AND cc.class_id = ?
       WHERE 1 = 1${onlyId ? ' AND n.campaign_id = ?' : ''} ORDER BY n.campaign_id, n.position, n.id`,
    ).bind(...binds),
    db.prepare(
      `SELECT p.node_id FROM campaign_progress p JOIN campaign_nodes n ON n.id = p.node_id
       JOIN class_campaigns cc ON cc.campaign_id = n.campaign_id AND cc.class_id = ? WHERE p.student_id = ?`,
    ).bind(classId, studentId),
    db.prepare(
      `SELECT at.activity_id, MAX(at.stars) AS stars FROM attempts at
       WHERE at.student_id = ? AND at.activity_id IN (
         SELECT n.activity_id FROM campaign_nodes n JOIN class_campaigns cc ON cc.campaign_id = n.campaign_id AND cc.class_id = ?)
       GROUP BY at.activity_id`,
    ).bind(studentId, classId),
  ]);
  const done = new Set<number>(progress.results.map((p: any) => p.node_id));
  const best = new Map<number, number>(stars.results.map((r: any) => [r.activity_id, r.stars]));
  return (camps.results as CampaignRow[]).map((c) => {
    const ns = (nodes.results as CampaignNode[]).filter((n) => n.campaign_id === c.id);
    return { ...c, nodes: ns, completedNodeIds: new Set(ns.filter((n) => done.has(n.id)).map((n) => n.id)), bestStars: best };
  });
}

/**
 * Validates that a student may play `nodeId` with `activityId`: the node belongs to a campaign
 * assigned to the student's class, points at that activity, and is unlocked.
 */
export async function checkStudentNode(db: D1Database, studentId: number, classId: number, nodeId: number, activityId: number) {
  const node = await db.prepare(
    `SELECT n.id, n.campaign_id, c.reward_type, c.title FROM campaign_nodes n
     JOIN campaigns c ON c.id = n.campaign_id
     JOIN class_campaigns cc ON cc.campaign_id = n.campaign_id AND cc.class_id = ?
     WHERE n.id = ? AND n.activity_id = ?`,
  ).bind(classId, nodeId, activityId).first<{ id: number; campaign_id: number; reward_type: string; title: string }>();
  if (!node) return null;
  const [ids, progress] = await db.batch<any>([
    db.prepare('SELECT id FROM campaign_nodes WHERE campaign_id = ? ORDER BY position, id').bind(node.campaign_id),
    db.prepare('SELECT p.node_id FROM campaign_progress p JOIN campaign_nodes n ON n.id = p.node_id WHERE p.student_id = ? AND n.campaign_id = ?').bind(studentId, node.campaign_id),
  ]);
  const ordered: number[] = ids.results.map((r: any) => r.id);
  const completed = new Set<number>(progress.results.map((r: any) => r.node_id));
  return {
    nodeId, campaignId: node.campaign_id, title: node.title, reward: rewardById(node.reward_type),
    ordered, completed, playable: isNodePlayable(ordered, completed, nodeId),
  };
}

/** Unlock ids (reward ids) a student owns. */
export async function studentUnlocks(db: D1Database, studentId: number): Promise<Set<string>> {
  const { results } = await db.prepare('SELECT unlock_id FROM student_unlocks WHERE student_id = ?').bind(studentId).all<{ unlock_id: string }>();
  return new Set(results.map((r) => r.unlock_id));
}

/** Pet item ids unlocked by campaign rewards. */
export function unlockedPetItems(unlocks: Set<string>): string[] {
  return CAMPAIGN_REWARDS.filter((r) => r.petItem && unlocks.has(r.id)).map((r) => r.petItem!);
}

/** Title to show under the student's name, if any. */
export function unlockedTitle(unlocks: Set<string>): string | null {
  return CAMPAIGN_REWARDS.find((r) => r.title && unlocks.has(r.id))?.title ?? null;
}
