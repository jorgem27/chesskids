import { Chess } from 'chess.js';

export interface Puzzle {
  fen: string; // position with the STUDENT to move
  moves: string[]; // UCI: student, reply, student, reply, ... (ends with a student move)
  prompt?: string; // e.g. "Mate en 2"
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
    for (const m of p.moves) {
      if (!applyUci(chess, m)) { errs.push(`${n}: jugada ilegal ${m}`); break; }
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

export function puzzleScore(mistakes: number): number {
  return mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1;
}
