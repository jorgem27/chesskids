import { Chess } from 'chess.js';
import { useState } from 'preact/hooks';
import { Board } from '../chess/Board';
import { ELO_MAX, ELO_MIN, ELO_PRESETS, LICHESS_THEMES, MAX_ELO_SPAN, MAX_PUZZLES } from '../../lib/lichessThemes';
import type { Puzzle } from './logic';

type Found = Puzzle & { lichessId: string; rating: number; white: boolean };

interface Props {
  clubId: number;
  hasPuzzles: boolean;
  /** Called with the chosen puzzles; `replace` drops the current list. */
  onUse: (puzzles: Puzzle[], replace: boolean, title: string) => void;
}

const strip = ({ white: _w, ...p }: Found): Puzzle => p; // keeps lichessId + rating for reviews
const whiteToMove = (fen: string) => { try { return new Chess(fen).turn() === 'w'; } catch { return true; } };
const chip = (on: boolean) =>
  `min-h-11 rounded-full px-3 py-2 font-bold ${on ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-300'}`;

/** "Generar desde Lichess": pick theme + Elo + count, preview, then copy into the activity. */
export function LichessGenerator({ clubId, hasPuzzles, onUse }: Props) {
  // Rendered client:only, so reading the URL here is safe.
  const [open, setOpen] = useState(() => typeof location !== 'undefined' && location.search.includes('lichess=1'));
  const [theme, setTheme] = useState('mateIn1');
  const [min, setMin] = useState(ELO_PRESETS[0].min);
  const [max, setMax] = useState(ELO_PRESETS[0].max);
  const [count, setCount] = useState(10);
  const [found, setFound] = useState<Found[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rangeError =
    !(min >= ELO_MIN && max <= ELO_MAX) ? `El Elo va de ${ELO_MIN} a ${ELO_MAX}.`
    : min > max ? 'El Elo mínimo es mayor que el máximo.'
    : max - min > MAX_ELO_SPAN ? `Elige un rango de ${MAX_ELO_SPAN} puntos como mucho.`
    : '';

  async function fetchPuzzles(n: number, exclude: string[]): Promise<Found[] | null> {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/coach/lichess-puzzles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clubId, theme, minRating: min, maxRating: max, count: n, exclude }),
      });
      const body = await (res.json() as Promise<any>).catch(() => ({}));
      if (!res.ok) { setError(body.error ?? 'No se pudieron cargar los problemas. Inténtalo de nuevo.'); return null; }
      return (body.puzzles as Found[]).map((p) => ({ ...p, white: whiteToMove(p.fen) }));
    } catch {
      setError('Sin conexión. Revisa tu conexión e inténtalo de nuevo.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    const list = await fetchPuzzles(count, []);
    if (!list) return;
    setFound(list);
    if (!list.length) setError('No hay problemas con ese tema y Elo. Prueba otro rango.');
    else if (list.length < count) setError(`Solo hay ${list.length} problemas con ese tema y Elo.`);
  }

  async function swap(i: number) {
    const list = await fetchPuzzles(1, found.map((p) => p.lichessId));
    if (!list) return;
    if (!list.length) { setError('No quedan más problemas distintos con ese tema y Elo.'); return; }
    setFound(found.map((p, k) => (k === i ? list[0] : p)));
  }

  function use(replace: boolean) {
    const t = LICHESS_THEMES.find((x) => x.key === theme)!;
    const name = t.key === 'mix' ? 'Problemas variados' : t.label;
    onUse(found.map(strip), replace, `${name} · ${min}–${max}`);
    setFound([]);
    setError('');
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        class="w-full rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 p-4 text-left font-black text-amber-950 shadow-[0_4px_0_rgb(0_0_0/0.12)] transition hover:-translate-y-0.5">
        <span aria-hidden="true">⚡ </span>Generar desde Lichess
        <span class="block text-sm font-bold">Elige tema, Elo y cuántos: listos en pocos segundos.</span>
      </button>
    );
  }

  return (
    <div class="space-y-4 rounded-2xl bg-amber-50 p-4 text-sm ring-2 ring-amber-200">
      <div class="flex items-center justify-between">
        <p class="text-lg font-black text-amber-900"><span aria-hidden="true">⚡ </span>Generar desde Lichess</p>
        <button type="button" class="ck-btn-sm min-h-11 min-w-11" aria-label="Cerrar generador" onClick={() => setOpen(false)}>✕</button>
      </div>

      <div role="group" aria-labelledby="lg-theme">
        <p id="lg-theme" class="mb-2 font-bold">1. Tema</p>
        <div class="flex flex-wrap gap-2">
          {LICHESS_THEMES.map((t) => (
            <button type="button" key={t.key} aria-pressed={theme === t.key} onClick={() => setTheme(t.key)} class={chip(theme === t.key)}>
              <span aria-hidden="true">{theme === t.key ? '✓' : t.emoji} </span>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div role="group" aria-labelledby="lg-elo">
        <p id="lg-elo" class="mb-2 font-bold">2. Nivel (Elo)</p>
        <div class="flex flex-wrap items-center gap-2">
          {ELO_PRESETS.map((p) => {
            const on = min === p.min && max === p.max;
            return (
              <button type="button" key={p.label} aria-pressed={on} onClick={() => { setMin(p.min); setMax(p.max); }} class={chip(on)}>
                <span aria-hidden="true">{on ? '✓' : p.emoji} </span>{p.label} <span class="opacity-75">{p.min}–{p.max}</span>
              </button>
            );
          })}
          <span class="flex flex-wrap items-center gap-1 font-bold">
            <span aria-hidden="true">o</span>
            <input type="number" min={ELO_MIN} max={ELO_MAX} step={50} aria-label="Elo mínimo" class="ck-input w-24 !py-2" value={min}
              onInput={(e) => setMin(Number((e.target as HTMLInputElement).value) || 0)} />
            <span aria-hidden="true">–</span>
            <input type="number" min={ELO_MIN} max={ELO_MAX} step={50} aria-label="Elo máximo" class="ck-input w-24 !py-2" value={max}
              onInput={(e) => setMax(Number((e.target as HTMLInputElement).value) || 0)} />
          </span>
        </div>
        {rangeError && <p role="alert" class="mt-1 font-bold text-rose-700">{rangeError}</p>}
      </div>

      <label class="block font-bold">3. ¿Cuántos problemas? <span class="text-brand-700">{count}</span>
        <input type="range" min={1} max={MAX_PUZZLES} value={count} aria-valuetext={`${count} problemas`}
          class="mt-1 block h-11 w-full max-w-sm accent-brand-600"
          onInput={(e) => setCount(Number((e.target as HTMLInputElement).value))} />
      </label>

      <button type="button" class="ck-btn ck-btn-primary w-full sm:w-auto" disabled={busy || !!rangeError} onClick={generate}>
        {busy ? 'Buscando…' : '🎲 Generar'}
      </button>
      <p aria-live="polite" class="font-bold text-amber-900">{error}</p>

      {found.length > 0 && (
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {found.map((p, i) => (
              <div key={p.lichessId} class="rounded-xl bg-white p-2 ring-1 ring-slate-200">
                <div role="img" aria-label={`Problema ${i + 1}, juegan ${p.white ? 'blancas' : 'negras'}, Elo ${p.rating}`}>
                  <Board config={{ fen: p.fen, orientation: p.white ? 'white' : 'black', viewOnly: true, coordinates: false }} />
                </div>
                <p class="mt-1 text-xs font-bold text-slate-600">#{i + 1} · Elo {p.rating} · {p.white ? 'Blancas' : 'Negras'}</p>
                <div class="mt-1 flex gap-1">
                  <button type="button" class="ck-btn-sm min-h-11 flex-1" aria-label={`Cambiar problema ${i + 1} por otro`} disabled={busy} onClick={() => swap(i)}>🔄</button>
                  <button type="button" class="ck-btn-sm min-h-11 flex-1 text-rose-600" aria-label={`Quitar problema ${i + 1}`}
                    onClick={() => setFound(found.filter((_, k) => k !== i))}>✕</button>
                </div>
              </div>
            ))}
          </div>
          <div class="flex flex-col gap-2 sm:flex-row">
            {hasPuzzles ? (
              <>
                <button type="button" class="ck-btn ck-btn-primary" onClick={() => use(false)}>＋ Añadir estos {found.length}</button>
                <button type="button" class="ck-btn" onClick={() => confirm('¿Borrar los problemas que ya tienes y usar solo estos?') && use(true)}>Reemplazar los que ya hay</button>
              </>
            ) : (
              <button type="button" class="ck-btn ck-btn-primary" onClick={() => use(true)}>✅ Usar estos {found.length}</button>
            )}
          </div>
        </div>
      )}
      <p class="text-xs text-slate-600">Problemas de la base de datos abierta de Lichess (CC0). Se copian en tu actividad: puedes editarlos después.</p>
    </div>
  );
}
