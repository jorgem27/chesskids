import { useEffect, useRef, useState } from 'preact/hooks';
import { burst, speak } from '../../lib/fx';
import { sfx } from '../../lib/sfx';

// First-time mini tutorial: "toca la pieza, toca el punto verde, ¡gana estrellas!".
// A tiny 4×4 board in plain Preact (no chessground) so the dashboard stays light.

const KEY = (id: string) => `ck-tour-${id}`;
const SIZE = 4;
const KNIGHT = 9; // b2 on the mini board (row 2, col 1)
const TARGET = 2; // c4: an L-jump away

type Step = 'hello' | 'tap-piece' | 'tap-target' | 'stars' | 'help';

const TEXT: Record<Step, { title: string; say: string }> = {
  hello: { title: '¡Hola! Soy Potróculo 👋', say: '¡Hola! Soy Potróculo. Te enseño a jugar en un momento.' },
  'tap-piece': { title: 'Toca el caballo ♞', say: 'Toca el caballo para elegirlo.' },
  'tap-target': { title: 'Ahora toca el punto verde 🟢', say: '¡Bien! Ahora toca el punto verde para moverlo.' },
  stars: { title: '¡Muy bien! ⭐', say: '¡Muy bien! Así se mueven las piezas. Si juegas bien, ganas estrellas y puntos.' },
  help: { title: 'Si te equivocas, ¡te ayudo! 💡', say: 'Si te equivocas, no pasa nada: te doy una pista. ¡A jugar!' },
};

export default function Tutorial({ studentId, auto }: { studentId: number; auto: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('hello');
  const [piece, setPiece] = useState(KNIGHT);
  const [wrong, setWrong] = useState(-1);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(KEY(String(studentId))) === '1'; } catch { /* storage blocked */ }
    // A short delay lets the login celebration (Welcome) finish first.
    const timer = auto && !seen ? setTimeout(start, 1200) : undefined;
    const reopen = () => start();
    document.addEventListener('ck-tutorial', reopen);
    return () => { clearTimeout(timer); document.removeEventListener('ck-tutorial', reopen); };
  }, []);

  useEffect(() => { if (open) speak(TEXT[step].say); }, [open, step]);
  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function start() {
    setPiece(KNIGHT);
    setStep('hello');
    setWrong(-1);
    setOpen(true);
  }

  function close() {
    try { localStorage.setItem(KEY(String(studentId)), '1'); } catch { /* ignore */ }
    setOpen(false);
  }

  function tap(i: number) {
    if (step === 'tap-piece') {
      if (i === piece) { sfx.tap(); setWrong(-1); setStep('tap-target'); } else { sfx.hint(); setWrong(piece); speak('¡Casi! Toca el caballo que brilla.'); }
    } else if (step === 'tap-target') {
      if (i === TARGET) {
        sfx.move();
        setPiece(TARGET);
        setTimeout(() => { sfx.correct(); burst(0.5, 0.5, 0.8); setStep('stars'); }, 250);
      } else { sfx.hint(); setWrong(TARGET); speak('¡Casi! Toca el punto verde.'); }
    }
  }

  if (!open) return null;
  const t = TEXT[step];
  const board = step === 'tap-piece' || step === 'tap-target';
  return (
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="ck-tour-title">
      <div ref={dialog} tabIndex={-1} class="w-full max-w-md rounded-3xl bg-white p-5 text-slate-800 shadow-2xl outline-none" style="animation: ck-pop .3s ease-out">
        <div class="flex items-start gap-3">
          <img src="/potroculo/clasico.webp" width="72" height="72" alt="" class="h-16 w-16 shrink-0 rounded-2xl bg-brand-50 object-contain" />
          <div class="min-w-0 flex-1">
            <h2 id="ck-tour-title" class="font-display text-2xl font-extrabold text-brand-900">{t.title}</h2>
            <p class="text-slate-600">{t.say}</p>
          </div>
          <button type="button" onClick={close} class="-mr-1 -mt-1 min-h-11 min-w-11 rounded-full text-xl text-slate-400 hover:bg-slate-100" aria-label="Cerrar">✕</button>
        </div>

        {board && (
          <div class="mx-auto mt-4 grid w-64 grid-cols-4 overflow-hidden rounded-xl shadow-[0_6px_0_#16275033]" role="group" aria-label="Tablero de práctica">
            {Array.from({ length: SIZE * SIZE }, (_, i) => {
              const dark = (Math.floor(i / SIZE) + (i % SIZE)) % 2 === 1;
              const isPiece = i === piece;
              const isTarget = step === 'tap-target' && i === TARGET;
              const glow = wrong === i;
              return (
                <button type="button" key={i} onClick={() => tap(i)}
                  aria-label={isPiece ? 'Caballo' : isTarget ? 'Punto verde' : `Casilla ${'abcd'[i % SIZE]}${SIZE - Math.floor(i / SIZE)}`}
                  class={`relative flex aspect-square items-center justify-center text-5xl ${dark ? 'bg-[#7d97bf]' : 'bg-[#eef1f6]'} ${isPiece && step === 'tap-target' ? 'ring-4 ring-inset ring-gold-400' : ''} ${glow ? 'animate-pulse ring-4 ring-inset ring-amber-400' : ''}`}>
                  {isPiece && <span class="drop-shadow" aria-hidden="true">♞</span>}
                  {isTarget && <span class="h-8 w-8 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgb(16_185_129/.3)]" aria-hidden="true"></span>}
                </button>
              );
            })}
          </div>
        )}

        {step === 'stars' && (
          <div class="mt-4 grid grid-cols-3 gap-2 text-center text-sm font-bold">
            <div class="rounded-2xl bg-gold-50 p-3"><p class="text-3xl">⭐</p>Estrellas</div>
            <div class="rounded-2xl bg-orange-50 p-3"><p class="text-3xl">🔥</p>Racha: juega cada día</div>
            <div class="rounded-2xl bg-brand-50 p-3"><p class="text-3xl">📒</p>Cromos</div>
          </div>
        )}

        <div class="mt-5 flex justify-end gap-2">
          {step === 'hello' && <button type="button" class="ck-btn ck-btn-primary" onClick={() => setStep('tap-piece')}>¡Vamos! ▶</button>}
          {board && <p class="flex-1 text-sm font-bold text-slate-700" role="status" aria-live="polite">{wrong >= 0 ? (step === 'tap-piece' ? '💡 ¡Casi! Toca el caballo ♞ que brilla' : '💡 ¡Casi! Toca el punto verde 🟢') : ''}</p>}
          {step === 'stars' && <button type="button" class="ck-btn ck-btn-primary" onClick={() => setStep('help')}>Siguiente ▶</button>}
          {step === 'help' && <button type="button" class="ck-btn ck-btn-gold" onClick={close}>¡A jugar! 🎉</button>}
        </div>
      </div>
    </div>
  );
}
