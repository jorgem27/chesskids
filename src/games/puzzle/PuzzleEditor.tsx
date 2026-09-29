import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { Chess } from 'chess.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Board, isPromotion, syncBoard } from '../chess/Board';
import type { EditorProps } from '../types';
import { applyUci, validatePuzzleSet, type Puzzle, type PuzzleSetContent } from './logic';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function PuzzleRecorder({ puzzle, onChange }: { puzzle: Puzzle; onChange: (p: Puzzle) => void }) {
  const cg = useRef<Api | null>(null);
  const ref = useRef(puzzle);
  ref.current = puzzle;
  const [fenInput, setFenInput] = useState(puzzle.fen);
  const [fenError, setFenError] = useState('');

  function position(p: Puzzle) {
    const c = new Chess(p.fen);
    for (const m of p.moves) applyUci(c, m);
    return c;
  }

  function refresh(p: Puzzle) {
    if (!cg.current) return;
    let c: Chess;
    try { c = position(p); } catch { return; }
    const color = new Chess(p.fen).turn() === 'w' ? 'white' : 'black';
    cg.current.set({ orientation: color });
    syncBoard(cg.current, c, { movable: c.turn() === 'w' ? 'white' : 'black', lastMove: p.moves.at(-1) });
  }

  useEffect(() => { setFenInput(puzzle.fen); refresh(puzzle); }, [puzzle.fen]);
  useEffect(() => { refresh(puzzle); }, [puzzle.moves.length]);

  function onMove(orig: Key, dest: Key) {
    const p = ref.current;
    const c = position(p);
    let uci = orig + dest;
    if (isPromotion(c, orig, dest)) uci += 'q';
    onChange({ ...p, moves: [...p.moves, uci] });
  }

  function applyFen(f: string) {
    try {
      new Chess(f.trim());
      setFenError('');
      onChange({ ...ref.current, fen: f.trim(), moves: [] });
    } catch {
      setFenError('FEN no válido');
    }
  }

  const sans = (() => {
    try {
      const c = new Chess(puzzle.fen);
      return puzzle.moves.map((m) => applyUci(c, m)?.san ?? m);
    } catch { return puzzle.moves; }
  })();

  return (
    <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div class="w-full max-w-md">
        <Board config={{ fen: puzzle.fen }} onReady={(a) => { cg.current = a; a.set({ movable: { events: { after: onMove } } }); refresh(ref.current); }} />
      </div>
      <div class="space-y-3 text-sm">
        <label class="block font-bold">Posición (FEN)
          <div class="mt-1 flex gap-2">
            <input class="ck-input flex-1 font-mono text-xs" value={fenInput} onInput={(e) => setFenInput((e.target as HTMLInputElement).value)} />
            <button type="button" class="ck-btn-sm" onClick={() => applyFen(fenInput)}>Usar</button>
          </div>
          {fenError && <span class="text-rose-600">{fenError}</span>}
        </label>
        <p class="text-slate-500">Consejo: copia el FEN desde el editor de Lichess (lichess.org/editor).</p>
        <label class="block font-bold">Enunciado (opcional)
          <input class="ck-input mt-1 w-full" placeholder="Ej: Mate en 2" value={puzzle.prompt ?? ''}
            onInput={(e) => onChange({ ...ref.current, prompt: (e.target as HTMLInputElement).value })} />
        </label>
        <div class="rounded-2xl bg-violet-50 p-3">
          <p class="font-bold text-violet-800">🎬 Solución grabada</p>
          <p class="text-slate-600">Juega en el tablero la solución: tu jugada, la respuesta del rival, tu jugada…</p>
          <p class="mt-2 min-h-6 font-mono text-base">
            {sans.length ? sans.map((s, i) => <span key={i} class={i % 2 === 0 ? 'font-bold text-violet-700' : 'text-slate-500'}>{s} </span>) : <span class="text-slate-400">— sin jugadas —</span>}
          </p>
          <div class="mt-2 flex gap-2">
            <button type="button" class="ck-btn-sm" disabled={!puzzle.moves.length} onClick={() => onChange({ ...ref.current, moves: ref.current.moves.slice(0, -1) })}>↶ Deshacer</button>
            <button type="button" class="ck-btn-sm" disabled={!puzzle.moves.length} onClick={() => onChange({ ...ref.current, moves: [] })}>Borrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PuzzleEditor({ value, onChange }: EditorProps<PuzzleSetContent>) {
  const [sel, setSel] = useState(0);
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const puzzles = value.puzzles ?? [];
  const errors = validatePuzzleSet(value);
  const isBlitz = 'timeLimitSec' in value;

  function update(i: number, p: Puzzle) {
    const list = [...puzzles];
    list[i] = p;
    onChange({ ...value, puzzles: list });
  }
  function add() {
    onChange({ ...value, puzzles: [...puzzles, { fen: puzzles[sel]?.fen ?? START, moves: [], prompt: '' }] });
    setSel(puzzles.length);
  }
  function remove(i: number) {
    onChange({ ...value, puzzles: puzzles.filter((_, k) => k !== i) });
    setSel(Math.max(0, i - 1));
  }
  function importBulk() {
    // One puzzle per line: FEN | e2e4 e7e5 ...  (also accepts Lichess CSV "id,FEN,Moves,...")
    const items: Puzzle[] = [];
    for (const raw of bulk.split('\n').map((l) => l.trim()).filter(Boolean)) {
      let fen = '', moves: string[] = [], lichess = false;
      if (raw.includes('|')) {
        const [f, m] = raw.split('|');
        fen = f.trim(); moves = m.trim().split(/\s+/);
      } else {
        const parts = raw.split(',');
        if (parts.length >= 3) { fen = parts[1]; moves = parts[2].trim().split(/\s+/); lichess = true; }
      }
      try {
        const c = new Chess(fen);
        if (lichess && moves.length) { applyUci(c, moves[0]); fen = c.fen(); moves = moves.slice(1); }
        items.push({ fen, moves, prompt: '' });
      } catch { /* skip bad line */ }
    }
    if (items.length) {
      onChange({ ...value, puzzles: [...puzzles, ...items] });
      setBulk('');
      setShowBulk(false);
    }
  }

  return (
    <div class="space-y-4">
      {isBlitz && (
        <label class="flex items-center gap-3 font-bold">⏱️ Segundos por problema (0 = sin reloj)
          <input type="number" min={0} max={120} class="ck-input w-24" value={value.timeLimitSec ?? 0}
            onInput={(e) => onChange({ ...value, timeLimitSec: Number((e.target as HTMLInputElement).value) })} />
        </label>
      )}
      <div class="flex flex-wrap items-center gap-2">
        {puzzles.map((p, i) => (
          <button type="button" key={i} onClick={() => setSel(i)}
            class={`h-11 w-11 rounded-xl text-lg font-black ${sel === i ? 'bg-violet-600 text-white' : p.moves.length ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>{i + 1}</button>
        ))}
        <button type="button" class="ck-btn-sm" onClick={add}>＋ Problema</button>
        <button type="button" class="ck-btn-sm" onClick={() => setShowBulk(!showBulk)}>📋 Importar varios</button>
        {puzzles[sel] && <button type="button" class="ck-btn-sm text-rose-600" onClick={() => remove(sel)}>🗑 Quitar #{sel + 1}</button>}
      </div>
      {showBulk && (
        <div class="space-y-2 rounded-2xl bg-slate-50 p-3 text-sm">
          <p>Un problema por línea: <code>FEN | jugadas UCI</code> (ej. <code>6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1 | a1a8</code>). También acepta líneas del CSV de puzzles de Lichess.</p>
          <textarea class="ck-input h-32 w-full font-mono text-xs" value={bulk} onInput={(e) => setBulk((e.target as HTMLTextAreaElement).value)} />
          <button type="button" class="ck-btn-sm" onClick={importBulk}>Importar</button>
        </div>
      )}
      {puzzles[sel] ? (
        <PuzzleRecorder key={sel} puzzle={puzzles[sel]} onChange={(p) => update(sel, p)} />
      ) : (
        <p class="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">Pulsa «＋ Problema» para empezar.</p>
      )}
      {errors.length > 0 && puzzles.length > 0 && (
        <ul class="list-disc rounded-2xl bg-amber-50 p-3 pl-8 text-sm text-amber-800">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
    </div>
  );
}
