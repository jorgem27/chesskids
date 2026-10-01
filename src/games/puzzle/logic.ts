import { Chess } from 'chess.js';
import { findRule, type MoveRule } from '../rules';

/** Per-student-move settings. steps[k] belongs to the k-th student move, i.e. moves[2k]. */
export interface PuzzleStep {
  hint?: string; // shown after the first mistake (in Hint mode)
  pts?: number; // points for solving this move (default: 3 in Hint mode, 1 in Blitz)
  rules?: MoveRule[]; // other accepted moves / "not the best" moves / known mistakes
}

export interface Puzzle {
  fen: string; // position with the STUDENT to move
  moves: string[]; // UCI: student, reply, student, reply, ... (ends with a student move)
  prompt?: string; // e.g. "Mate en 2"
  steps?: PuzzleStep[];
  /** Set when the puzzle came from the Lichess database: lets reviews find similar puzzles. */
  lichessId?: string;
  rating?: number;
}

export type PuzzleMode = 'hint' | 'blitz';

export const DEFAULT_PTS: Record<PuzzleMode, number> = { hint: 3, blitz: 1 };
export const studentMoveCount = (p: Puzzle) => Math.ceil((p.moves?.length ?? 0) / 2);

export function stepPts(p: Puzzle, k: number, mode: PuzzleMode): number {
  const v = p.steps?.[k]?.pts;
  return typeof v === 'number' && v >= 0 ? v : DEFAULT_PTS[mode];
}

export function puzzleMaxScore(p: Puzzle, mode: PuzzleMode): number {
  let t = 0;
  for (let k = 0; k < studentMoveCount(p); k++) t += stepPts(p, k, mode);
  return t;
}

/** Full points with no mistakes, ~2/3 after one, ~1/3 after more (3 → 3/2/1 like before). */
export function earnedPts(pts: number, mistakes: number, mode: PuzzleMode): number {
  if (mode === 'blitz' || mistakes <= 0 || pts <= 0) return pts;
  return Math.max(1, Math.round(pts * (mistakes === 1 ? 2 / 3 : 1 / 3)));
}

export type MoveVerdict =
  | { kind: 'best' }
  | { kind: 'good'; rule: MoveRule }
  | { kind: 'almost'; rule: MoveRule }
  | { kind: 'wrong'; rule?: MoveRule };

/** Decides what a student's move means at step `k` of a puzzle. */
export function judgeMove(p: Puzzle, k: number, fen: string, uci: string): MoveVerdict {
  const expected = p.moves[2 * k];
  if (isCorrectMove(fen, uci, expected)) return { kind: 'best' };
  const rule = findRule(p.steps?.[k]?.rules, uci);
  if (rule && rule.kind !== 'wrong') return { kind: rule.kind, rule };
  return { kind: 'wrong', rule };
}

export interface PuzzleSetContent {
  puzzles: Puzzle[];
  timeLimitSec?: number; // blitz only: seconds per puzzle (0/undefined = no clock)
}

export function uciToMove(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined };
}

export function applyUci(chess: Chess, uci: string) {
  try {
    return chess.move(uciToMove(uci));
  } catch {
    return null;
  }
}

/**
 * Converts a Lichess puzzle (FEN before the opponent's move + UCI line starting with that move)
 * into our format (FEN with the student to move). Returns null if the data is not playable.
 */
export function fromLichess(fen: string, uciMoves: string[]): Puzzle | null {
  if (uciMoves.length < 2 || uciMoves.length % 2 !== 0) return null;
  let p: Puzzle;
  try {
    const c = new Chess(fen.trim());
    if (!applyUci(c, uciMoves[0])) return null;
    p = { fen: c.fen(), moves: uciMoves.slice(1), prompt: '' };
  } catch {
    return null;
  }
  return validatePuzzleSet({ puzzles: [p] }).length ? null : p;
}

function validateRules(chess: Chess, rules: MoveRule[] | undefined, n: string, errs: string[]) {
  for (const r of rules ?? []) {
    if (!applyUci(new Chess(chess.fen()), r.uci)) errs.push(`${n}: la jugada ${r.uci} ya no es legal`);
  }
}

export function validatePuzzleSet(c: PuzzleSetContent): string[] {
  const errs: string[] = [];
  if (!c?.puzzles?.length) return ['Añade al menos un problema'];
  c.puzzles.forEach((p, i) => {
    const n = `Problema ${i + 1}`;
    let chess: Chess;
    try {
      chess = new Chess(p.fen);
    } catch {
      errs.push(`${n}: FEN no válido`);
      return;
    }
    if (!p.moves?.length) { errs.push(`${n}: graba la solución`); return; }
    if (p.moves.length % 2 === 0) errs.push(`${n}: la solución debe terminar con una jugada del alumno`);
    for (let i = 0; i < p.moves.length; i++) {
      if (i % 2 === 0) validateRules(chess, p.steps?.[i / 2]?.rules, n, errs);
      if (!applyUci(chess, p.moves[i])) { errs.push(`${n}: jugada ilegal ${p.moves[i]}`); break; }
    }
  });
  return errs;
}

/** A student move is correct if it matches the solution OR delivers checkmate. */
export function isCorrectMove(fen: string, uci: string, expected: string): boolean {
  if (uci === expected) return true;
  if (uci.slice(0, 4) === expected.slice(0, 4) && expected.length === 4) return true;
  const c = new Chess(fen);
  const m = applyUci(c, uci);
  return !!m && c.isCheckmate();
}

/** @deprecated kept for old callers: the 3/2/1 scale of a default 3-point move. */
export function puzzleScore(mistakes: number): number {
  return mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1;
}
