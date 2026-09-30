// Projector-mode tournaments: XP split between team result and personal merit.
// Pure functions shared by the podium preview (client) and /api/coach/projector (authoritative).

export const XP_BUDGETS = [0, 5, 10, 20, 30, 50] as const;
export const MAX_XP_BUDGET = 50;
/** Tournaments per class and day that may hand out XP (practice rounds are unlimited). */
export const MAX_XP_TOURNAMENTS_PER_DAY = 3;
/** Upper bound on learning time credited per puzzle played. */
export const MAX_SECONDS_PER_PUZZLE = 300;

/** Points a team scores for a puzzle: solved on its own turn vs. on a rebound ("rebote"). */
export const POINTS = { solve: 3, steal: 1 } as const;

/** Share of the budget for: just playing, the team's result, and the kid's own turns at the board. */
export const SHARES = { play: 0.3, team: 0.4, personal: 0.3 } as const;

/** Personal merit for each time the dice picks a kid (going up to the board counts, even if they miss). */
export const PICK_MERIT = 1;

export interface KidTally {
  studentId: number;
  team: number;   // index into teams
  picks: number;  // times chosen by the dice
  solved: number; // puzzles solved while chosen
  points: number; // team points scored while chosen
}

export interface XpSplit {
  studentId: number;
  team: number;
  play: number;
  teamXp: number;
  personal: number;
  total: number;
}

export function clampBudget(n: unknown): number {
  const v = Math.round(Number(n) || 0);
  return Math.max(0, Math.min(MAX_XP_BUDGET, v));
}

export function isAllowedBudget(n: unknown): boolean {
  return (XP_BUDGETS as readonly number[]).includes(Number(n));
}

/** Learning time credited to each kid: real duration, capped by puzzles played and 2 hours. */
export function creditedSeconds(seconds: unknown, puzzlesPlayed: number): number {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return Math.min(s, puzzlesPlayed * MAX_SECONDS_PER_PUZZLE, 7200);
}

/**
 * Points each kid earned for their team: the points scored while the dice had picked them, plus an equal
 * share of the team's points that no picked kid claimed (puzzles the team solved together, without the dice).
 * A team of 1 that scored 6 points without the dice -> 6; a team of 2 -> 3 each.
 */
/** Points for display: whole numbers as-is, shares with one decimal and a Spanish comma (1,5). */
export function fmtPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

export function kidPoints(teamScores: number[], kids: KidTally[]): Map<number, number> {
  const claimed = teamScores.map(() => 0);
  const size = teamScores.map(() => 0);
  for (const k of kids) { claimed[k.team] += k.points; size[k.team]++; }
  const share = teamScores.map((s, i) => (size[i] ? Math.max(0, s - claimed[i]) / size[i] : 0));
  return new Map(kids.map((k) => [k.studentId, k.points + share[k.team]]));
}

/**
 * Splits `budget` (the most XP any single kid can earn) for every participant:
 *  - play:     SHARES.play × budget for everyone who took part.
 *  - team:     SHARES.team × budget × teamScore / bestTeamScore (winners get it all, others proportionally).
 *  - personal: SHARES.personal × budget × merit / bestMerit, merit = picks × PICK_MERIT + kidPoints.
 * If nobody scored, the team share moves to `play`; if nobody has merit, the personal share moves to `team`
 * (or to `play` when neither happened), so the budget is always fully usable.
 * Every participant gets at least 1 XP when budget > 0, and never more than `budget`.
 */
export function distributeXp(budget: number, teamScores: number[], kids: KidTally[]): XpSplit[] {
  const b = clampBudget(budget);
  const bestTeam = Math.max(0, ...teamScores);
  const pts = kidPoints(teamScores, kids);
  const merit = (k: KidTally) => k.picks * PICK_MERIT + (pts.get(k.studentId) ?? 0);
  const bestMerit = Math.max(0, ...kids.map(merit));

  let wPlay: number = SHARES.play;
  let wTeam: number = SHARES.team;
  let wPers: number = SHARES.personal;
  if (bestMerit === 0) { wTeam += wPers; wPers = 0; }
  if (bestTeam === 0) { wPlay += wTeam; wTeam = 0; }

  return kids.map((k) => {
    if (b === 0) return { studentId: k.studentId, team: k.team, play: 0, teamXp: 0, personal: 0, total: 0 };
    const play = b * wPlay;
    const teamXp = bestTeam ? b * wTeam * ((teamScores[k.team] ?? 0) / bestTeam) : 0;
    const personal = bestMerit ? b * wPers * (merit(k) / bestMerit) : 0;
    const total = Math.max(1, Math.min(b, Math.round(play + teamXp + personal)));
    return { studentId: k.studentId, team: k.team, play: Math.round(play), teamXp: Math.round(teamXp), personal: Math.round(personal), total };
  });
}

export interface TournamentInput {
  teams: { score: number }[];
  kids: KidTally[];
  puzzlesPlayed: number;
}

/** Sanity checks on a tournament reported by the projector. Returns a Spanish error or null. */
export function validateTournament(t: TournamentInput): string | null {
  const n = t.teams.length;
  const P = t.puzzlesPlayed;
  if (n < 2 || n > 4) return 'Hacen falta entre 2 y 4 equipos';
  if (!Number.isInteger(P) || P < 1 || P > 200) return 'Número de problemas no válido';
  if (!t.kids.length) return 'No hay alumnos en los equipos';
  if (t.kids.length > 60) return 'Demasiados alumnos';
  const int = (x: number, max: number) => Number.isInteger(x) && x >= 0 && x <= max;
  if (!t.teams.every((tm) => int(tm.score, POINTS.solve * P))) return 'Puntuación de equipo no válida';
  const totalScore = t.teams.reduce((s, tm) => s + tm.score, 0);
  if (totalScore > POINTS.solve * P) return 'Hay más puntos que problemas';
  const seen = new Set<number>();
  const byTeam = new Array(n).fill(0);
  for (const k of t.kids) {
    if (seen.has(k.studentId)) return 'Un alumno aparece dos veces';
    seen.add(k.studentId);
    if (!int(k.team, n - 1)) return 'Equipo no válido';
    if (!int(k.picks, 2 * P) || !int(k.solved, k.picks) || !int(k.points, POINTS.solve * k.solved)) return 'Datos de alumno no válidos';
    if (k.points < POINTS.steal * k.solved) return 'Datos de alumno no válidos';
    byTeam[k.team] += k.points;
  }
  if (byTeam.some((pts, i) => pts > t.teams[i].score)) return 'Los puntos de los alumnos no cuadran con su equipo';
  return null;
}
