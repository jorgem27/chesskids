// The "explanation" screen: a demo board on one side and a cute spiral notebook with the steps on the other.
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '../../lib/sfx';
import { Board, syncBoard } from '../chess/Board';
import { applyUci } from '../puzzle/logic';
import { positionAtStep, type BotPosition } from './logic';

const STICKERS = ['🌟', '🚀', '🦄', '🍭', '🐝', '🌈', '🎈', '🐢', '🍀', '🦋'];

const PAPER = 'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, #bfdbfe 31px, #bfdbfe 32px)';

export function Notebook({ position, onDone, doneLabel = '¡Listo, a jugar! ▶', onSkip }: {
  position: BotPosition;
  onDone: () => void;
  doneLabel?: string;
  onSkip?: () => void;
}) {
  const steps = position.steps ?? [];
  const cg = useRef<Api | null>(null);
  const timers = useRef<number[]>([]);
  const [cur, setCur] = useState(0); // steps 0..cur are "written"
  const orientation = position.fen.split(' ')[1] === 'b' ? 'black' : 'white';

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);

  function show(k: number, animate: boolean) {
    clear();
    const api = cg.current;
    if (!api) return;
    const stepMoves = steps[k]?.moves ?? [];
    const base = positionAtStep(position, animate ? k - 1 : k);
    syncBoard(api, base.chess, { movable: null, lastMove: base.last });
    api.setAutoShapes([]);
    if (!animate) { drawLast(api, k); return; }
    const { chess } = base;
    stepMoves.forEach((m, i) => {
      timers.current.push(window.setTimeout(() => {
        if (!applyUci(chess, m)) return;
        sfx.move();
        syncBoard(api, chess, { movable: null, lastMove: m });
        if (i === stepMoves.length - 1) drawLast(api, k);
      }, 500 + i * 900));
    });
  }

  function drawLast(api: Api, k: number) {
    const mv = steps[k]?.moves?.at(-1);
    api.setAutoShapes(mv ? [{ orig: mv.slice(0, 2) as Key, dest: mv.slice(2, 4) as Key, brush: 'green' }] : []);
  }

  function go(k: number) {
    if (k < 0 || k >= steps.length) return;
    sfx.tap();
    const forward = k === cur + 1;
    setCur(k);
    show(k, forward);
  }

  const ready = (a: Api) => {
    cg.current = a;
    a.set({ movable: { free: false, color: undefined }, draggable: { enabled: false }, selectable: { enabled: false }, orientation });
    show(0, false);
  };

  const last = cur >= steps.length - 1;

  return (
    <div class="mx-auto grid w-full max-w-5xl items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div class="mx-auto w-full max-w-[min(92vw,62vh)]">
        <Board config={{ fen: position.fen, orientation, coordinates: true }} onReady={ready} />
        <p class="mt-2 text-center text-sm font-bold text-slate-500">👀 Mira el tablero mientras lees tu cuaderno</p>
      </div>

      <div class="relative rounded-3xl bg-amber-50 pb-4 pl-10 pr-4 pt-7 shadow-[0_8px_0_rgb(0_0_0/0.08),0_14px_30px_rgb(76_29_149/0.15)] ring-2 ring-amber-200" style="transform: rotate(0.6deg)">
        {/* spiral holes + red margin */}
        <div class="absolute bottom-4 left-2 top-4 flex flex-col justify-around" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <span key={i} class="block h-3.5 w-3.5 rounded-full bg-slate-300 shadow-inner ring-2 ring-slate-400/50" />)}
        </div>
        <div class="absolute bottom-0 left-9 top-0 w-0.5 bg-rose-300/70" aria-hidden="true" />
        <span class="absolute -top-4 right-5 rotate-6 rounded-lg bg-yellow-300 px-3 py-1 text-sm font-black text-amber-900 shadow" aria-hidden="true">📓 Mi cuaderno</span>

        <h3 class="mb-2 font-display text-xl font-extrabold text-brand-700">{position.title?.trim() || 'Cómo dar jaque mate'}</h3>

        <ol class="space-y-2" style={{ backgroundImage: PAPER }}>
          {steps.map((s, i) => {
            const shown = i <= cur;
            return (
              <li key={i}>
                <button type="button" onClick={() => go(i)} disabled={i > cur + 1}
                  class={`flex w-full items-start gap-2 rounded-2xl px-2 py-1.5 text-left transition ${i === cur ? 'bg-white/90 shadow-md ring-2 ring-brand-300' : shown ? 'opacity-70' : 'opacity-30'}`}
                  style={i === cur ? 'animation: ck-pop .3s ease-out' : ''}>
                  <span class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-black ${i < cur ? 'bg-emerald-400 text-white' : 'bg-brand-500 text-white'}`}>
                    {i < cur ? '✓' : i + 1}
                  </span>
                  <span class="min-w-0 flex-1 text-[1.02rem] font-bold leading-snug text-slate-700">
                    {shown ? s.text : '· · ·'} {shown && <span aria-hidden="true">{STICKERS[i % STICKERS.length]}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button type="button" class="ck-btn-sm" disabled={cur === 0} onClick={() => go(cur - 1)}>◀ Atrás</button>
          <span class="text-sm font-black text-slate-400">{cur + 1} / {steps.length}</span>
          {last
            ? <button type="button" class="ck-btn ck-btn-green" onClick={() => { sfx.whoosh(); onDone(); }}>{doneLabel}</button>
            : <button type="button" class="ck-btn ck-btn-primary" onClick={() => go(cur + 1)}>Siguiente ▶</button>}
        </div>
        {onSkip && !last && (
          <button type="button" class="mx-auto mt-2 block text-sm font-bold text-slate-400 underline" onClick={onSkip}>Saltar la explicación</button>
        )}
      </div>
    </div>
  );
}
