import { useMemo, useState } from 'preact/hooks';
import type { FruitContent } from '../meta';
import type { EditorProps } from '../types';
import { FRUITS, PIECE_NAMES, solve, validateLevel, xyToSq, type FruitLevel, type FruitPiece } from './logic';

const PIECE_ICON: Record<FruitPiece, string> = { N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔' };
type Tool = 'fruit' | 'rock' | 'start' | 'erase';

function LevelGrid({ level, onChange }: { level: FruitLevel; onChange: (l: FruitLevel) => void }) {
  const [tool, setTool] = useState<Tool>('fruit');
  const [showPath, setShowPath] = useState(false);
  const errors = validateLevel(level);
  const sol = useMemo(() => (errors.length ? null : solve(level)), [JSON.stringify(level)]);
  const pathIndex = new Map<string, number>();
  if (showPath && sol) sol.path.forEach((sq, i) => { if (i > 0) pathIndex.set(sq, i); });

  function click(sq: string) {
    const fruits = level.fruits.filter((f) => f !== sq);
    const rocks = (level.rocks ?? []).filter((r) => r !== sq);
    if (tool === 'start') { if (!rocks.includes(sq)) onChange({ ...level, start: sq, fruits, rocks }); return; }
    if (sq === level.start) return;
    if (tool === 'fruit') onChange({ ...level, fruits: level.fruits.includes(sq) ? fruits : [...fruits, sq], rocks });
    if (tool === 'rock') onChange({ ...level, fruits, rocks: (level.rocks ?? []).includes(sq) ? rocks : [...rocks, sq] });
    if (tool === 'erase') onChange({ ...level, fruits, rocks });
  }

  const tools: [Tool, string][] = [['fruit', '🍎 Fruta'], ['rock', '🪨 Roca'], ['start', `${PIECE_ICON[level.piece]} Salida`], ['erase', '🧽 Borrar']];

  return (
    <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div class="grid aspect-square w-full max-w-md grid-cols-8 grid-rows-8 overflow-hidden rounded-2xl border-4 border-emerald-700/30 select-none">
        {Array.from({ length: 64 }, (_, i) => {
          const x = i % 8, y = 7 - Math.floor(i / 8);
          const sq = xyToSq(x, y);
          const dark = (x + y) % 2 === 0;
          const fi = level.fruits.indexOf(sq);
          return (
            <button type="button" key={sq} onClick={() => click(sq)}
              class={`relative flex items-center justify-center text-[min(6vw,2.2rem)] leading-none ${dark ? 'bg-[#86c06c]' : 'bg-[#eef6d9]'} hover:brightness-95`}>
              {sq === level.start ? <span class="text-[min(8vw,2.8rem)]">{PIECE_ICON[level.piece]}</span> : fi >= 0 ? FRUITS[fi % FRUITS.length] : (level.rocks ?? []).includes(sq) ? '🪨' : ''}
              {pathIndex.has(sq) && <span class="absolute right-0.5 top-0.5 rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{pathIndex.get(sq)}</span>}
              {y === 0 && <span class="absolute bottom-0 right-1 text-[9px] text-emerald-900/50">{sq[0]}</span>}
              {x === 0 && <span class="absolute left-0.5 top-0 text-[9px] text-emerald-900/50">{sq[1]}</span>}
            </button>
          );
        })}
      </div>
      <div class="space-y-3">
        <div>
          <p class="mb-1 font-bold">Pieza</p>
          <div class="flex gap-2">
            {(Object.keys(PIECE_NAMES) as FruitPiece[]).map((p) => (
              <button type="button" key={p} title={PIECE_NAMES[p]} onClick={() => onChange({ ...level, piece: p })}
                class={`h-12 w-12 rounded-xl text-3xl ${level.piece === p ? 'bg-brand-600 text-white' : 'bg-slate-100'}`}>{PIECE_ICON[p]}</button>
            ))}
          </div>
        </div>
        <div>
          <p class="mb-1 font-bold">Herramienta (toca el tablero)</p>
          <div class="flex flex-wrap gap-2">
            {tools.map(([t, label]) => (
              <button type="button" key={t} onClick={() => setTool(t)} class={`ck-btn-sm ${tool === t ? '!bg-brand-600 !text-white' : ''}`}>{label}</button>
            ))}
          </div>
        </div>
        {errors.length ? (
          <ul class="list-disc rounded-2xl bg-amber-50 p-3 pl-8 text-sm text-amber-800">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        ) : (
          <div class="rounded-2xl bg-emerald-50 p-3 text-emerald-900">
            <p class="text-lg font-black">🎯 Camino más corto: {sol?.moves} movimientos</p>
            <label class="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={showPath} onChange={() => setShowPath(!showPath)} /> Ver la solución en el tablero</label>
          </div>
        )}
      </div>
    </div>
  );
}

export function FruitEditor({ value, onChange }: EditorProps<FruitContent>) {
  const [sel, setSel] = useState(0);
  const levels = value.levels ?? [];
  const set = (i: number, l: FruitLevel) => { const list = [...levels]; list[i] = l; onChange({ levels: list }); };
  return (
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        {levels.map((l, i) => (
          <button type="button" key={i} onClick={() => setSel(i)}
            class={`h-11 min-w-11 rounded-xl px-2 text-lg font-black ${sel === i ? 'bg-emerald-600 text-white' : validateLevel(l).length ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>{i + 1}</button>
        ))}
        <button type="button" class="ck-btn-sm" onClick={() => { onChange({ levels: [...levels, { piece: levels[sel]?.piece ?? 'N', start: 'a1', fruits: [], rocks: [] }] }); setSel(levels.length); }}>＋ Nivel</button>
        {levels.length > 1 && <button type="button" class="ck-btn-sm text-rose-600" onClick={() => { onChange({ levels: levels.filter((_, k) => k !== sel) }); setSel(Math.max(0, sel - 1)); }}>🗑 Quitar #{sel + 1}</button>}
      </div>
      {levels[sel] && <LevelGrid level={levels[sel]} onChange={(l) => set(sel, l)} />}
    </div>
  );
}
