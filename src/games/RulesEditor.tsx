// Easy editor for "which other moves count here": pick a move by playing it on a small board,
// then choose what it means (correct too / not the best / mistake), its points and its message.
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { Chess } from 'chess.js';
import { useRef, useState } from 'preact/hooks';
import { Board, isPromotion, syncBoard } from './chess/Board';
import { KIND_LABEL, sameMove, upsertRule, type MoveKind, type MoveRule } from './rules';

interface Props {
  fen: string; // position where the student has to move
  bestUci: string; // the recorded best move (not addable as a rule)
  rules: MoveRule[];
  onChange: (rules: MoveRule[]) => void;
  /** Default points of the step, shown as the placeholder for "correct too" moves. */
  defaultPts: number;
  hidePts?: boolean;
}

function san(fen: string, uci: string): string {
  try {
    const c = new Chess(fen);
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })?.san ?? uci;
  } catch { return uci; }
}

export function RulesEditor({ fen, bestUci, rules, onChange, defaultPts, hidePts }: Props) {
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState('');
  const latest = useRef({ fen, bestUci, rules, onChange });
  latest.current = { fen, bestUci, rules, onChange };
  const cg = useRef<Api | null>(null);

  function reset() {
    if (!cg.current) return;
    const c = new Chess(latest.current.fen);
    cg.current.set({ orientation: c.turn() === 'w' ? 'white' : 'black' });
    syncBoard(cg.current, c, { movable: c.turn() === 'w' ? 'white' : 'black' });
  }

  function onMove(orig: Key, dest: Key) {
    const cur = latest.current;
    const c = new Chess(cur.fen);
    let uci = orig + dest;
    if (isPromotion(c, orig, dest)) uci += 'q';
    setTimeout(reset, 150);
    if (sameMove(uci, cur.bestUci)) { setNote('Esa ya es la jugada principal de la solución.'); return; }
    if (cur.rules.some((r) => sameMove(r.uci, uci))) { setNote('Esa jugada ya está en la lista.'); return; }
    setNote('');
    cur.onChange(upsertRule(cur.rules, { uci, kind: 'good' }));
  }

  function patch(i: number, p: Partial<MoveRule>) {
    onChange(rules.map((r, k) => (k === i ? { ...r, ...p } : r)));
  }

  return (
    <div class="space-y-2">
      {rules.length === 0 && <p class="text-xs text-slate-500">Solo vale la jugada principal. Añade otras jugadas aceptadas, «no es la mejor» o errores con mensaje.</p>}
      {rules.map((r, i) => (
        <div key={r.uci} class="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 text-sm shadow-sm ring-1 ring-slate-200">
          <b class="w-14 font-mono text-base">{san(fen, r.uci)}</b>
          <select class="ck-input !py-1" value={r.kind} onChange={(e) => patch(i, { kind: (e.target as HTMLSelectElement).value as MoveKind })}>
            {(Object.keys(KIND_LABEL) as MoveKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
          {r.kind === 'good' && !hidePts && (
            <label class="flex items-center gap-1">Puntos
              <input type="number" min={0} max={1000} class="ck-input w-20 !py-1" placeholder={String(defaultPts)} value={r.pts ?? ''}
                onInput={(e) => { const v = (e.target as HTMLInputElement).value; patch(i, { pts: v === '' ? undefined : Number(v) }); }} />
            </label>
          )}
          <input class="ck-input min-w-40 flex-1 !py-1" placeholder="Mensaje para el alumno (opcional)" value={r.text ?? ''}
            onInput={(e) => patch(i, { text: (e.target as HTMLInputElement).value })} />
          <button type="button" class="ck-btn-sm text-rose-600" title="Quitar" onClick={() => onChange(rules.filter((_, k) => k !== i))}>✕</button>
        </div>
      ))}
      <button type="button" class="ck-btn-sm" onClick={() => setAdding(!adding)}>{adding ? '✔ Listo' : '＋ Añadir jugada (juégala en el tablero)'}</button>
      {adding && (
        <div class="w-full max-w-xs">
          <Board config={{ fen, coordinates: false }} onReady={(a) => { cg.current = a; a.set({ movable: { events: { after: onMove } } }); reset(); }} />
          {note && <p class="mt-1 text-xs font-bold text-amber-700">{note}</p>}
        </div>
      )}
    </div>
  );
}
