// Interactive boards for the chat: solve a shared puzzle, replay a shared game, build a game to send.
// Loaded with import() only when a kid opens one, so the chat page itself stays light.
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { Chess } from 'chess.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Board, isPromotion, syncBoard, turnColor } from '../../games/chess/Board';
import { applyUci, judgeMove } from '../../games/puzzle/logic';
import { ALMOST_TEXT } from '../../games/rules';
import { burst } from '../../lib/fx';
import { sfx, vibrate } from '../../lib/sfx';
import { parsePastedChess, sideToMove, START_FEN, type ChatGame, type ChatPuzzle } from '../../lib/chat';

const key = (s: string) => s as Key;
const sideName = (fen: string) => (sideToMove(fen) === 'w' ? 'blancas' : 'negras');
// The boards open inside a Modal that pops in with a scale animation: Chessground measures itself
// while scaled down, so redraw once the board is shown at its real size.
function redrawAfterPop(a: Api, frames = 0) {
  const wrap = a.state.dom.elements.wrap;
  if (Math.abs(wrap.getBoundingClientRect().width - wrap.offsetWidth) < 1) { a.redrawAll(); return; }
  if (frames < 300) requestAnimationFrame(() => redrawAfterPop(a, frames + 1));
}

// ---------- Solve a puzzle ----------

export function PuzzleSolver({ puzzle }: { puzzle: ChatPuzzle }) {
  const cg = useRef<Api | null>(null);
  const chess = useRef(new Chess(puzzle.fen));
  const st = useRef({ ply: 0, wrong: 0, locked: false });
  const color = sideToMove(puzzle.fen) === 'w' ? 'white' : 'black';
  const [msg, setMsg] = useState(puzzle.prompt ? `${puzzle.prompt} · Juegan ${sideName(puzzle.fen)}` : `Juegan ${sideName(puzzle.fen)}. ¡Encuentra la mejor jugada!`);
  const [done, setDone] = useState<'' | 'solved' | 'shown'>('');
  const [shake, setShake] = useState(0);
  const [glow, setGlow] = useState(0);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  function play(s: typeof st.current, uci: string) {
    const m = applyUci(chess.current, uci);
    m?.captured ? sfx.capture() : sfx.move();
    s.ply++;
  }

  function reply() {
    const s = st.current;
    s.locked = true;
    timer.current = window.setTimeout(() => {
      const r = puzzle.moves[s.ply];
      play(s, r);
      syncBoard(cg.current!, chess.current, { movable: color, lastMove: r });
      s.locked = false;
    }, 550);
  }

  function onMove(orig: string, dest: string) {
    const s = st.current;
    if (s.locked) return;
    const expected = puzzle.moves[s.ply];
    if (!expected) return;
    const fen = chess.current.fen();
    let uci = orig + dest;
    if (isPromotion(chess.current, orig, dest)) uci += expected.startsWith(uci) && expected.length > 4 ? expected[4] : 'q';
    const verdict = judgeMove(puzzle, s.ply / 2, fen, uci);
    if (verdict.kind === 'almost') {
      // "Not the best" per the coach: try again, no mistake.
      sfx.hint();
      setMsg(verdict.rule.text || ALMOST_TEXT);
      syncBoard(cg.current!, chess.current, { movable: color });
      return;
    }
    if (verdict.kind === 'good') {
      // A coach-approved alternative: praise it, then continue along the recorded solution.
      setMsg(verdict.rule.text || '¡Buena jugada! También vale 👍');
      sfx.correct();
    }
    if (verdict.kind === 'best' || verdict.kind === 'good') {
      const toPlay = verdict.kind === 'good' || uci.slice(0, 4) === expected.slice(0, 4) ? expected : uci; // a different mate also counts
      play(s, toPlay);
      cg.current!.setAutoShapes([]);
      syncBoard(cg.current!, chess.current, { movable: null, lastMove: toPlay });
      if (s.ply >= puzzle.moves.length || chess.current.isCheckmate()) {
        s.locked = true;
        setDone('solved');
        setMsg('¡Resuelto! ¡Eres un crack! 🎉');
        setGlow((g) => g + 1);
        sfx.correct();
        burst();
        return;
      }
      if (verdict.kind === 'best') setMsg('¡Bien! 👍 Sigue…');
      reply();
      return;
    }
    s.wrong++;
    vibrate(120);
    sfx.wrong();
    setShake((x) => x + 1);
    syncBoard(cg.current!, chess.current, { movable: color });
    if (s.wrong === 1) {
      cg.current!.setAutoShapes([{ orig: key(expected.slice(0, 2)), brush: 'yellow' }]);
      setMsg('¡Casi! Prueba con la pieza marcada 👀');
    } else {
      cg.current!.setAutoShapes([{ orig: key(expected.slice(0, 2)), dest: key(expected.slice(2, 4)), brush: 'green' }]);
      setMsg('¡Sigue la flecha! ➡️');
    }
  }

  function showSolution() {
    const s = st.current;
    clearTimeout(timer.current);
    s.locked = true;
    setDone('shown');
    setMsg('Así se resuelve 👇');
    cg.current!.setAutoShapes([]);
    const step = () => {
      if (s !== st.current || s.ply >= puzzle.moves.length) return; // restarted, or finished
      const uci = puzzle.moves[s.ply];
      play(s, uci);
      syncBoard(cg.current!, chess.current, { movable: null, lastMove: uci });
      timer.current = window.setTimeout(step, 800);
    };
    step();
  }

  function restart() {
    clearTimeout(timer.current);
    chess.current = new Chess(puzzle.fen);
    st.current = { ply: 0, wrong: 0, locked: false };
    setDone('');
    setMsg(`Juegan ${sideName(puzzle.fen)}. ¡Otra vez!`);
    cg.current!.setAutoShapes([]);
    syncBoard(cg.current!, chess.current, { movable: color });
  }

  const ready = (a: Api) => {
    cg.current = a;
    redrawAfterPop(a);
    a.set({ orientation: color, movable: { events: { after: (o: Key, d: Key) => onMove(o, d) } } });
    syncBoard(a, chess.current, { movable: color });
  };

  return (
    <div>
      <p class={`mb-3 rounded-2xl px-4 py-3 text-center font-display text-lg font-extrabold ${done === 'solved' ? 'bg-emerald-100 text-emerald-800' : 'bg-brand-50 text-brand-800'}`} aria-live="polite">{msg}</p>
      <div class="mx-auto max-w-sm"><Board config={{ fen: puzzle.fen }} onReady={ready} shake={shake} glow={glow} /></div>
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        {done ? <button type="button" class="ck-btn ck-btn-primary" onClick={restart}>🔁 Otra vez</button>
          : <button type="button" class="ck-btn-sm min-h-11" onClick={showSolution}>👀 Ver solución</button>}
      </div>
      <p class="mt-3 text-center text-xs font-bold text-slate-500">Los problemas del chat no dan XP… ¡pero te hacen más listo! 🧠</p>
    </div>
  );
}

// ---------- Replay a game / look at a position ----------

function replay(game: ChatGame) {
  const c = new Chess(game.start);
  const fens = [c.fen()];
  const sans: string[] = [];
  for (const u of game.moves) {
    const m = applyUci(c, u);
    if (!m) break;
    sans.push(m.san);
    fens.push(c.fen());
  }
  return { fens, sans };
}

export function GameViewer({ game }: { game: ChatGame }) {
  const { fens, sans } = useMemo(() => replay(game), [game]);
  const cg = useRef<Api | null>(null);
  const [ply, setPly] = useState(sans.length);
  const [flip, setFlip] = useState(false);
  const firstNumber = Number(game.start.split(' ')[5]) || 1;
  const blackFirst = sideToMove(game.start) === 'b';

  function go(p: number) {
    const n = Math.max(0, Math.min(sans.length, p));
    if (n === ply) return;
    setPly(n);
    const u = n > 0 ? game.moves[n - 1] : '';
    cg.current?.set({ fen: fens[n], lastMove: u ? [key(u.slice(0, 2)), key(u.slice(2, 4))] : undefined, check: new Chess(fens[n]).inCheck() });
    sfx.move();
  }

  function toggleFlip() {
    setFlip((f) => !f);
    cg.current?.toggleOrientation();
  }

  const ready = (a: Api) => {
    cg.current = a;
    redrawAfterPop(a);
    const u = game.moves.at(-1);
    a.set({ viewOnly: true, fen: fens[ply], lastMove: u ? [key(u.slice(0, 2)), key(u.slice(2, 4))] : undefined, check: new Chess(fens[ply]).inCheck() });
  };

  return (
    <div>
      <div class="mx-auto max-w-sm"><Board config={{ fen: game.fen, viewOnly: true }} onReady={ready} /></div>
      {sans.length > 0 && (
        <div class="mt-3 flex items-center justify-center gap-2">
          <button type="button" class="ck-btn-sm min-h-11 min-w-11" onClick={() => go(0)} aria-label="Al principio">⏮</button>
          <button type="button" class="ck-btn ck-btn-primary min-w-14" onClick={() => go(ply - 1)} aria-label="Jugada anterior">◀</button>
          <span class="w-16 text-center font-display font-extrabold tabular-nums">{ply}/{sans.length}</span>
          <button type="button" class="ck-btn ck-btn-primary min-w-14" onClick={() => go(ply + 1)} aria-label="Jugada siguiente">▶</button>
          <button type="button" class="ck-btn-sm min-h-11 min-w-11" onClick={() => go(sans.length)} aria-label="Al final">⏭</button>
        </div>
      )}
      <div class="mt-3 flex flex-wrap justify-center gap-1 text-sm">
        {sans.map((san, i) => {
          const abs = i + (blackFirst ? 1 : 0);
          const num = abs % 2 === 0 ? `${firstNumber + abs / 2}.` : i === 0 ? `${firstNumber}…` : '';
          return (
            <button key={i} type="button" onClick={() => go(i + 1)}
              class={`min-h-11 rounded-lg px-2 font-bold ${ply === i + 1 ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {num && <span class="mr-0.5 opacity-60">{num}</span>}{san}
            </button>
          );
        })}
      </div>
      <p class="mt-3 text-center"><button type="button" class="ck-btn-sm min-h-11" onClick={toggleFlip} aria-pressed={flip}>🔃 Girar tablero</button></p>
    </div>
  );
}

// ---------- Build a game / position to send ----------

export function GameBuilder({ onSend, busy }: { onSend: (g: { start: string; moves: string[] }) => void; busy?: boolean }) {
  const cg = useRef<Api | null>(null);
  const chess = useRef(new Chess());
  const start = useRef(START_FEN);
  const moves = useRef<string[]>([]);
  const [count, setCount] = useState(0);
  const [paste, setPaste] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState('');

  function sync(last?: string) {
    syncBoard(cg.current!, chess.current, { movable: turnColor(chess.current), lastMove: last });
    setCount(moves.current.length);
  }

  function onMove(orig: string, dest: string) {
    let uci = orig + dest;
    if (isPromotion(chess.current, orig, dest)) uci += 'q';
    const m = applyUci(chess.current, uci);
    if (!m) { sync(); return; }
    m.captured ? sfx.capture() : sfx.move();
    moves.current.push(uci);
    sync(uci);
  }

  function load(fen: string, list: string[]) {
    start.current = fen;
    chess.current = new Chess(fen);
    moves.current = [];
    for (const u of list) if (applyUci(chess.current, u)) moves.current.push(u);
    sync(moves.current.at(-1));
  }

  function undo() {
    if (!moves.current.length) return;
    load(start.current, moves.current.slice(0, -1));
    sfx.tap();
  }

  function loadPaste() {
    const g = parsePastedChess(paste ?? '');
    if (!g) { setPasteError('No entiendo esa partida 🤔 Copia el PGN o el FEN completo.'); return; }
    setPasteError('');
    setPaste(null);
    load(g.start, g.moves);
    sfx.pop();
  }

  const ready = (a: Api) => {
    cg.current = a;
    redrawAfterPop(a);
    a.set({ movable: { events: { after: (o: Key, d: Key) => onMove(o, d) } } });
    sync();
  };

  const turn = sideToMove(chess.current.fen()) === 'w' ? 'blancas' : 'negras';

  return (
    <div>
      <p class="mb-3 rounded-2xl bg-brand-50 px-4 py-3 text-center text-sm font-bold text-brand-800">
        Mueve las piezas de los dos colores para enseñar tu partida. Ahora mueven <b>{turn}</b>.
      </p>
      <div class="mx-auto max-w-sm"><Board config={{ fen: START_FEN }} onReady={ready} /></div>
      <div class="mt-3 flex flex-wrap justify-center gap-2">
        <button type="button" class="ck-btn-sm min-h-11" onClick={undo} disabled={!count}>↩️ Deshacer</button>
        <button type="button" class="ck-btn-sm min-h-11" onClick={() => { load(START_FEN, []); sfx.tap(); }}>🔄 Empezar de nuevo</button>
        <button type="button" class="ck-btn-sm min-h-11" onClick={() => cg.current?.toggleOrientation()}>🔃 Girar</button>
        <button type="button" class="ck-btn-sm min-h-11" onClick={() => setPaste(paste === null ? '' : null)} aria-expanded={paste !== null}>📋 Pegar una partida</button>
      </div>
      {paste !== null && (
        <div class="mt-3 space-y-2">
          <label class="block text-sm font-bold text-slate-600" for="chat-paste">Pega aquí una partida (PGN) o una posición (FEN):</label>
          <textarea id="chat-paste" class="ck-input h-24 w-full font-mono text-xs" value={paste} onInput={(e) => setPaste((e.target as HTMLTextAreaElement).value)} placeholder="1. e4 e5 2. Nf3 Nc6 …" />
          {pasteError && <p class="text-sm font-bold text-amber-700" role="alert">{pasteError}</p>}
          <button type="button" class="ck-btn-sm min-h-11" onClick={loadPaste}>✅ Cargar en el tablero</button>
        </div>
      )}
      <button type="button" class="ck-btn ck-btn-green mt-4 w-full" disabled={busy}
        onClick={() => onSend({ start: start.current, moves: moves.current.slice() })}>
        {count ? `Enviar partida (${Math.ceil(count / 2)} ${Math.ceil(count / 2) === 1 ? 'jugada' : 'jugadas'}) ➤` : 'Enviar esta posición ➤'}
      </button>
    </div>
  );
}
