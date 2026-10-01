import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { Chess } from 'chess.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { burst } from '../../lib/fx';
import { sfx, vibrate } from '../../lib/sfx';
import { Board, isPromotion, syncBoard } from '../chess/Board';
import { applyUci } from '../puzzle/logic';
import { itemTracker } from '../items';
import type { PlayerProps } from '../types';
import type { BotContent } from '../meta';
import { BotEngine } from './engine';
import { hasExplanation, LEVELS, outcome, starsForMoves } from './logic';
import { Notebook } from './Notebook';

const BOT_MIN_DELAY = 450; // even when the engine answers instantly, give the kid a moment to see their move

export function BotPlayer({ content, api }: PlayerProps<BotContent>) {
  const positions = content.positions;
  const cg = useRef<Api | null>(null);
  const engine = useRef<BotEngine | null>(null);
  const chess = useRef(new Chess(positions[0].fen));
  const tracker = useRef(itemTracker());
  const st = useRef({ idx: 0, moves: 0, hints: 0, fails: 0, busy: false, over: false, alive: true, bestStars: [] as number[], totalFails: 0, solved: 0 });
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'explain' | 'play'>(hasExplanation(positions[0]) ? 'explain' : 'play');
  const [moves, setMoves] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [end, setEnd] = useState<null | { kind: 'win' | 'fail'; stars: number; text: string }>(null);
  const [shake, setShake] = useState(0);
  const [glow, setGlow] = useState(0);
  const pos = positions[idx];
  // Chessground handlers are registered once, so they read the live position from the ref, not from render state.
  const live = () => positions[st.current.idx];
  const colorOf = (p: { fen: string }): 'white' | 'black' => (p.fen.split(' ')[1] === 'b' ? 'black' : 'white');

  useEffect(() => {
    engine.current = new BotEngine(); // start downloading/booting Stockfish while the kid reads the notebook
    st.current.alive = true;
    return () => { st.current.alive = false; engine.current?.destroy(); };
  }, []);

  function load(i: number, showNotebook: boolean) {
    const s = st.current;
    const p = positions[i];
    s.idx = i; s.moves = 0; s.hints = 0; s.busy = false; s.over = false;
    chess.current = new Chess(p.fen);
    tracker.current.start();
    setIdx(i); setMoves(0); setEnd(null); setThinking(false);
    api.progress(i, positions.length);
    if (showNotebook && hasExplanation(p)) setPhase('explain');
    else setPhase('play');
    cg.current?.setAutoShapes([]);
    if (cg.current) {
      cg.current.set({ orientation: colorOf(p) });
      syncBoard(cg.current, chess.current, { movable: colorOf(p) });
    }
    api.say(p.prompt?.trim() || 'Da jaque mate al bot 🤖 ¡Tú juegas primero!', { speak: api.ageGroup === 'peque' });
  }

  function finishPosition(kind: 'win' | 'fail', text: string) {
    const s = st.current;
    const pos = live();
    s.over = true;
    cg.current?.set({ movable: { color: undefined, dests: new Map() } });
    if (kind === 'win') {
      const stars = Math.max(1, starsForMoves(s.moves, pos.parMoves) - (s.hints > 0 ? 1 : 0));
      s.bestStars[s.idx] = Math.max(s.bestStars[s.idx] ?? 0, stars);
      tracker.current.done(s.idx, stars === 3, 3 - stars);
      s.solved++;
      setGlow((g) => g + 1);
      setEnd({ kind, stars, text });
      if (stars === 3) { api.good(text, { big: true }); burst(0.5, 0.5, 1.2); setTimeout(() => s.alive && s.over && next(), 2200); }
      else { api.good(text); api.say(`${text} Con ${pos.parMoves} jugadas se consiguen las 3 estrellas. ¿Lo intentas otra vez?`); }
    } else {
      s.totalFails++;
      s.fails++;
      tracker.current.done(s.idx, false, 1);
      setShake((x) => x + 1);
      vibrate(120);
      setEnd({ kind, stars: 0, text });
      api.bad(text);
    }
  }

  function next() {
    const s = st.current;
    if (s.idx + 1 >= positions.length) {
      const stars = positions.map((_, k) => s.bestStars[k] ?? 0);
      api.progress(positions.length, positions.length);
      api.finish({
        score: stars.reduce((a, b) => a + b, 0),
        maxScore: positions.length * 3,
        mistakes: s.totalFails,
        puzzlesSolved: stars.filter((x) => x > 0).length,
        perfect: stars.filter((x) => x === 3).length,
        items: tracker.current.list(positions.length),
      });
    } else { s.fails = 0; load(s.idx + 1, true); }
  }

  /** After a move by either side: is the game over? (the student is checked from their own point of view) */
  function judge(): boolean {
    const o = outcome(chess.current, colorOf(live()) === 'white' ? 'w' : 'b');
    if (o === 'win') { finishPosition('win', '¡JAQUE MATE! 🎉 ¡Lo has conseguido!'); return true; }
    if (o === 'lose') { finishPosition('fail', '¡Ay! El bot te ha dado mate. ¡Otra vez! 💪'); return true; }
    if (o === 'draw') {
      const stale = chess.current.isStalemate();
      finishPosition('fail', stale ? '¡Ahogado! El rey no puede moverse pero no está en jaque: son tablas 🤝. ¡Cuidado con eso!' : 'Son tablas 🤝. ¡Otra vez, tú puedes!');
      return true;
    }
    return false;
  }

  async function botReply() {
    const s = st.current;
    const at = s.idx;
    s.busy = true;
    setThinking(true);
    const t0 = Date.now();
    const uci = await engine.current!.bestMove(chess.current.fen(), live().level);
    const wait = Math.max(0, BOT_MIN_DELAY - (Date.now() - t0));
    await new Promise((r) => setTimeout(r, wait));
    if (!s.alive || s.over || s.idx !== at) return;
    setThinking(false);
    if (uci) {
      const m = applyUci(chess.current, uci);
      m?.captured ? sfx.capture() : sfx.move();
      syncBoard(cg.current!, chess.current, { movable: null, lastMove: uci });
    }
    if (judge()) return;
    s.busy = false;
    syncBoard(cg.current!, chess.current, { movable: colorOf(live()), lastMove: uci ?? undefined });
    if (chess.current.inCheck()) api.say('¡Estás en jaque! Protege a tu rey 👑');
  }

  function onMove(orig: Key, dest: Key) {
    const s = st.current;
    const pos = live();
    if (s.busy || s.over) return;
    let uci = orig + dest;
    if (isPromotion(chess.current, orig, dest)) uci += 'q';
    const m = applyUci(chess.current, uci);
    if (!m) { syncBoard(cg.current!, chess.current, { movable: colorOf(pos) }); return; }
    m.captured ? sfx.capture() : sfx.move();
    s.moves++;
    setMoves(s.moves);
    cg.current!.setAutoShapes([]);
    syncBoard(cg.current!, chess.current, { movable: null, lastMove: uci });
    if (judge()) return;
    if (s.moves >= pos.maxMoves) { finishPosition('fail', `¡Se acabaron las ${pos.maxMoves} jugadas! ⏰ Prueba otra vez con más calma.`); return; }
    void botReply();
  }

  async function hint() {
    const s = st.current;
    if (s.busy || s.over) return;
    s.busy = true;
    sfx.hint();
    setThinking(true);
    const uci = await engine.current!.bestMove(chess.current.fen(), 'strong');
    if (!s.alive || s.over) return;
    setThinking(false);
    s.busy = false;
    s.hints++;
    if (uci) cg.current!.setAutoShapes([{ orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush: 'green' }]);
    api.say('💡 Sigue la flecha verde. (Con pista te llevas una estrella menos)');
  }

  function undo() {
    const s = st.current;
    if (s.busy || s.over || !s.moves) return;
    sfx.whoosh();
    chess.current.undo(); // bot's reply
    chess.current.undo(); // my move
    s.moves--;
    setMoves(s.moves);
    cg.current!.setAutoShapes([]);
    syncBoard(cg.current!, chess.current, { movable: colorOf(live()) });
  }

  const ready = (a: Api) => {
    cg.current = a;
    a.set({ movable: { events: { after: onMove } }, highlight: { lastMove: true, check: true } });
    load(0, true);
  };

  const lastPos = idx + 1 >= positions.length;
  const left = Math.max(0, pos.maxMoves - moves);

  return (
    <div class="flex w-full flex-col items-center gap-3">
      {phase === 'explain' && (
        <div class="w-full">
          <Notebook key={idx} position={pos} onDone={() => { setPhase('play'); }} onSkip={() => setPhase('play')} />
        </div>
      )}
      <div class={phase === 'explain' ? 'hidden' : 'flex w-full flex-col items-center gap-3'}>
        <div class="flex w-full max-w-[min(92vw,66vh)] flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-600">
          <span class="rounded-full bg-white/80 px-3 py-1 shadow-sm">🤖 {positions.length > 1 ? `${idx + 1}/${positions.length} · ` : ''}{LEVELS[pos.level].emoji} {LEVELS[pos.level].label}</span>
          <span class={`rounded-full px-3 py-1 tabular-nums shadow-sm ${left <= 3 ? 'animate-pulse bg-rose-100 text-rose-700' : 'bg-white/80'}`}>👣 {moves} · quedan {left}</span>
        </div>
        <div class="relative w-full max-w-[min(92vw,66vh)]">
          <Board config={{ fen: positions[0].fen, coordinates: true }} onReady={ready} shake={shake} glow={glow} />
          {thinking && (
            <span class="absolute left-1/2 top-2 z-[5] -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1 text-sm font-bold text-white">🤖 pensando…</span>
          )}
        </div>
        <div class="flex min-h-16 flex-wrap items-center justify-center gap-3">
          {!end && (
            <>
              {hasExplanation(pos) && <button class="ck-btn-sm" onClick={() => { sfx.tap(); setPhase('explain'); }}>📓 Mi cuaderno</button>}
              <button class="ck-btn-sm" disabled={thinking || !moves} onClick={undo}>↩ Deshacer</button>
              <button class="ck-btn-sm" disabled={thinking} onClick={hint}>💡 Pista</button>
              {moves > 0 && <button class="ck-btn-sm" onClick={() => { sfx.whoosh(); load(idx, false); }}>↺ Reiniciar</button>}
            </>
          )}
          {end?.kind === 'win' && (
            <>
              <div class="flex gap-1 text-4xl" aria-label={`${end.stars} estrellas`}>
                {[0, 1, 2].map((i) => <span key={i} class={i < end.stars ? '' : 'opacity-25 grayscale'} style={i < end.stars ? `animation: ck-pop .4s ${i * 0.15}s both` : ''}>⭐</span>)}
              </div>
              {end.stars < 3 && <button class="ck-btn bg-white text-slate-700" onClick={() => load(idx, false)}>↺ Intentar 3 ⭐</button>}
              <button class="ck-btn ck-btn-primary" onClick={() => next()}>{lastPos ? 'Terminar 🏁' : 'Siguiente ▶'}</button>
            </>
          )}
          {end?.kind === 'fail' && (
            <>
              <button class="ck-btn ck-btn-primary" onClick={() => { sfx.whoosh(); load(idx, false); }}>↺ Intentar otra vez</button>
              {st.current.fails >= 3 && <button class="ck-btn-sm" onClick={() => next()}>{lastPos ? 'Terminar' : 'Saltar ▶'}</button>}
              {hasExplanation(pos) && <button class="ck-btn-sm" onClick={() => setPhase('explain')}>📓 Repasar</button>}
            </>
          )}
        </div>
        {end && <p class={`max-w-md text-center font-bold ${end.kind === 'win' ? 'text-emerald-700' : 'text-amber-700'}`}>{end.text}</p>}
      </div>
    </div>
  );
}
