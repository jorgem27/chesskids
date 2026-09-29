import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { useMemo, useRef, useState } from 'preact/hooks';
import { burst } from '../../lib/fx';
import { sfx } from '../../lib/sfx';
import { Board } from '../chess/Board';
import type { FruitContent } from '../meta';
import type { PlayerProps } from '../types';
import { FRUITS, PIECE_NAMES, fruitStars, pieceMoves, solve, sqToXY, type FruitLevel } from './logic';

const ROLE: Record<string, string> = { N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K' };

export function placementFen(piece: string, sq: string): string {
  const [x, y] = sqToXY(sq);
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    if (r !== y) { rows.push('8'); continue; }
    rows.push(`${x ? x : ''}${ROLE[piece]}${7 - x ? 7 - x : ''}`);
  }
  return rows.join('/');
}

export function SquareOverlay({ items }: { items: { sq: string; emoji: string; cls?: string; key?: string }[] }) {
  return (
    <div class="pointer-events-none absolute inset-0 z-[3]">
      {items.map((it) => {
        const [x, y] = sqToXY(it.sq);
        return (
          <div key={it.key ?? it.sq} class={`absolute flex items-center justify-center ${it.cls ?? ''}`}
            style={{ left: `${x * 12.5}%`, top: `${(7 - y) * 12.5}%`, width: '12.5%', height: '12.5%', fontSize: 'min(6.5vw, 5vh)' }}>
            {it.emoji}
          </div>
        );
      })}
    </div>
  );
}

export function FruitPlayer({ content, api }: PlayerProps<FruitContent>) {
  const levels = content.levels;
  const cg = useRef<Api | null>(null);
  const [li, setLi] = useState(0);
  const [pos, setPos] = useState(levels[0].start);
  const [left, setLeft] = useState<string[]>(levels[0].fruits);
  const [moves, setMoves] = useState(0);
  const [popping, setPopping] = useState<string | null>(null);
  const [done, setDone] = useState<null | { stars: number }>(null);
  const [glow, setGlow] = useState(0);
  const st = useRef({ li: 0, pos: levels[0].start, left: [...levels[0].fruits], moves: 0, score: 0, perfect: 0, bestStars: [] as number[] });
  const level: FruitLevel = levels[li];
  const optimal = useMemo(() => solve(level).moves, [li]);
  const fruitEmoji = useMemo(() => Object.fromEntries(level.fruits.map((f, i) => [f, FRUITS[(i + li * 3) % FRUITS.length]])), [li]);

  function dests(from: string, lvl: FruitLevel) {
    return new Map<Key, Key[]>([[from as Key, pieceMoves(lvl.piece, from, new Set(lvl.rocks ?? [])) as Key[]]]);
  }

  function setup(i: number) {
    const lvl = levels[i];
    const s = st.current;
    s.li = i; s.pos = lvl.start; s.left = [...lvl.fruits.filter((f) => f !== lvl.start)]; s.moves = 0;
    setLi(i); setPos(lvl.start); setLeft(s.left); setMoves(0); setDone(null);
    api.progress(i, levels.length);
    cg.current?.set({
      fen: placementFen(lvl.piece, lvl.start),
      lastMove: undefined,
      turnColor: 'white',
      movable: { free: false, color: 'white', dests: dests(lvl.start, lvl), showDests: true },
    });
    const name = PIECE_NAMES[lvl.piece].toLowerCase();
    api.say(`Mueve ${lvl.piece === 'R' || lvl.piece === 'Q' ? 'la' : 'el'} ${name} y recoge toda la fruta. ¡Intenta hacerlo en ${solve(lvl).moves} movimientos!`, { speak: api.ageGroup === 'peque' });
  }

  function onMove(_o: Key, dest: Key) {
    const s = st.current;
    const lvl = levels[s.li];
    s.moves++;
    s.pos = dest;
    setMoves(s.moves);
    setPos(dest);
    if (s.left.includes(dest)) {
      s.left = s.left.filter((f) => f !== dest);
      setLeft(s.left);
      setPopping(dest);
      setTimeout(() => setPopping(null), 450);
      sfx.coin();
    } else sfx.move();

    if (!s.left.length) {
      cg.current!.set({ movable: { color: undefined, dests: new Map() } });
      const opt = solve(lvl).moves;
      const stars = fruitStars(s.moves, opt);
      s.bestStars[s.li] = Math.max(s.bestStars[s.li] ?? 0, stars);
      setDone({ stars });
      setGlow((g) => g + 1);
      if (stars === 3) {
        api.good(`¡Camino perfecto! ${s.moves} movimientos 🏆`, { big: true });
        burst(0.5, 0.5, 1.2);
        setTimeout(() => nextLevel(), 1800);
      } else {
        api.say(`¡Lo lograste en ${s.moves} movimientos! Se puede en ${opt}. ¿Lo intentas otra vez para las 3 estrellas?`, { speak: api.ageGroup === 'peque' });
        sfx.correct();
      }
      return;
    }
    cg.current!.set({ turnColor: 'white', movable: { color: 'white', dests: dests(dest, lvl) } });
  }

  function nextLevel() {
    const s = st.current;
    const i = s.li;
    if (i + 1 >= levels.length) {
      const stars = levels.map((_, k) => s.bestStars[k] ?? 0);
      api.progress(levels.length, levels.length);
      api.finish({
        score: stars.reduce((a, b) => a + b, 0),
        maxScore: levels.length * 3,
        mistakes: stars.filter((x) => x < 3).length,
        puzzlesSolved: levels.length,
        perfect: stars.filter((x) => x === 3).length,
      });
    } else setup(i + 1);
  }

  const ready = (a: Api) => {
    cg.current = a;
    a.set({ movable: { events: { after: onMove } }, highlight: { lastMove: true, check: false }, drawable: { enabled: false } });
    setup(0);
  };

  const overlay = [
    ...(level.rocks ?? []).map((r) => ({ sq: r, emoji: '🪨', key: 'r' + r })),
    ...left.map((f) => ({ sq: f, emoji: fruitEmoji[f], cls: 'animate-[ck-bob_1.6s_ease-in-out_infinite]', key: 'f' + f })),
    ...(popping ? [{ sq: popping, emoji: '✨', cls: 'animate-[ck-pop-out_.45s_ease-out_forwards]', key: 'p' + popping }] : []),
  ];

  return (
    <div class="flex w-full flex-col items-center gap-3">
      <div class="flex w-full max-w-[min(92vw,66vh)] flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-600">
        <span class="rounded-full bg-white/80 px-3 py-1 shadow-sm">🗺️ Nivel {li + 1}/{levels.length}</span>
        <span class="rounded-full bg-white/80 px-3 py-1 shadow-sm">🧺 {level.fruits.length - left.length}/{level.fruits.length}</span>
        <span class={`rounded-full px-3 py-1 shadow-sm tabular-nums ${moves > optimal ? 'bg-amber-100 text-amber-700' : 'bg-white/80'}`}>👣 {moves} · 🎯 {optimal}</span>
      </div>
      <div class="w-full max-w-[min(92vw,66vh)]">
        <Board config={{ fen: placementFen(levels[0].piece, levels[0].start), orientation: 'white', coordinates: true }} onReady={ready} glow={glow}>
          <SquareOverlay items={overlay} />
        </Board>
      </div>
      <div class="flex h-16 items-center gap-3">
        {!done && moves > 0 && (
          <button class="ck-btn bg-white text-slate-600" onClick={() => { sfx.whoosh(); setup(li); }}>↺ Empezar de nuevo</button>
        )}
        {done && done.stars < 3 && (
          <>
            <button class="ck-btn bg-white text-slate-700" onClick={() => { sfx.whoosh(); setup(li); }}>↺ Intentar 3 ⭐</button>
            <button class="ck-btn ck-btn-primary" onClick={() => nextLevel()}>Siguiente ▶</button>
          </>
        )}
      </div>
      <span class="sr-only">{pos}</span>
    </div>
  );
}
