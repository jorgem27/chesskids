// Editable model of a lesson PGN for the visual editor (pure, no Preact).
// The lesson is still stored as PGN: the editor parses it with parsePgn, edits comments/variations
// through these helpers and writes it back with serializePgn.
import { Chess } from 'chess.js';
import { hasAsk, type QuestionOverrides } from './lesson';
import { parseComment, parsePgn, type CommentInfo, type PgnGame, type PgnMove, type Shape } from './parser';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type AltKind = 'good' | 'almost' | 'wrong';

const BRUSH_LETTER: Record<string, string> = { green: 'G', red: 'R', yellow: 'Y', blue: 'B' };

/** Text typed by the coach can't break the PGN comment or a [%tag]. */
const clean = (s: string) => s.replace(/[{}\[\]]/g, '').replace(/\s+/g, ' ').trim();

/** Inverse of parseComment. */
export function buildComment(info: CommentInfo): string {
  const parts: string[] = [];
  if (info.text.trim()) parts.push(clean(info.text));
  if (info.ask !== undefined) parts.push(`[%ask ${clean(info.ask) || '¿Cuál es la mejor jugada?'}]`);
  if (info.hint?.trim()) parts.push(`[%hint ${clean(info.hint)}]`);
  if (info.pts !== undefined) parts.push(`[%pts ${Math.round(info.pts)}]`);
  if (info.retry) parts.push('[%retry]');
  if (info.wait) parts.push('[%wait]');
  const brush = (s: Shape) => BRUSH_LETTER[s.brush] ?? 'G';
  const arrows = info.shapes.filter((s) => s.dest && s.dest !== s.orig).map((s) => brush(s) + s.orig + s.dest);
  const circles = info.shapes.filter((s) => !s.dest || s.dest === s.orig).map((s) => brush(s) + s.orig);
  if (arrows.length) parts.push(`[%cal ${arrows.join(',')}]`);
  if (circles.length) parts.push(`[%csl ${circles.join(',')}]`);
  return parts.join(' ');
}

export function startFenOf(game: PgnGame): string {
  return game.headers.FEN ?? START_FEN;
}

/**
 * Where a line lives in the PGN tree: [] is the game itself; each step enters variation `v` of the move
 * at index `ply` of the line before it. Every editing helper below takes an optional path (default: the game).
 * In a variation, position 0 is the branch point (the position before its first move).
 */
export type LinePath = { ply: number; v: number }[];

export interface LineView { moves: PgnMove[]; fen: string }

/** The moves of the line at `path` (live references into `game`) and its start position; null if the path is stale. */
export function lineAt(game: PgnGame, path: LinePath = []): LineView | null {
  let moves = game.moves;
  let fen = startFenOf(game);
  try {
    for (const { ply, v } of path) {
      const c = new Chess(fen);
      for (const m of moves.slice(0, ply)) c.move(m.san);
      const next = moves[ply]?.variations[v];
      if (!next?.length) return null;
      fen = c.fen();
      moves = next;
    }
  } catch {
    return null;
  }
  return { moves, fen };
}

const linesOf = (game: PgnGame, path: LinePath): PgnMove[] => lineAt(game, path)?.moves ?? [];

/** FEN after the first `ply` moves of the line (throws on an illegal move). */
export function fenAt(game: PgnGame, ply: number, path: LinePath = []): string {
  const l = lineAt(game, path);
  if (!l) throw new Error('Variante no encontrada');
  const c = new Chess(l.fen);
  for (const m of l.moves.slice(0, ply)) c.move(m.san);
  return c.fen();
}

/** Comment that belongs to the position after `ply` moves (the start comment for ply 0 of the game). */
export function noteAt(game: PgnGame, ply: number, path: LinePath = []): CommentInfo {
  if (ply === 0) {
    if (!path.length) return parseComment(game.startComment);
    const up = path[path.length - 1];
    return noteAt(game, up.ply, path.slice(0, -1)); // a variation's start is its parent's position
  }
  return parseComment(linesOf(game, path)[ply - 1]?.comment ?? '');
}

const cloneMove = (m: PgnMove): PgnMove => ({ ...m, nags: [...m.nags], variations: m.variations.map((v) => v.map(cloneMove)) });
export const cloneGame = (g: PgnGame): PgnGame => ({ headers: { ...g.headers }, startComment: g.startComment, moves: g.moves.map(cloneMove) });

export function setNoteAt(game: PgnGame, ply: number, patch: Partial<CommentInfo>, path: LinePath = []): PgnGame {
  if (ply === 0 && path.length) return setNoteAt(game, path[path.length - 1].ply, patch, path.slice(0, -1));
  const g = cloneGame(game);
  const comment = buildComment({ ...noteAt(g, ply, path), ...patch });
  if (ply === 0) g.startComment = comment;
  else {
    const m = linesOf(g, path)[ply - 1];
    if (m) m.comment = comment;
  }
  return g;
}

/** Points of the main answer at `ply` (stored as [%pts] on the move itself). */
export function mainPts(game: PgnGame, ply: number, path: LinePath = []): number {
  return parseComment(linesOf(game, path)[ply]?.comment ?? '').pts ?? 100;
}

export function setMainPts(game: PgnGame, ply: number, pts: number | undefined, path: LinePath = []): PgnGame {
  const g = cloneGame(game);
  const m = linesOf(g, path)[ply];
  if (m) m.comment = buildComment({ ...parseComment(m.comment), pts });
  return g;
}

export interface Alt {
  index: number; san: string; kind: AltKind; pts?: number; text: string;
  /** Moves in the variation (1 = just the alternative) and whether it has questions further on (a side line). */
  length: number; sideLine: boolean;
}

export function altKind(info: CommentInfo): AltKind {
  return info.retry ? 'almost' : (info.pts ?? 0) > 0 ? 'good' : 'wrong';
}

/** Alternatives to the move played from position `ply` (first move of each variation). */
export function altsAt(game: PgnGame, ply: number, path: LinePath = []): Alt[] {
  return (linesOf(game, path)[ply]?.variations ?? []).map((v, index) => {
    const info = parseComment(v[0]?.comment ?? '');
    return { index, san: v[0]?.san ?? '?', kind: altKind(info), pts: info.pts, text: info.text, length: v.length, sideLine: hasAsk(v) };
  });
}

/** Rewrites the kind/points/message tags of an alternative, keeping its question, arrows and pause. */
function altComment(base: CommentInfo, kind: AltKind, text: string, pts: number | undefined): string {
  return buildComment({
    ...base, text,
    retry: kind === 'almost',
    pts: kind === 'good' ? Math.max(1, pts ?? 50) : undefined,
  });
}

/** Index of the variation from position `ply` that starts with `san`, matched by from/to ("Bxc6" = "Bxc6+"). */
function findAlt(g: PgnGame, ply: number, san: string, path: LinePath): { index: number; isMain: boolean } | null {
  const m = linesOf(g, path)[ply];
  if (!m) return null;
  let fen: string;
  try { fen = fenAt(g, ply, path); } catch { return null; }
  const key = (s: string) => { try { const x = new Chess(fen).move(s); return x.from + x.to; } catch { return s; } };
  return { index: m.variations.findIndex((v) => v[0] && key(v[0].san) === key(san)), isMain: key(m.san) === key(san) };
}

export function addAlt(game: PgnGame, ply: number, san: string, kind: AltKind, pts?: number, text = '', path: LinePath = []): PgnGame {
  const g = cloneGame(game);
  const found = findAlt(g, ply, san, path);
  if (!found || found.isMain) return g; // the main answer is not an alternative
  const m = linesOf(g, path)[ply];
  const at = found.index;
  if (at >= 0) {
    const first = m.variations[at][0];
    first.comment = altComment(parseComment(first.comment), kind, text || parseComment(first.comment).text, pts);
  } else {
    m.variations.push([{ san, comment: altComment(parseComment(''), kind, text, pts), nags: [], variations: [] }]);
  }
  return g;
}

/** Starts a side line ("¿Y si…?") with `san` from position `ply`; returns its variation index (existing or new). */
export function addLine(game: PgnGame, ply: number, san: string, path: LinePath = []): { game: PgnGame; index: number } {
  const g = cloneGame(game);
  const found = findAlt(g, ply, san, path);
  if (!found || found.isMain) return { game: g, index: -1 };
  if (found.index >= 0) return { game: g, index: found.index };
  const m = linesOf(g, path)[ply];
  m.variations.push([{ san, comment: '', nags: [], variations: [] }]);
  return { game: g, index: m.variations.length - 1 };
}

export function updateAlt(game: PgnGame, ply: number, index: number, patch: Partial<Pick<Alt, 'kind' | 'pts' | 'text'>>, path: LinePath = []): PgnGame {
  const g = cloneGame(game);
  const first = linesOf(g, path)[ply]?.variations[index]?.[0];
  if (!first) return g;
  const info = parseComment(first.comment);
  const cur = { kind: altKind(info), pts: info.pts, text: info.text, ...patch };
  first.comment = altComment(info, cur.kind, cur.text, cur.pts);
  return g;
}

export function removeAlt(game: PgnGame, ply: number, index: number, path: LinePath = []): PgnGame {
  const g = cloneGame(game);
  linesOf(g, path)[ply]?.variations.splice(index, 1);
  return g;
}

/** Plays `san` from position `ply`, dropping the rest of the line. */
export function replaceFrom(game: PgnGame, ply: number, san: string, path: LinePath = []): PgnGame {
  const g = cloneGame(game);
  const l = lineAt(g, path);
  l?.moves.splice(ply, Infinity, { san, comment: '', nags: [], variations: [] });
  return g;
}

/** Drops the moves from position `ply` on. A variation left empty is removed. */
export function truncateAt(game: PgnGame, ply: number, path: LinePath = []): PgnGame {
  const g = cloneGame(game);
  const l = lineAt(g, path);
  if (!l) return g;
  l.moves.splice(ply);
  if (!l.moves.length && path.length) {
    const up = path[path.length - 1];
    return removeAlt(g, up.ply, up.v, path.slice(0, -1));
  }
  return g;
}

// ---------- Serializer ----------

/** Pasted comments (e.g. from `;` line comments) may contain braces that would end the comment early. */
const safe = (c: string) => c.replace(/[{}]/g, '').trim();

function lineToPgn(moves: PgnMove[], fen: string): string {
  const c = new Chess(fen);
  const out: string[] = [];
  let needNumber = true;
  for (const m of moves) {
    const before = c.fen();
    const [, turn, , , , full] = before.split(' ');
    if (turn === 'w') out.push(`${full}.`);
    else if (needNumber) out.push(`${full}...`);
    let played;
    try { played = c.move(m.san); } catch { played = null; }
    out.push(played?.san ?? m.san);
    needNumber = false;
    if (m.nags.length) out.push(...m.nags.map((n) => `$${n}`));
    if (m.comment.trim()) { out.push(`{ ${safe(m.comment)} }`); needNumber = true; }
    for (const v of m.variations) {
      if (v.length) { out.push(`( ${lineToPgn(v, before)} )`); needNumber = true; }
    }
    if (!played) break; // an illegal move ends the line: nothing after it can be replayed
  }
  return out.join(' ');
}

export function serializePgn(game: PgnGame): string {
  const headers: Record<string, string> = { Event: 'Lección', ...game.headers };
  if (headers.FEN) headers.SetUp = '1';
  const head = Object.entries(headers).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n');
  const intro = game.startComment.trim() ? `{ ${safe(game.startComment)} } ` : '';
  return `${head}\n\n${intro}${lineToPgn(game.moves, startFenOf(game))} *`.replace(/ +/g, ' ');
}

/** Builds a lesson PGN from what the coach pasted: a PGN, a FEN, or both (the FEN is the start position). */
export function importPgn(pgnText: string, fenText: string): { game?: PgnGame; error?: string } {
  const fen = fenText.trim();
  if (fen) {
    try { new Chess(fen); } catch { return { error: 'La posición (FEN) no es válida' }; }
  }
  const game = parsePgn(pgnText ?? '');
  if (fen) game.headers.FEN = fen;
  if (game.headers.FEN === START_FEN) { delete game.headers.FEN; delete game.headers.SetUp; }
  let c: Chess;
  try { c = new Chess(startFenOf(game)); } catch { return { error: 'La posición (FEN) del PGN no es válida' }; }
  for (let i = 0; i < game.moves.length; i++) {
    try { c.move(game.moves[i].san); } catch {
      return { error: `Jugada ilegal en la partida (${i + 1}): ${game.moves[i].san}` };
    }
  }
  return { game };
}

/** Old lessons kept per-question edits in `questions` (keyed by FEN): fold them into the PGN. */
export function foldOverrides(game: PgnGame, overrides: QuestionOverrides | undefined): PgnGame {
  if (!overrides || !Object.keys(overrides).length) return game;
  let g = cloneGame(game);
  const c = new Chess(startFenOf(g));
  const fens: string[] = [c.fen()];
  for (const m of g.moves) { c.move(m.san); fens.push(c.fen()); }
  fens.forEach((fen, ply) => {
    const cfg = overrides[fen];
    if (!cfg || ply >= g.moves.length || noteAt(g, ply).ask === undefined) return;
    const patch: Partial<CommentInfo> = {};
    if (cfg.question?.trim()) patch.ask = cfg.question.trim();
    if (cfg.hint !== undefined) patch.hint = cfg.hint.trim() || undefined;
    g = setNoteAt(g, ply, patch);
    if (cfg.pts !== undefined) g = setMainPts(g, ply, cfg.pts);
    if (cfg.rules) {
      g.moves[ply].variations = [];
      for (const r of cfg.rules) {
        try {
          const mv = new Chess(fen).move({ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] });
          g = addAlt(g, ply, mv.san, r.kind, r.pts ?? mainPts(g, ply), r.text ?? '');
        } catch { /* illegal rule: drop it */ }
      }
    }
  });
  return g;
}
