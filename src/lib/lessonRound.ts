// Interactive lesson on the projector: for each question the dice picks who answers; whoever misses
// leaves the dice for that question and it bounces to the rest, until someone gets it or all have failed.
// Pure functions, shared by the projector UI and tests.
import { POINTS } from './projector';

export interface Round {
  /** Contenders (kid ids, or team indexes as strings) still in the dice for this question. */
  pool: string[];
  /** Contenders that already missed. */
  failed: string[];
}

export const newRound = (ids: string[]): Round => ({ pool: [...ids], failed: [] });

/** Everybody missed: time to show the answer. */
export const isExhausted = (r: Round): boolean => r.pool.length === 0;

/** True once somebody has missed, so whoever answers now is on a rebound. */
export const isRebound = (r: Round): boolean => r.failed.length > 0;

/** Throws the dice over the contenders still in. */
export function rollDice(r: Round, rnd: () => number = Math.random): string | null {
  return r.pool.length ? r.pool[Math.floor(rnd() * r.pool.length)] : null;
}

/** The contender missed: they leave the dice for this question. */
export function fail(r: Round, id: string): Round {
  if (!r.pool.includes(id)) return r;
  return { pool: r.pool.filter((x) => x !== id), failed: [...r.failed, id] };
}

/**
 * Points for a correct answer, on the same scale as puzzle tournaments: the whole `solve` for the first
 * throw of the dice, a reduced one for a decent alternative (half the answer's points), and only
 * `steal` when it came after someone missed.
 */
export function roundPoints(rebound: boolean, answerPts: number, mainPts: number): number {
  if (rebound) return POINTS.steal;
  return answerPts >= mainPts ? POINTS.solve : Math.max(POINTS.steal, Math.round(POINTS.solve / 2));
}

/** Among a team's kids, the one who has been picked the fewest times goes first (ties at random). */
export function pickSpeaker<T extends { id: number }>(kids: T[], picks: Record<number, number>, rnd: () => number = Math.random): T | null {
  if (!kids.length) return null;
  const least = Math.min(...kids.map((k) => picks[k.id] ?? 0));
  const pool = kids.filter((k) => (picks[k.id] ?? 0) === least);
  return pool[Math.floor(rnd() * pool.length)];
}
