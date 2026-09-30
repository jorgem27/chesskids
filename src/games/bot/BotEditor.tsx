import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { Chess } from 'chess.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Board, isPromotion, syncBoard } from '../chess/Board';
import { applyUci } from '../puzzle/logic';
import type { EditorProps } from '../types';
import type { BotContent } from '../meta';
import { LEVELS, newPosition, positionAtStep, START_FEN, validateBotSet, type BotLevel, type BotPosition, type ExplainStep } from './logic';
import { Notebook } from './Notebook';

// ---------- FEN <-> grid helpers ----------
type Grid = (string | null)[][]; // [rank 8..1][file a..h], 'K' white king, 'k' black king…

function gridFromFen(fen: string): Grid {
  return fen.split(' ')[0].split('/').map((row) => {
    const out: (string | null)[] = [];
    for (const ch of row) /\d/.test(ch) ? out.push(...Array(+ch).fill(null)) : out.push(ch);
    return out;
  });
}

function fenFromGrid(g: Grid, turn: 'w' | 'b'): string {
  const rows = g.map((r) => {
    let s = '', n = 0;
    for (const c of r) { if (c) { s += (n || '') + c; n = 0; } else n++; }
    return s + (n || '');
  });
  return `${rows.join('/')} ${turn} - - 0 1`;
}

const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const PALETTE = ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p'];

function Piece({ code }: { code: string }) {
  const white = code === code.toUpperCase();
  return (
    <span class={white ? 'text-white [text-shadow:0_0_2px_#000,0_0_3px_#000,0_0_3px_#000]' : 'text-slate-900'}>{GLYPH[code.toLowerCase()]}</span>
  );
}

function SetupBoard({ p, onChange }: { p: BotPosition; onChange: (fen: string) => void }) {
  const [tool, setTool] = useState<string>('R'); // piece code, or '' = eraser
  const [fenText, setFenText] = useState(p.fen);
  const [fenErr, setFenErr] = useState('');
  useEffect(() => setFenText(p.fen), [p.fen]);
  const grid = gridFromFen(p.fen);
  const turn = (p.fen.split(' ')[1] === 'b' ? 'b' : 'w') as 'w' | 'b';

  function put(rank: number, file: number) {
    const g = grid.map((r) => [...r]);
    g[rank][file] = tool || null;
    onChange(fenFromGrid(g, turn));
  }

  function applyFen(text: string) {
    setFenText(text);
    try { new Chess(text.trim()); setFenErr(''); onChange(text.trim()); } catch { setFenErr('FEN no válido (¿hay un rey de cada color?)'); }
  }

  return (
    <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div class="grid aspect-square w-full max-w-md grid-cols-8 grid-rows-8 overflow-hidden rounded-2xl border-4 border-violet-700/30 select-none">
        {grid.map((row, r) => row.map((c, f) => (
          <button type="button" key={`${r}${f}`} onClick={() => put(r, f)}
            class={`relative flex items-center justify-center text-[min(7vw,2.6rem)] leading-none hover:brightness-95 ${(r + f) % 2 === 0 ? 'bg-[#f0e6ff]' : 'bg-[#a78bdb]'}`}>
            {c && <Piece code={c} />}
            {r === 7 && <span class="absolute bottom-0 right-1 text-[9px] text-violet-900/50">{'abcdefgh'[f]}</span>}
            {f === 0 && <span class="absolute left-0.5 top-0 text-[9px] text-violet-900/50">{8 - r}</span>}
          </button>
        )))}
      </div>
      <div class="space-y-3">
        <div>
          <p class="mb-1 font-bold">Pieza (toca una casilla para colocarla)</p>
          <div class="flex flex-wrap gap-1.5">
            {PALETTE.map((code) => (
              <button type="button" key={code} onClick={() => setTool(code)}
                class={`h-11 w-11 rounded-xl bg-slate-200 text-3xl ${tool === code ? 'ring-4 ring-violet-500' : ''}`}><Piece code={code} /></button>
            ))}
            <button type="button" onClick={() => setTool('')} class={`h-11 rounded-xl bg-slate-100 px-3 font-bold ${tool === '' ? 'ring-4 ring-violet-500' : ''}`}>🧽 Borrar</button>
          </div>
        </div>
        <div>
          <p class="mb-1 font-bold">Empieza jugando el alumno con…</p>
          <div class="flex gap-2">
            {(['w', 'b'] as const).map((t) => (
              <button type="button" key={t} onClick={() => onChange(fenFromGrid(grid, t))}
                class={`ck-btn-sm ${turn === t ? '!bg-violet-600 !text-white' : ''}`}>{t === 'w' ? '⚪ Blancas' : '⚫ Negras'}</button>
            ))}
          </div>
          <p class="mt-1 text-xs text-slate-500">El bot juega con el otro color.</p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="ck-btn-sm" onClick={() => onChange(fenFromGrid(grid.map((r) => r.map(() => null)), turn))}>🗑 Vaciar</button>
          <button type="button" class="ck-btn-sm" onClick={() => onChange(START_FEN)}>↺ Ejemplo (Rey+Torre)</button>
        </div>
        <label class="block text-sm font-bold">FEN (para pegar una posición)
          <input class="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 font-mono text-xs" value={fenText} onInput={(e) => applyFen((e.target as HTMLInputElement).value)} />
        </label>
        {fenErr && <p class="text-sm font-bold text-rose-600">{fenErr}</p>}
      </div>
    </div>
  );
}

// ---------- Notebook steps ----------
function StepRecorder({ p, sel, onChange }: { p: BotPosition; sel: number; onChange: (p: BotPosition) => void }) {
  const cg = useRef<Api | null>(null);
  const ref = useRef({ p, sel });
  ref.current = { p, sel };

  function refresh() {
    if (!cg.current) return;
    const { p, sel } = ref.current;
    let cur: ReturnType<typeof positionAtStep>;
    try { cur = positionAtStep(p, sel); } catch { return; }
    syncBoard(cg.current, cur.chess, { movable: cur.chess.isGameOver() ? null : cur.chess.turn() === 'w' ? 'white' : 'black', lastMove: cur.last });
  }
  useEffect(refresh, [p.fen, sel, JSON.stringify(p.steps)]);

  function onMove(orig: Key, dest: Key) {
    const { p, sel } = ref.current;
    const { chess } = positionAtStep(p, sel);
    let uci = orig + dest;
    if (isPromotion(chess, orig, dest)) uci += 'q';
    if (!applyUci(chess, uci)) return refresh();
    const steps = [...(p.steps ?? [])];
    steps[sel] = { ...steps[sel], moves: [...(steps[sel].moves ?? []), uci] };
    onChange({ ...p, steps });
  }

  const orientation = p.fen.split(' ')[1] === 'b' ? 'black' : 'white';
  const moves = p.steps?.[sel]?.moves ?? [];
  const setMoves = (m: string[]) => {
    const steps = [...(p.steps ?? [])];
    steps[sel] = { ...steps[sel], moves: m };
    onChange({ ...p, steps });
  };

  return (
    <div class="w-full max-w-sm space-y-2">
      <Board config={{ fen: p.fen, orientation, movable: { events: { after: onMove } } }} onReady={(a) => { cg.current = a; a.set({ movable: { events: { after: onMove } } }); refresh(); }} />
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="rounded-full bg-violet-100 px-3 py-1 font-bold text-violet-700">🎬 Paso {sel + 1}: {moves.length} jugada{moves.length === 1 ? '' : 's'}</span>
        <button type="button" class="ck-btn-sm" disabled={!moves.length} onClick={() => setMoves(moves.slice(0, -1))}>↩ Quitar última</button>
        <button type="button" class="ck-btn-sm" disabled={!moves.length} onClick={() => setMoves([])}>🗑 Sin jugadas</button>
      </div>
      <p class="text-xs text-slate-500">Mueve las piezas en este tablero (blancas y negras) para grabar lo que verá el alumno en este paso.</p>
    </div>
  );
}

function ExplainEditor({ p, onChange }: { p: BotPosition; onChange: (p: BotPosition) => void }) {
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState(false);
  const steps = p.steps ?? [];
  const s = Math.min(sel, Math.max(0, steps.length - 1));
  const setStep = (i: number, patch: Partial<ExplainStep>) => onChange({ ...p, steps: steps.map((x, k) => (k === i ? { ...x, ...patch } : x)) });

  return (
    <div class="space-y-3">
      <label class="flex items-center gap-2 font-bold">
        <input type="checkbox" checked={!!p.explain} onChange={() => onChange({ ...p, explain: !p.explain, steps: p.steps?.length ? p.steps : [{ text: '', moves: [] }] })} />
        📓 Mostrar una explicación antes de jugar (tablero + cuaderno con los pasos)
      </label>
      {p.explain && (
        <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div class="space-y-2">
            {steps.map((st, i) => (
              <div key={i} class={`flex items-start gap-2 rounded-2xl border-2 p-2 ${i === s ? 'border-violet-400 bg-violet-50' : 'border-slate-200'}`}>
                <button type="button" onClick={() => setSel(i)} class={`h-9 w-9 shrink-0 rounded-full font-black ${i === s ? 'bg-violet-600 text-white' : 'bg-slate-200'}`}>{i + 1}</button>
                <textarea rows={2} class="min-w-0 flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 font-bold" placeholder="Escribe el paso, p. ej. «Lleva tu rey hacia el rey rival»"
                  value={st.text} onFocus={() => setSel(i)} onInput={(e) => setStep(i, { text: (e.target as HTMLTextAreaElement).value })} />
                <span class="mt-2 text-xs font-bold text-slate-500" title="Jugadas grabadas">🎬{st.moves?.length ?? 0}</span>
                <button type="button" class="mt-1 rounded-lg px-2 text-rose-600" title="Quitar paso" onClick={() => { onChange({ ...p, steps: steps.filter((_, k) => k !== i) }); setSel(Math.max(0, i - 1)); }}>🗑</button>
              </div>
            ))}
            <div class="flex gap-2">
              <button type="button" class="ck-btn-sm" onClick={() => { onChange({ ...p, steps: [...steps, { text: '', moves: [] }] }); setSel(steps.length); }}>＋ Paso</button>
              <button type="button" class="ck-btn-sm" disabled={!steps.length || steps.some((x) => !x.text.trim())} onClick={() => setPreview(true)}>👀 Ver cómo queda</button>
            </div>
          </div>
          {steps[s] && <StepRecorder p={p} sel={s} onChange={onChange} />}
        </div>
      )}
      {preview && (
        <div class="fixed inset-0 z-[70] overflow-auto bg-gradient-to-br from-sky-100 to-violet-100 p-4">
          <button type="button" onClick={() => setPreview(false)} class="fixed right-4 top-4 z-[80] rounded-full bg-slate-900 px-4 py-2 font-bold text-white shadow-lg">✕ Cerrar</button>
          <div class="pt-14"><Notebook position={p} onDone={() => setPreview(false)} doneLabel="✔ Terminar" /></div>
        </div>
      )}
    </div>
  );
}

// ---------- Editor ----------
function Num({ label, value, min = 1, max = 200, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (n: number) => void }) {
  return (
    <label class="block text-sm font-bold">{label}
      <input type="number" min={min} max={max} class="mt-1 w-28 rounded-xl border-2 border-slate-200 px-3 py-2 text-lg" value={value}
        onInput={(e) => onChange(Math.max(min, Math.min(max, Number((e.target as HTMLInputElement).value) || min)))} />
    </label>
  );
}

export function BotEditor({ value, onChange }: EditorProps<BotContent>) {
  const [sel, setSel] = useState(0);
  const positions = value.positions ?? [];
  const p = positions[Math.min(sel, positions.length - 1)];
  const i = Math.min(sel, positions.length - 1);
  const errors = validateBotSet(value);
  const set = (k: number, np: BotPosition) => onChange({ positions: positions.map((x, j) => (j === k ? np : x)) });

  /** New start position: the recorded demo moves belong to the old one, so only the step texts survive. */
  const setFen = (fen: string) => set(i, { ...p, fen, steps: p.steps?.map((s) => ({ text: s.text, moves: [] })) });

  return (
    <div class="space-y-5">
      <div class="flex flex-wrap items-center gap-2">
        {positions.map((_, k) => (
          <button type="button" key={k} onClick={() => setSel(k)}
            class={`h-11 min-w-11 rounded-xl px-2 text-lg font-black ${i === k ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-800'}`}>{k + 1}</button>
        ))}
        <button type="button" class="ck-btn-sm" onClick={() => { onChange({ positions: [...positions, { ...newPosition(p?.fen), steps: [], explain: false }] }); setSel(positions.length); }}>＋ Posición</button>
        {positions.length > 1 && (
          <button type="button" class="ck-btn-sm text-rose-600" onClick={() => { onChange({ positions: positions.filter((_, k) => k !== i) }); setSel(Math.max(0, i - 1)); }}>🗑 Quitar #{i + 1}</button>
        )}
      </div>

      {p && (
        <>
          <section class="ck-card space-y-3">
            <h3 class="font-display text-lg font-extrabold">1️⃣ Coloca las piezas</h3>
            <SetupBoard p={p} onChange={setFen} />
          </section>

          <section class="ck-card space-y-3">
            <h3 class="font-display text-lg font-extrabold">2️⃣ El reto</h3>
            <label class="block text-sm font-bold">Título (aparece en el cuaderno)
              <input class="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base" placeholder="Rey y torre contra rey" value={p.title ?? ''} onInput={(e) => set(i, { ...p, title: (e.target as HTMLInputElement).value })} />
            </label>
            <label class="block text-sm font-bold">Mensaje para el alumno al empezar
              <input class="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base" placeholder="Da jaque mate al bot 🤖 ¡Tú juegas primero!" value={p.prompt ?? ''} onInput={(e) => set(i, { ...p, prompt: (e.target as HTMLInputElement).value })} />
            </label>
            <div>
              <p class="mb-1 text-sm font-bold">Nivel del bot (Stockfish)</p>
              <div class="flex flex-wrap gap-2">
                {(Object.keys(LEVELS) as BotLevel[]).map((l) => (
                  <button type="button" key={l} onClick={() => set(i, { ...p, level: l })} class={`ck-btn-sm ${p.level === l ? '!bg-violet-600 !text-white' : ''}`}>{LEVELS[l].emoji} {LEVELS[l].label}</button>
                ))}
              </div>
              <p class="mt-1 text-xs text-slate-500">Para practicar finales de mate, «Difícil» hace que el bot se defienda lo mejor posible. Responde en una fracción de segundo.</p>
            </div>
            <div class="flex flex-wrap gap-4">
              <Num label="Jugadas máximas del alumno" value={p.maxMoves} onChange={(n) => set(i, { ...p, maxMoves: n })} />
              <Num label="Jugadas para las 3 ⭐" value={p.parMoves} max={p.maxMoves} onChange={(n) => set(i, { ...p, parMoves: n })} />
            </div>
          </section>

          <section class="ck-card space-y-3">
            <h3 class="font-display text-lg font-extrabold">3️⃣ Explicación (opcional)</h3>
            <ExplainEditor p={p} onChange={(np) => set(i, np)} />
          </section>
        </>
      )}

      {errors.length > 0 && <ul class="list-disc rounded-2xl bg-amber-50 p-3 pl-8 text-sm text-amber-800">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
    </div>
  );
}
