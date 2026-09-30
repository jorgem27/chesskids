import { type ActivityRow } from './db';

export interface CampaignRow {
  id: number;
  club_id: number;
  created_by: number | null;
  title: string;
  description: string;
  reward_type: string;
  created_at: number;
}

export interface CampaignNodeRow {
  id: number;
  campaign_id: number;
  activity_id: number;
  x_pos: number;
  y_pos: number;
  unlocks: string; // JSON array of node IDs
  created_at: number;
}

export interface CampaignReward {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

// "Diseña y pon 5 recompensas únicas que el profesor puede seleccionar de momento"
export const CAMPAIGN_REWARDS: CampaignReward[] = [
  { id: 'pet_flip', name: 'Mascota: Voltereta', emoji: '🤸', description: '¡Tu mascota dará una voltereta en su vestidor!' },
  { id: 'sticker_dragon', name: 'Cromo: Dragón Dorado', emoji: '🐲', description: 'Un cromo exclusivo para tu álbum.' },
  { id: 'theme_space', name: 'Fondo espacial', emoji: '🌌', description: 'Fondo de estrellas para el tablero.' },
  { id: 'pet_sunglasses', name: 'Mascota: Gafas de sol', emoji: '🕶️', description: 'Tu mascota se verá genial.' },
  { id: 'title_master', name: 'Título: Maestro Táctico', emoji: '👑', description: 'Un título de leyenda bajo tu nombre.' }
];

export async function getCampaigns(db: D1Database, clubId: number) {
  const { results } = await db.prepare('SELECT * FROM campaigns WHERE club_id = ? ORDER BY id DESC').bind(clubId).all<CampaignRow>();
  return results;
}

export async function getCampaignNodes(db: D1Database, campaignId: number) {
  const { results } = await db.prepare(`
    SELECT n.*, a.title as activity_title, a.type as activity_type 
    FROM campaign_nodes n 
    JOIN activities a ON a.id = n.activity_id 
    WHERE n.campaign_id = ?
  `).bind(campaignId).all<CampaignNodeRow & { activity_title: string; activity_type: string }>();
  return results;
}

// Get assigned campaigns for a class
export async function getStudentCampaigns(db: D1Database, classId: number, studentId: number) {
  const { results } = await db.prepare(`
    SELECT c.*, ca.id as assignment_id
    FROM campaigns c
    JOIN class_campaigns ca ON ca.campaign_id = c.id
    WHERE ca.class_id = ?
    ORDER BY ca.id DESC
  `).bind(classId).all<CampaignRow & { assignment_id: number }>();

  // Fetch nodes and progress for these campaigns
  const campaigns = await Promise.all(results.map(async (camp) => {
    const nodes = await getCampaignNodes(db, camp.id);
    const { results: progress } = await db.prepare(
      'SELECT node_id FROM campaign_progress WHERE student_id = ? AND node_id IN (SELECT id FROM campaign_nodes WHERE campaign_id = ?)'
    ).bind(studentId, camp.id).all<{ node_id: number }>();
    
    const completedNodeIds = new Set(progress.map(p => p.node_id));
    
    return { ...camp, nodes, completedNodeIds };
  }));

  return campaigns;
}
