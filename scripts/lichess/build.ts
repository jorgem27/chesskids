/**
 * Builds a curated subset of the Lichess puzzle database as chunked SQL files in seed/lichess/.
 *
 *   npm run puzzles:build -- path/to/lichess_db_puzzle.csv[.zst]
 *
 * See scripts/lichess/README.md.
 */
import { createReadStream, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';
import { fromLichess } from '../../src/games/puzzle/logic';
import { ELO_MAX, ELO_MIN, LICHESS_THEME_KEYS } from '../../src/lib/lichessThemes';

const MIN_POPULARITY = 80;
const MIN_PLAYS = 300;
const MAX_DEVIATION = 90;
const MAX_MOVES = 9; // opponent's setup move + at most 4 student moves
const PER_BUCKET = 300; // puzzles per (theme, 100-Elo bucket)
const ROWS_PER_INSERT = 50;
const ROWS_PER_FILE = 20000;
const OUT = new URL('../../seed/lichess/', import.meta.url);

const src = process.argv[2];
if (!src) {
  console.error('Uso: npm run puzzles:build -- ruta/a/lichess_db_puzzle.csv[.zst]');
  process.exit(1);
}

const input = src.endsWith('.zst') ? createReadStream(src).pipe(createZstdDecompress()) : createReadStream(src);
const buckets = new Map<string, number>();
const puzzles: string[] = [];
const themeRows: string[] = [];
let seen = 0;

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

for await (const line of createInterface({ input, crlfDelay: Infinity })) {
  if (!line || line.startsWith('PuzzleId')) continue;
  if (++seen % 500000 === 0) console.log(`${seen} leídos, ${puzzles.length} elegidos`);
  const [id, fen, movesStr, ratingS, devS, popS, playsS, themesStr] = line.split(',');
  const rating = Number(ratingS);
  if (![rating, Number(devS), Number(popS), Number(playsS)].every(Number.isFinite) || !themesStr) continue;
  if (rating < ELO_MIN || rating > ELO_MAX) continue;
  if (Number(devS) > MAX_DEVIATION || Number(popS) < MIN_POPULARITY || Number(playsS) < MIN_PLAYS) continue;
  const moves = movesStr.split(' ');
  if (moves.length > MAX_MOVES) continue;

  // Tag the puzzle only under themes whose bucket still has room, so every cap is exact.
  // The file is ordered by random id, so "first that fits" is a fair sample.
  const bucket = Math.floor(rating / 100);
  const tags = ['mix', ...themesStr.split(' ').filter((t) => LICHESS_THEME_KEYS.has(t))]
    .filter((t) => (buckets.get(`${t}:${bucket}`) ?? 0) < PER_BUCKET);
  if (!tags.length || !fromLichess(fen, moves)) continue;

  for (const t of tags) buckets.set(`${t}:${bucket}`, (buckets.get(`${t}:${bucket}`) ?? 0) + 1);
  puzzles.push(`(${q(id)},${q(fen)},${q(movesStr)},${rating},${Number(popS)},${q(tags.join(' '))})`);
  for (const t of tags) themeRows.push(`(${q(t)},${rating},${q(id)})`);
}

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.sql')) rmSync(new URL(f, OUT));

// INSERT OR REPLACE keeps the load idempotent: a failed or repeated load can simply be re-run.
const statements: string[] = [];
for (let i = 0; i < puzzles.length; i += ROWS_PER_INSERT) {
  statements.push(`INSERT OR REPLACE INTO lichess_puzzles (id, fen, moves, rating, popularity, themes) VALUES ${puzzles.slice(i, i + ROWS_PER_INSERT).join(',')};`);
}
for (let i = 0; i < themeRows.length; i += ROWS_PER_INSERT) {
  statements.push(`INSERT OR REPLACE INTO lichess_puzzle_themes (theme, rating, puzzle_id) VALUES ${themeRows.slice(i, i + ROWS_PER_INSERT).join(',')};`);
}

const perFile = ROWS_PER_FILE / ROWS_PER_INSERT;
let n = 0;
for (let i = 0; i < statements.length; i += perFile) {
  writeFileSync(new URL(`${String(++n).padStart(3, '0')}.sql`, OUT), statements.slice(i, i + perFile).join('\n') + '\n');
}

const perTheme = new Map<string, number>();
for (const [k, v] of buckets) perTheme.set(k.split(':')[0], (perTheme.get(k.split(':')[0]) ?? 0) + v);
console.log(`\n${seen} puzzles leídos → ${puzzles.length} elegidos, ${themeRows.length} filas de temas, ${n} ficheros en seed/lichess/`);
console.table(Object.fromEntries([...perTheme].sort((a, b) => b[1] - a[1])));
