// Seasons ("temporadas") follow the Spanish school year: three terms plus summer. Each season has
// its own class ranking (it starts from zero) and its own achievements, so motivation doesn't
// depend on who has been playing the longest. Everything is computed from the dated history
// (attempts, practice, projector), so there is nothing to reset or store.
import { addDays, daysBetween } from './dates';

export interface Season { id: string; name: string; emoji: string; start: string; end: string }

const TERMS = [
  { key: 'T2', name: 'Temporada de invierno', emoji: '❄️', from: '01-01', to: '03-31' },
  { key: 'T3', name: 'Temporada de primavera', emoji: '🌸', from: '04-01', to: '06-30' },
  { key: 'V', name: 'Temporada de verano', emoji: '🏖️', from: '07-01', to: '08-31' },
  { key: 'T1', name: 'Temporada de otoño', emoji: '🍂', from: '09-01', to: '12-31' },
];

/** Season containing `day` (YYYY-MM-DD). */
export function seasonFor(day: string): Season {
  const year = day.slice(0, 4);
  const md = day.slice(5);
  const t = TERMS.find((x) => md >= x.from && md <= x.to)!;
  return { id: `${year}-${t.key}`, name: t.name, emoji: t.emoji, start: `${year}-${t.from}`, end: `${year}-${t.to}` };
}

export function previousSeason(s: Season): Season {
  return seasonFor(addDays(s.start, -1));
}

/** The last `n` finished seasons, newest first. */
export function pastSeasons(current: Season, n: number): Season[] {
  const out: Season[] = [];
  let s = current;
  for (let i = 0; i < n; i++) out.push((s = previousSeason(s)));
  return out;
}

export function daysLeft(s: Season, today: string): number {
  return Math.max(0, daysBetween(today, s.end));
}

// ---------- Achievements ----------

export interface Tier { id: string; name: string; emoji: string; xp: number }

/** XP earned during one season. A term is ~3-4 months: ~10 XP a day reaches gold. */
export const SEASON_TIERS: Tier[] = [
  { id: 'bronce', name: 'Bronce', emoji: '🥉', xp: 150 },
  { id: 'plata', name: 'Plata', emoji: '🥈', xp: 400 },
  { id: 'oro', name: 'Oro', emoji: '🥇', xp: 800 },
  { id: 'diamante', name: 'Diamante', emoji: '💎', xp: 1500 },
];

export interface SeasonBadge { id: string; emoji: string; name: string; hint: string; test: (s: SeasonStats) => boolean }
export interface SeasonStats { xp: number; solved: number; activeDays: number; rank: number; players: number }

export const SEASON_BADGES: SeasonBadge[] = [
  ...SEASON_TIERS.map((t) => ({ id: t.id, emoji: t.emoji, name: `Liga ${t.name}`, hint: `Gana ${t.xp} XP esta temporada`, test: (s: SeasonStats) => s.xp >= t.xp })),
  { id: 'constante', emoji: '📅', name: 'Constante', hint: 'Juega 20 días distintos esta temporada', test: (s) => s.activeDays >= 20 },
  { id: 'incansable', emoji: '🏃', name: 'Incansable', hint: 'Juega 45 días distintos esta temporada', test: (s) => s.activeDays >= 45 },
  { id: 'problemas-100', emoji: '🧩', name: 'Cien problemas', hint: 'Resuelve 100 problemas esta temporada', test: (s) => s.solved >= 100 },
  { id: 'podio', emoji: '🏆', name: 'Podio', hint: 'Termina entre los 3 primeros de tu clase', test: (s) => s.players >= 3 && s.rank >= 1 && s.rank <= 3 && s.xp > 0 },
];

/** Summer (July–August) is short and has no classes: its goals are halved. */
export function seasonScale(s?: Season): number {
  return s?.id.endsWith('-V') ? 0.5 : 1;
}

/** The leagues of a season, with the XP scaled to its length. */
export function seasonTiers(s?: Season): Tier[] {
  const k = seasonScale(s);
  return SEASON_TIERS.map((t) => ({ ...t, xp: Math.round(t.xp * k) }));
}

export function tierFor(xp: number, s?: Season): Tier | null {
  return [...seasonTiers(s)].reverse().find((t) => xp >= t.xp) ?? null;
}

export function nextTier(xp: number, s?: Season): Tier | null {
  return seasonTiers(s).find((t) => xp < t.xp) ?? null;
}

/** Badge ids earned in a season. Thresholds are given for a full term and scaled to the season. */
export function seasonBadges(st: SeasonStats, s?: Season): string[] {
  const k = seasonScale(s);
  const scaled = { ...st, xp: st.xp / k, solved: st.solved / k, activeDays: st.activeDays / k };
  return SEASON_BADGES.filter((b) => b.test(b.id === 'podio' ? st : scaled)).map((b) => b.id);
}

/** Badge hint text for a season (numbers scaled like the thresholds). */
export function badgeHint(b: SeasonBadge, s?: Season): string {
  const k = seasonScale(s);
  return k === 1 ? b.hint : b.hint.replace(/\d+/, (n) => String(Math.round(Number(n) * k)));
}

// ---------- Queries ----------

export interface SeasonRow { id: number; display_name: string; avatar: string; xp: number; solved: number; active_days: number }

/** Ranking of a class for one season (XP from homework, practice and projector tournaments). */
export async function seasonLeaderboard(db: D1Database, classId: number, s: Season): Promise<(SeasonRow & { rank: number })[]> {
  const { results } = await db.prepare(
    `SELECT st.id, st.display_name, st.avatar, COALESCE(SUM(x.xp), 0) AS xp, COALESCE(SUM(x.solved), 0) AS solved, COUNT(DISTINCT x.day) AS active_days
     FROM students st LEFT JOIN (
       SELECT student_id AS sid, day, xp_earned AS xp, puzzles_solved AS solved FROM attempts
         WHERE student_id IN (SELECT id FROM students WHERE class_id = ?1 AND archived = 0) AND day BETWEEN ?2 AND ?3
       UNION ALL SELECT student_id, day, xp_earned, solved FROM practice_sessions
         WHERE student_id IN (SELECT id FROM students WHERE class_id = ?1 AND archived = 0) AND day BETWEEN ?2 AND ?3 AND finished_at IS NOT NULL
       UNION ALL SELECT student_id, day, xp_earned, solved FROM projector_results
         WHERE student_id IN (SELECT id FROM students WHERE class_id = ?1 AND archived = 0) AND day BETWEEN ?2 AND ?3
     ) x ON x.sid = st.id
     WHERE st.class_id = ?1 AND st.archived = 0
     GROUP BY st.id ORDER BY xp DESC, st.display_name`,
  ).bind(classId, s.start, s.end).all<SeasonRow>();
  return rankRows(results);
}

/** Standard competition ranking (1, 2, 2, 4): ties share a place. */
export function rankRows<T extends { xp: number }>(rows: T[]): (T & { rank: number })[] {
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.xp < rows[i - 1].xp) rank = i + 1;
    return { ...r, rank };
  });
}
