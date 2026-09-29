// Fruit Collector: single-piece movement + shortest route solver (BFS + bitmask DP).
// Pure module: no chess.js needed because only one piece (plus rocks) is on the board.

export type FruitPiece = 'N' | 'B' | 'R' | 'Q' | 'K';

export interface FruitLevel {
  piece: FruitPiece;
  start: string; // e.g. "a1"
  fruits: string[];
  rocks?: string[];
  title?: string;
}

export const PIECE_NAMES: Record<FruitPiece, string> = {
  N: 'Caballo', B: 'Alfil', R: 'Torre', Q: 'Dama', K: 'Rey',
};

export const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '🍉', '🍋'];

const FILES = 'abcdefgh';

export function sqToXY(sq: string): [number, number] {
  return [FILES.indexOf(sq[0]), Number(sq[1]) - 1];
}
export function xyToSq(x: number, y: number): string {
  return FILES[x] + String(y + 1);
}
export function isSquare(sq: string): boolean {
  return /^[a-h][1-8]$/.test(sq);
}

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Legal destination squares of `piece` on `from`, where rocks block (cannot be passed or landed on). */
export function pieceMoves(piece: FruitPiece, from: string, rocks: Set<string>): string[] {
  const [x, y] = sqToXY(from);
  const out: string[] = [];
  const inside = (a: number, b: number) => a >= 0 && a < 8 && b >= 0 && b < 8;
  if (piece === 'N' || piece === 'K') {
    for (const [dx, dy] of piece === 'N' ? KNIGHT : KING) {
      const nx = x + dx, ny = y + dy;
      if (inside(nx, ny) && !rocks.has(xyToSq(nx, ny))) out.push(xyToSq(nx, ny));
    }
    return out;
  }
  const dirs = piece === 'R' ? ROOK_DIRS : piece === 'B' ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
  for (const [dx, dy] of dirs) {
    let nx = x + dx, ny = y + dy;
    while (inside(nx, ny) && !rocks.has(xyToSq(nx, ny))) {
      out.push(xyToSq(nx, ny));
      nx += dx; ny += dy;
    }
  }
  return out;
}

/** BFS distances from `from` to every reachable square. */
export function distances(piece: FruitPiece, from: string, rocks: Set<string>): Map<string, number> {
  const dist = new Map<string, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of pieceMoves(piece, cur, rocks)) {
      if (!dist.has(n)) {
        dist.set(n, dist.get(cur)! + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}

export interface Solution {
  moves: number; // minimum number of moves to collect all fruits (Infinity if impossible)
  order: string[]; // fruit visiting order
  path: string[]; // full square path, including start
}

function bfsPath(piece: FruitPiece, from: string, to: string, rocks: Set<string>): string[] {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const n of pieceMoves(piece, cur, rocks)) {
      if (!prev.has(n)) { prev.set(n, cur); queue.push(n); }
    }
  }
  if (!prev.has(to)) return [];
  const path: string[] = [];
  for (let c: string | null = to; c; c = prev.get(c) ?? null) path.unshift(c);
  return path;
}

/**
 * Minimum moves to land on every fruit (any order). Fruits are collected by landing on them.
 * Travelling fruit-to-fruit along BFS shortest paths is optimal, so a TSP over fruits suffices.
 */
export function solve(level: FruitLevel): Solution {
  const rocks = new Set(level.rocks ?? []);
  const fruits = [...new Set(level.fruits)].filter((f) => f !== level.start);
  const n = fruits.length;
  if (n === 0) return { moves: 0, order: [], path: [level.start] };
  if (n > 14) throw new Error('Demasiadas frutas (máx. 14)');

  const nodes = [level.start, ...fruits];
  const d: number[][] = nodes.map((a) => {
    const m = distances(level.piece, a, rocks);
    return nodes.map((b) => m.get(b) ?? Infinity);
  });

  const FULL = (1 << n) - 1;
  const dp: number[][] = Array.from({ length: 1 << n }, () => new Array(n).fill(Infinity));
  const parent: number[][] = Array.from({ length: 1 << n }, () => new Array(n).fill(-1));
  for (let i = 0; i < n; i++) dp[1 << i][i] = d[0][i + 1];
  for (let mask = 1; mask <= FULL; mask++) {
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i)) || dp[mask][i] === Infinity) continue;
      for (let j = 0; j < n; j++) {
        if (mask & (1 << j)) continue;
        const nm = mask | (1 << j);
        const v = dp[mask][i] + d[i + 1][j + 1];
        if (v < dp[nm][j]) { dp[nm][j] = v; parent[nm][j] = i; }
      }
    }
  }
  let best = Infinity, last = -1;
  for (let i = 0; i < n; i++) if (dp[FULL][i] < best) { best = dp[FULL][i]; last = i; }
  if (best === Infinity) return { moves: Infinity, order: [], path: [] };

  const orderIdx: number[] = [];
  let mask = FULL, cur = last;
  while (cur !== -1) {
    orderIdx.unshift(cur);
    const p = parent[mask][cur];
    mask &= ~(1 << cur);
    cur = p;
  }
  const order = orderIdx.map((i) => fruits[i]);
  const path: string[] = [level.start];
  let at = level.start;
  for (const f of order) {
    path.push(...bfsPath(level.piece, at, f, rocks).slice(1));
    at = f;
  }
  return { moves: best, order, path };
}

export function fruitStars(moves: number, optimal: number): number {
  if (moves <= optimal) return 3;
  if (moves <= optimal + 2) return 2;
  return 1;
}

export function validateLevel(l: FruitLevel): string[] {
  const errs: string[] = [];
  if (!['N', 'B', 'R', 'Q', 'K'].includes(l.piece)) errs.push('Pieza no válida');
  if (!isSquare(l.start)) errs.push('Casilla de salida no válida');
  if (!l.fruits?.length) errs.push('Pon al menos una fruta');
  for (const f of l.fruits ?? []) if (!isSquare(f)) errs.push(`Casilla de fruta no válida: ${f}`);
  for (const r of l.rocks ?? []) if (!isSquare(r)) errs.push(`Casilla de roca no válida: ${r}`);
  if (!errs.length) {
    if ((l.rocks ?? []).includes(l.start)) errs.push('La pieza no puede empezar sobre una roca');
    if (l.fruits.some((f) => (l.rocks ?? []).includes(f))) errs.push('Una fruta está sobre una roca');
    if (l.piece === 'B') {
      const [sx, sy] = sqToXY(l.start);
      if (l.fruits.some((f) => { const [x, y] = sqToXY(f); return (x + y) % 2 !== (sx + sy) % 2; }))
        errs.push('El alfil nunca cambia de color de casilla: hay frutas inalcanzables');
    }
    if (!errs.length && solve(l).moves === Infinity) errs.push('Hay frutas imposibles de alcanzar');
  }
  return errs;
}
