import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { Chess } from 'chess.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx, vibrate } from '../../lib/sfx';
import { Board, isPromotion, syncBoard } from '../chess/Board';
import type { PlayerProps } from '../types';
import { ALMOST_TEXT } from '../rules';
import { itemTracker } from '../items';
import { applyUci, earnedPts, judgeMove, puzzleMaxScore, stepPts, type PuzzleSetContent } from './logic';

type Mode = 'hint' | 'blitz';

export function makePuzzlePlayer(mode: Mode) {
  return function PuzzlePlayer({ content, api }: PlayerProps<PuzzleSetContent>) {
    const puzzles = content.puzzles;
    const cg = useRef<Api | null>(null);
    const chess = useRef(new Chess());
    const st = useRef({ idx: 0, ply: 0, mistakes: 0, stepMistakes: 0, totalMistakes: 0, score: 0, solved: 0, combo: 0, locked: false, color: 'white' as 'white' | 'black' });
    const [idx, setIdx] = useState(0);
    const [shake, setShake] = useState(0);
    const [glow, setGlow] = useState(0);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const timer = useRef<number | null>(null);
    const tracker = useRef(itemTracker());
    const limit = mode === 'blitz' ? content.timeLimitSec ?? 0 : 0;

    function prompt(i: number) {
      const p = puzzles[i];
      const side = new Chess(p.fen).turn() === 'w' ? 'blancas' : 'negras';
      return p.prompt?.trim() ? `${p.prompt} (juegan ${side})` : `Juegan ${side}. ¡Encuentra la mejor jugada!`;
    }

    function load(i: number) {
      const s = st.current;
      s.idx = i; s.ply = 0; s.mistakes = 0; s.stepMistakes = 0; s.locked = false;
      chess.current = new Chess(puzzles[i].fen);
      s.color = chess.current.turn() === 'w' ? 'white' : 'black';
      setIdx(i);
      tracker.current.start();
      api.progress(i, puzzles.length);
      if (cg.current) {
        cg.current.set({ orientation: s.color });
        cg.current.setAutoShapes([]);
        syncBoard(cg.current, chess.current, { movable: s.color });
      }
      api.say(prompt(i), { speak: api.ageGroup === 'peque' });
      if (limit > 0) startClock();
    }

    function startClock() {
      stopClock();
      let left = limit;
      setTimeLeft(left);
      timer.current = window.setInterval(() => {
        left -= 1;
        setTimeLeft(left);
        if (left <= 5 && left > 0) sfx.tick();
        // Time is up: fail as soon as the board is playable again (not during the opponent's reply).
        if (left <= 0 && !st.current.locked) { stopClock(); fail('¡Se acabó el tiempo!'); }
      }, 1000);
    }
    function stopClock() {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
    }
    useEffect(() => () => stopClock(), []);

    function next() {
      const s = st.current;
      stopClock();
      if (s.idx + 1 >= puzzles.length) {
        api.progress(puzzles.length, puzzles.length);
        api.finish({
          score: s.score,
          maxScore: puzzles.reduce((t, p) => t + puzzleMaxScore(p, mode), 0),
          mistakes: s.totalMistakes,
          puzzlesSolved: s.solved,
          items: tracker.current.list(puzzles.length),
        });
      } else load(s.idx + 1);
    }

    function solvedPuzzle() {
      const s = st.current;
      stopClock();
      s.locked = true;
      s.solved++;
      s.combo++;
      tracker.current.done(s.idx, s.mistakes === 0, s.mistakes);
      if (mode === 'blitz' && s.combo >= 2) api.combo(s.combo);
      setGlow((g) => g + 1);
      api.good(undefined, { big: s.mistakes === 0 });
      cg.current?.set({ movable: { color: undefined, dests: new Map() } });
      setTimeout(next, mode === 'blitz' ? 900 : 1500);
    }

    /** Blitz failure: reveal the solution move and move on. */
    function fail(msg?: string) {
      const s = st.current;
      if (s.locked) return;
      s.locked = true;
      s.combo = 0;
      api.combo(0);
      s.totalMistakes++;
      tracker.current.done(s.idx, false, s.mistakes + 1);
      const expected = puzzles[s.idx].moves[s.ply];
      api.bad(msg ?? 'La buena era esta 👀');
      setShake((x) => x + 1);
      setTimeout(() => {
        const m = applyUci(chess.current, expected);
        if (cg.current && m) {
          syncBoard(cg.current, chess.current, { movable: null, lastMove: expected });
          cg.current.setAutoShapes([{ orig: expected.slice(0, 2) as Key, dest: expected.slice(2, 4) as Key, brush: 'green' }]);
        }
      }, 450);
      setTimeout(next, 2100);
    }

    /** The student's move (already applied to the board) is done: finish the puzzle or let the opponent reply. */
    function afterStudentMove(toPlay: string) {
      const s = st.current;
      const p = puzzles[s.idx];
      syncBoard(cg.current!, chess.current, { movable: null, lastMove: toPlay });
      if (s.ply + 1 >= p.moves.length || chess.current.isCheckmate()) { solvedPuzzle(); return; }
      api.good(mode === 'hint' ? '¡Bien! Sigue…' : undefined);
      s.locked = true;
      setTimeout(() => {
        const reply = p.moves[s.ply + 1];
        const r = applyUci(chess.current, reply);
        r?.captured ? sfx.capture() : sfx.move();
        s.ply += 2;
        s.stepMistakes = 0;
        s.locked = false;
        syncBoard(cg.current!, chess.current, { movable: s.color, lastMove: reply });
      }, 650);
    }

    function onMove(orig: Key, dest: Key) {
      const s = st.current;
      if (s.locked) return;
      const p = puzzles[s.idx];
      const k = s.ply / 2;
      const expected = p.moves[s.ply];
      const cfg = p.steps?.[k];
      const fenBefore = chess.current.fen();
      let uci = orig + dest;
      if (isPromotion(chess.current, orig, dest)) uci += expected.startsWith(uci) && expected.length > 4 ? expected[4] : 'q';
      const verdict = judgeMove(p, k, fenBefore, uci);

      if (verdict.kind === 'best' || verdict.kind === 'good') {
        const pts = verdict.kind === 'good' && typeof verdict.rule.pts === 'number' ? verdict.rule.pts : stepPts(p, k, mode);
        s.score += earnedPts(pts, s.stepMistakes, mode);
        cg.current!.setAutoShapes([]);
        if (verdict.kind === 'best') {
          const toPlay = uci.slice(0, 4) === expected.slice(0, 4) ? expected : uci; // (a different mate also counts)
          const m = applyUci(chess.current, toPlay);
          m?.captured ? sfx.capture() : sfx.move();
          afterStudentMove(toPlay);
          return;
        }
        // Alternative correct move: show it, then continue along the recorded solution.
        const m = applyUci(chess.current, uci);
        m?.captured ? sfx.capture() : sfx.move();
        syncBoard(cg.current!, chess.current, { movable: null, lastMove: uci });
        if (chess.current.isCheckmate()) { solvedPuzzle(); return; }
        s.locked = true;
        api.good(verdict.rule.text || '¡Buena jugada! También vale 👍');
        setTimeout(() => {
          chess.current.load(fenBefore);
          const em = applyUci(chess.current, expected);
          em?.captured ? sfx.capture() : sfx.move();
          api.say(`En la solución se jugó ${em?.san ?? expected}.`);
          afterStudentMove(expected);
        }, 1500);
        return;
      }

      if (verdict.kind === 'almost') {
        // "Not the best": same position again, no mistake, no penalty.
        s.locked = true;
        api.say(verdict.rule.text || ALMOST_TEXT);
        sfx.hint();
        setTimeout(() => {
          syncBoard(cg.current!, chess.current, { movable: s.color });
          s.locked = false;
        }, 700);
        return;
      }

      // Wrong move
      vibrate(120);
      if (mode === 'blitz') {
        syncBoard(cg.current!, chess.current, { movable: null });
        fail(verdict.rule?.text);
        return;
      }
      s.mistakes++;
      s.stepMistakes++;
      s.totalMistakes++;
      setShake((x) => x + 1);
      // Put the piece back after a tiny pause so kids see what happened.
      setTimeout(() => {
        syncBoard(cg.current!, chess.current, { movable: s.color });
        const from = expected.slice(0, 2) as Key;
        const to = expected.slice(2, 4) as Key;
        const custom = verdict.rule?.text?.trim();
        const hint = cfg?.hint?.trim();
        if (s.stepMistakes === 1) {
          cg.current!.setAutoShapes([{ orig: from, brush: 'yellow' }]);
          api.bad(custom || (hint ? `Pista: ${hint}` : 'Pista: mueve la pieza del círculo amarillo ✨'));
        } else {
          cg.current!.setAutoShapes([{ orig: from, brush: 'yellow' }, { orig: from, dest: to, brush: 'paleGreen' }]);
          api.bad(custom || (hint ? `Pista: ${hint}` : '¡Sigue la flecha! 🏹'));
        }
        sfx.hint();
      }, 350);
    }

    const ready = (a: Api) => {
      cg.current = a;
      a.set({ movable: { events: { after: onMove } } });
      load(0);
    };

    const total = puzzles.length;
    return (
      <div class="flex w-full flex-col items-center gap-3">
        <div class="flex w-full max-w-[min(92vw,70vh)] items-center justify-between text-sm font-bold text-slate-500">
          <span class="rounded-full bg-white/80 px-3 py-1 shadow-sm">{mode === 'blitz' ? '⚡' : '🧩'} {idx + 1} / {total}</span>
          {limit > 0 && timeLeft !== null && (
            <span class={`rounded-full px-3 py-1 shadow-sm tabular-nums ${timeLeft <= 5 ? 'animate-pulse bg-rose-500 text-white' : 'bg-white/80'}`}>⏱️ {timeLeft}s</span>
          )}
        </div>
        <div class="w-full max-w-[min(92vw,70vh)]">
          <Board config={{ fen: puzzles[0].fen }} onReady={ready} shake={shake} glow={glow} />
        </div>
      </div>
    );
  };
}
