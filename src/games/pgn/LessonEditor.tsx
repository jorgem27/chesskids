// Visual editor for interactive lessons: paste a PGN and/or a FEN, walk through the game on a board
// and add questions, comments, hints, alternatives and arrows with buttons. The lesson is still saved
// as PGN (see doc.ts), so the player and the server validation don't change.
import type { Api } from '@lichess-org/chessground/api';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Key } from '@lichess-org/chessground/types';
import { Chess } from 'chess.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Board, isPromotion, syncBoard } from '../chess/Board';
import type { LessonContent } from '../meta';
import { KIND_LABEL } from '../rules';
import type { EditorProps } from '../types';
import {
  addAlt, altsAt, fenAt, foldOverrides, importPgn, mainPts, noteAt, removeAlt, replaceFrom, serializePgn,
  setMainPts, setNoteAt, startFenOf, truncateAt, updateAlt, type AltKind,
} from './doc';
import { compileLesson, validateLessonPgn } from './lesson';
import { parsePgn, type PgnGame, type Shape } from './parser';

const PENDING_LABEL: Record<AltKind, string> = {
  good: '✅ Juega en el tablero la jugada alternativa que también vale',
  almost: '🟡 Juega en el tablero la jugada «casi» (no es la mejor, puede repetir)',
  wrong: '❌ Juega en el tablero el error típico',
};

const ALT_BTN: Record<AltKind, string> = {
  good: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  almost: 'bg-amber-100 text-amber-800 ring-amber-300',
  wrong: 'bg-rose-100 text-rose-800 ring-rose-300',
};

const ALT_ARROW: Record<AltKind, string> = { good: 'paleGreen', almost: 'paleGrey', wrong: 'paleRed' };

interface Ply { fen: string; uci?: string; san?: string }

/** Positions of the main line; stops at the first illegal move. */
function replay(game: PgnGame): Ply[] {
  const out: Ply[] = [];
  try {
    const c = new Chess(startFenOf(game));
    out.push({ fen: c.fen() });
    for (const m of game.moves) {
      const mv = c.move(m.san);
      out.push({ fen: c.fen(), uci: mv.from + mv.to + (mv.promotion ?? ''), san: mv.san });
    }
  } catch { /* illegal move or FEN: show what we could replay */ }
  return out;
}

export function LessonEditor({ value, onChange }: EditorProps<LessonContent>) {
  const game = useMemo(() => parsePgn(value.pgn ?? ''), [value.pgn]);
  const line = useMemo(() => replay(game), [game]);
  const errors = validateLessonPgn(value.pgn, value.questions);
  const lesson = useMemo(() => { try { return compileLesson(value.pgn, value.questions); } catch { return null; } }, [value.pgn, value.questions]);

  const last = Math.max(0, line.length - 1);
  const [ply, setPlyRaw] = useState(0);
  const cur = Math.min(ply, last);
  const [pending, setPending] = useState<AltKind | null>(null);
  const [chooser, setChooser] = useState<string | null>(null); // SAN of a new move played mid-game
  const [msg, setMsg] = useState('');
  const [importOpen, setImportOpen] = useState(!game.moves.length);
  const [fenIn, setFenIn] = useState('');
  const [pgnIn, setPgnIn] = useState('');
  const [importErr, setImportErr] = useState('');
  const askRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const hintRef = useRef<HTMLInputElement>(null);
  const [showHint, setShowHint] = useState(false);

  const cg = useRef<Api | null>(null);
  const lastLeftDown = useRef(0);
  const latest = useRef({ game, line, cur, pending, value });
  latest.current = { game, line, cur, pending, value };

  const note = noteAt(game, cur);
  const next = game.moves[cur];
  const alts = altsAt(game, cur);
  const isAsk = note.ask !== undefined;
  const orientation = game.headers.Orientation?.toLowerCase() === 'black' ? 'black'
    : game.headers.Orientation?.toLowerCase() === 'white' ? 'white' : lesson?.orientation ?? 'white';

  function commit(g: PgnGame) {
    const v = latest.current.value;
    const next = { ...v, pgn: serializePgn(g), questions: undefined };
    latest.current = { ...latest.current, game: g, value: next };
    onChange(next);
  }
  /** Edit from the freshest state (a blur can commit just before a click in the same tick). */
  const edit = (fn: (g: PgnGame) => PgnGame) => commit(fn(latest.current.game));
  function setPly(p: number) {
    setPlyRaw(Math.max(0, Math.min(p, latest.current.line.length - 1)));
    setPending(null);
    setChooser(null);
    setMsg('');
  }

  // Lessons saved with the old per-question panel: move those edits into the PGN once.
  useEffect(() => {
    if (value.questions && Object.keys(value.questions).length) {
      try { commit(foldOverrides(game, value.questions)); } catch { /* invalid PGN: leave as is */ }
    }
  }, []);

  // Board follows the current position and shows its arrows (editable) and the alternatives (faint).
  useEffect(() => {
    const api = cg.current;
    const p = line[cur];
    if (!api || !p) return;
    api.set({ orientation });
    const c = new Chess(p.fen);
    syncBoard(api, c, { movable: c.turn() === 'w' ? 'white' : 'black', lastMove: p.uci });
    api.setShapes(note.shapes.map((s) => ({ orig: s.orig as Key, dest: s.dest as Key | undefined, brush: s.brush })));
    api.setAutoShapes(alts.flatMap((a): DrawShape[] => {
      try {
        const m = new Chess(p.fen).move(a.san);
        return [{ orig: m.from as Key, dest: m.to as Key, brush: ALT_ARROW[a.kind] }];
      } catch { return []; }
    }));
  }, [value.pgn, cur, orientation]);

  // ← → to move through the game (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      const c = latest.current.cur;
      if (e.key === 'ArrowLeft') { setPly(c - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setPly(c + 1); e.preventDefault(); }
      else if (e.key === 'Home') setPly(0);
      else if (e.key === 'End') setPly(latest.current.line.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function resync() {
    const { line: l, cur: c } = latest.current;
    const api = cg.current;
    if (!api || !l[c]) return;
    const ch = new Chess(l[c].fen);
    syncBoard(api, ch, { movable: ch.turn() === 'w' ? 'white' : 'black', lastMove: l[c].uci });
  }

  function onBoardMove(orig: Key, dest: Key) {
    const { game: g, line: l, cur: c, pending: pk } = latest.current;
    const ch = new Chess(l[c].fen);
    let san: string;
    try { san = ch.move({ from: orig, to: dest, promotion: isPromotion(ch, orig, dest) ? 'q' : undefined }).san; } catch { resync(); return; }
    const nextMove = g.moves[c];

    if (pk) {
      setTimeout(resync, 200);
      if (!nextMove) { setMsg('Primero juega la jugada de la partida (la respuesta correcta).'); return; }
      if (nextMove.san === san) { setMsg('Esa ya es la jugada de la partida. Juega otra distinta.'); return; }
      addAlternative(pk, san);
      return;
    }
    if (!nextMove) {
      commit(replaceFrom(g, c, san));
      setPlyRaw(c + 1);
      return;
    }
    if (l[c + 1]?.san === san) { setPly(c + 1); return; }
    setTimeout(resync, 200);
    if (altsAt(g, c).some((a) => a.san === san)) { setMsg(`${san} ya está en la lista de alternativas.`); return; }
    setChooser(san);
  }

  function addAlternative(kind: AltKind, san: string) {
    const { game: g, cur: c } = latest.current;
    let ng = g;
    if (noteAt(ng, c).ask === undefined) ng = setNoteAt(ng, c, { ask: '' });
    ng = addAlt(ng, c, san, kind, kind === 'good' ? Math.round(mainPts(ng, c) / 2) : undefined);
    commit(ng);
    setPending(null);
    setChooser(null);
    setMsg(kind === 'good' ? `✅ ${san} añadida: también vale (mitad de puntos, puedes cambiarlo).` : kind === 'almost' ? `🟡 ${san} añadida como «casi».` : `❌ ${san} añadida como error típico.`);
  }

  function onShapes(shapes: DrawShape[]) {
    const api = cg.current;
    const { game: g, cur: c } = latest.current;
    // A left click on the board clears arrows in Chessground; in the editor that would lose work.
    if (!shapes.length && Date.now() - lastLeftDown.current < 400) {
      const keep = noteAt(g, c).shapes;
      if (keep.length && api) {
        api.setShapes(keep.map((s) => ({ orig: s.orig as Key, dest: s.dest as Key | undefined, brush: s.brush })));
        return;
      }
    }
    const next: Shape[] = shapes.map((s) => ({ orig: s.orig, dest: s.dest, brush: s.brush ?? 'green' }));
    commit(setNoteAt(g, c, { shapes: next }));
  }

  function toggleAsk() {
    if (isAsk) { edit((g) => setNoteAt(g, cur, { ask: undefined, hint: undefined })); return; }
    edit((g) => setNoteAt(g, cur, { ask: '' }));
    setTimeout(() => askRef.current?.focus(), 50);
  }

  function doImport() {
    if (game.moves.length && !confirm('Se sustituirá la lección actual. ¿Seguimos?')) return;
    const r = importPgn(pgnIn, fenIn);
    if (!r.game) { setImportErr(r.error ?? 'No se pudo leer'); return; }
    setImportErr('');
    commit(r.game);
    setPlyRaw(0);
    setImportOpen(false);
    setPgnIn('');
    setFenIn('');
  }

  function flip() {
    commit({ ...game, headers: { ...game.headers, Orientation: orientation === 'white' ? 'black' : 'white' } });
  }

  const moveNo = (i: number) => {
    const [, turn, , , , full] = startFenOf(game).split(' ');
    const p = i + (turn === 'b' ? 1 : 0);
    return { n: Number(full || 1) + Math.floor(p / 2), white: p % 2 === 0 };
  };
  const posLabel = cur === 0 ? 'Posición inicial' : (() => { const { n, white } = moveNo(cur - 1); return `Después de ${n}${white ? '.' : '...'} ${line[cur].san}`; })();

  const badges = (p: number) => {
    const n = noteAt(game, p);
    return `${n.ask !== undefined ? '❓' : ''}${n.text ? '💬' : ''}${n.shapes.length ? '🎨' : ''}${n.wait && !n.text ? '⏸' : ''}`;
  };

  return (
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-slate-600">1️⃣ Ve a la posición con ◀ ▶ · 2️⃣ Pulsa <b>❓ Pregunta</b> y escríbela · 3️⃣ El alumno tendrá que jugar la siguiente jugada de la partida</p>
        <button type="button" class="ck-btn-sm" onClick={() => setImportOpen(!importOpen)}>📥 {importOpen ? 'Cerrar' : 'Pegar PGN / posición'}</button>
      </div>

      {importOpen && (
        <div class="space-y-2 rounded-2xl bg-sky-50 p-4 text-sm">
          <p class="font-black text-sky-900">📥 Pega la partida o la posición</p>
          <p class="text-slate-600">Puedes pegar un PGN (de Lichess, ChessBase…), solo una posición (FEN) para jugar tú las jugadas en el tablero, o las dos cosas: la partida empezará desde esa posición.</p>
          <label class="block font-bold">Posición inicial (FEN, opcional)
            <input class="ck-input mt-1 w-full font-mono text-xs font-normal" value={fenIn} placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
              onInput={(e) => setFenIn((e.target as HTMLInputElement).value)} />
          </label>
          <label class="block font-bold">PGN (opcional)
            <textarea class="ck-input mt-1 h-32 w-full font-mono text-xs font-normal" spellcheck={false} value={pgnIn} placeholder="1. e4 e5 2. Nf3 Nc6 …"
              onInput={(e) => setPgnIn((e.target as HTMLTextAreaElement).value)} />
          </label>
          {importErr && <p class="font-bold text-rose-700">⚠️ {importErr}</p>}
          <button type="button" class="ck-btn ck-btn-primary" onClick={doImport}>Cargar en el tablero ▶</button>
        </div>
      )}

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Board + navigation */}
        <div class="space-y-2 lg:sticky lg:top-4 lg:self-start">
          <div class="mx-auto w-full max-w-[520px]" onPointerDownCapture={(e) => { if ((e as PointerEvent).button === 0) lastLeftDown.current = Date.now(); }}>
            <Board config={{ fen: line[0]?.fen, orientation, drawable: { eraseOnMovablePieceClick: false, onChange: onShapes } }}
              onReady={(a) => { cg.current = a; a.set({ movable: { events: { after: onBoardMove } } }); resync(); }} />
          </div>
          <div class="mx-auto flex max-w-[520px] items-center justify-center gap-2">
            <button type="button" class="ck-btn-sm text-lg" title="Inicio" aria-label="Ir al inicio" onClick={() => setPly(0)}>⏮</button>
            <button type="button" class="ck-btn-sm text-lg" title="Anterior (←)" aria-label="Jugada anterior" onClick={() => setPly(cur - 1)}>◀</button>
            <span class="min-w-16 text-center font-mono text-sm text-slate-500">{cur} / {last}</span>
            <button type="button" class="ck-btn-sm text-lg" title="Siguiente (→)" aria-label="Jugada siguiente" onClick={() => setPly(cur + 1)}>▶</button>
            <button type="button" class="ck-btn-sm text-lg" title="Final" aria-label="Ir al final" onClick={() => setPly(last)}>⏭</button>
            <button type="button" class="ck-btn-sm text-lg" title="Girar tablero" aria-label="Girar el tablero" onClick={flip}>🔄</button>
          </div>
          <p class="mx-auto max-w-[520px] text-center text-xs text-slate-500">
            Flechas y círculos como en Lichess: clic derecho <b class="text-green-700">verde</b> · Ctrl <b class="text-red-700">rojo</b> · Alt <b class="text-blue-700">azul</b> · Ctrl+Alt <b class="text-amber-600">amarillo</b>. Repite la flecha para quitarla.
          </p>
        </div>

        {/* Moves + annotations */}
        <div class="space-y-3">
          <div class="max-h-44 overflow-y-auto rounded-2xl bg-slate-50 p-2 text-sm leading-7">
            <button type="button" onClick={() => setPly(0)} class={`mr-1 rounded px-1.5 ${cur === 0 ? 'bg-sky-600 text-white' : 'hover:bg-sky-100'}`}>Inicio{badges(0) && ` ${badges(0)}`}</button>
            {line.slice(1).map((p, i) => {
              const { n, white } = moveNo(i);
              return (
                <span key={i} class="whitespace-nowrap">
                  {(white || i === 0) && <span class="ml-1 text-slate-400">{n}{white ? '.' : '...'}</span>}
                  <button type="button" onClick={() => setPly(i + 1)} aria-current={cur === i + 1 ? 'step' : undefined}
                    class={`mx-0.5 rounded px-1.5 font-mono ${cur === i + 1 ? 'bg-sky-600 text-white' : 'hover:bg-sky-100'} ${game.moves[i].variations.length ? 'underline decoration-dotted' : ''}`}>
                    {p.san}{badges(i + 1) && <span class="font-sans"> {badges(i + 1)}</span>}
                  </button>
                </span>
              );
            })}
            {!game.moves.length && <span class="text-slate-500"> — Juega las jugadas en el tablero o pega un PGN.</span>}
          </div>

          <div class="space-y-3 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
            <p class="text-base font-black">📍 {posLabel}</p>

            <div class="flex flex-wrap gap-2">
              <button type="button" onClick={toggleAsk} aria-pressed={isAsk} title={isAsk ? 'Quitar la pregunta' : 'Preguntar aquí: el alumno debe encontrar la siguiente jugada'} class={`ck-btn-sm ring-1 ${isAsk ? 'bg-sky-600 text-white ring-sky-700' : 'ring-slate-200'}`}>❓ Pregunta</button>
              <button type="button" onClick={() => { if (!note.text) textRef.current?.focus(); else edit((g) => setNoteAt(g, cur, { text: '' })); }}
                class={`ck-btn-sm ring-1 ${note.text ? 'bg-violet-600 text-white ring-violet-700' : 'ring-slate-200'}`}>💬 Comentario</button>
              {isAsk && (
                <button type="button" onClick={() => { setShowHint(true); setTimeout(() => hintRef.current?.focus(), 50); }}
                  class={`ck-btn-sm ring-1 ${note.hint ? 'bg-amber-500 text-white ring-amber-600' : 'ring-slate-200'}`}>💡 Pista</button>
              )}
              {(['good', 'almost', 'wrong'] as AltKind[]).map((k) => (
                <button key={k} type="button" disabled={!next} title={next ? '' : 'Primero juega la respuesta correcta'}
                  onClick={() => { setPending(pending === k ? null : k); setChooser(null); setMsg(''); }} aria-pressed={pending === k}
                  class={`ck-btn-sm ring-1 disabled:opacity-40 ${ALT_BTN[k]} ${pending === k ? 'ring-2 ring-offset-1' : ''}`}>
                  {k === 'good' ? '✅ Alternativa' : k === 'almost' ? '🟡 Casi' : '❌ Error'}
                </button>
              ))}
              <button type="button" onClick={() => edit((g) => setNoteAt(g, cur, { wait: !note.wait }))} aria-pressed={note.wait} title="Parar aquí hasta que el alumno pulse «Continuar»"
                class={`ck-btn-sm ring-1 ${note.wait ? 'bg-slate-700 text-white' : 'ring-slate-200'}`}>⏸ Pausa</button>
              {note.shapes.length > 0 && <button type="button" class="ck-btn-sm ring-1 ring-slate-200" onClick={() => edit((g) => setNoteAt(g, cur, { shapes: [] }))}>🧹 Borrar flechas</button>}
            </div>

            {pending && (
              <p class="flex items-center justify-between gap-2 rounded-xl bg-sky-50 p-2 font-bold text-sky-900">
                <span>👉 {PENDING_LABEL[pending]}</span>
                <button type="button" class="ck-btn-sm" onClick={() => setPending(null)}>Cancelar</button>
              </p>
            )}

            {chooser && (
              <div class="space-y-2 rounded-xl bg-sky-50 p-3">
                <p class="font-bold">Has jugado <b class="font-mono">{chooser}</b> (en la partida: <b class="font-mono">{next?.san}</b>). ¿Qué es?</p>
                <div class="flex flex-wrap gap-2">
                  {(['good', 'almost', 'wrong'] as AltKind[]).map((k) => (
                    <button key={k} type="button" class={`ck-btn-sm ring-1 ${ALT_BTN[k]}`} onClick={() => addAlternative(k, chooser)}>{KIND_LABEL[k]}</button>
                  ))}
                  <button type="button" class="ck-btn-sm ring-1 ring-slate-200" onClick={() => {
                    if (!confirm('Se borrarán las jugadas que venían después. ¿Seguimos?')) return;
                    edit((g) => replaceFrom(g, cur, chooser)); setChooser(null); setPlyRaw(cur + 1);
                  }}>✂️ Cambiar la partida desde aquí</button>
                  <button type="button" class="ck-btn-sm" onClick={() => setChooser(null)}>Cancelar</button>
                </div>
              </div>
            )}

            {msg && <p class="rounded-xl bg-emerald-50 p-2 font-bold text-emerald-800">{msg}</p>}

            <label class="block font-bold">💬 Comentario <span class="font-normal text-slate-500">(la mascota lo dice al llegar aquí)</span>
              <textarea ref={textRef} rows={2} class="ck-input mt-1 w-full font-normal" value={note.text} placeholder="Ej: El alfil apunta a f7, ¡la casilla más débil!"
                onChange={(e) => edit((g) => setNoteAt(g, cur, { text: (e.target as HTMLTextAreaElement).value }))} />
            </label>

            {isAsk && (
              <div class="space-y-2 rounded-xl bg-sky-50 p-3">
                <label class="block font-bold">❓ Pregunta
                  <input ref={askRef} class="ck-input mt-1 w-full font-normal" value={note.ask} placeholder="¿Cuál es la mejor jugada?"
                    onChange={(e) => edit((g) => setNoteAt(g, cur, { ask: (e.target as HTMLInputElement).value }))} />
                </label>
                {next ? (
                  <div class="flex flex-wrap items-center gap-3">
                    <span>Respuesta correcta: <b class="font-mono text-base">{line[cur + 1]?.san ?? next.san}</b> (la jugada de la partida)</span>
                    <label class="flex items-center gap-1 font-bold">⭐ Puntos
                      <input type="number" min={1} max={1000} class="ck-input w-20 !py-1" value={mainPts(game, cur)}
                        onChange={(e) => { const v = Number((e.target as HTMLInputElement).value); edit((g) => setMainPts(g, cur, v > 0 ? v : undefined)); }} />
                    </label>
                  </div>
                ) : (
                  <p class="font-bold text-amber-700">👉 Ahora juega en el tablero la respuesta correcta.</p>
                )}
                {(showHint || note.hint) && (
                  <label class="block font-bold">💡 Pista <span class="font-normal text-slate-500">(se muestra si falla)</span>
                    <input ref={hintRef} class="ck-input mt-1 w-full font-normal" value={note.hint ?? ''} placeholder="Ej: ¡Defiende la casilla f7!"
                      onChange={(e) => edit((g) => setNoteAt(g, cur, { hint: (e.target as HTMLInputElement).value || undefined }))} />
                  </label>
                )}
              </div>
            )}

            {alts.length > 0 && (
              <div class="space-y-2">
                <p class="font-bold">Otras jugadas en esta posición</p>
                {alts.map((a) => (
                  <div key={a.index + a.san} class="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
                    <b class="w-14 font-mono text-base">{a.san}</b>
                    <select class="ck-input !py-1" value={a.kind}
                      onChange={(e) => edit((g) => updateAlt(g, cur, a.index, { kind: (e.target as HTMLSelectElement).value as AltKind }))}>
                      {(Object.keys(KIND_LABEL) as AltKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                    </select>
                    {a.kind === 'good' && (
                      <label class="flex items-center gap-1">Puntos
                        <input type="number" min={1} max={1000} class="ck-input w-20 !py-1" value={a.pts ?? ''}
                          onChange={(e) => edit((g) => updateAlt(g, cur, a.index, { pts: Number((e.target as HTMLInputElement).value) || undefined }))} />
                      </label>
                    )}
                    <input class="ck-input min-w-40 flex-1 !py-1" placeholder="Mensaje para el alumno (opcional)" value={a.text}
                      onChange={(e) => edit((g) => updateAlt(g, cur, a.index, { text: (e.target as HTMLInputElement).value }))} />
                    <button type="button" class="ck-btn-sm text-rose-600" title="Quitar" aria-label={`Quitar ${a.san}`} onClick={() => edit((g) => removeAlt(g, cur, a.index))}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {next && (
              <button type="button" class="text-xs font-bold text-rose-600 hover:underline" onClick={() => {
                if (confirm('¿Borrar todas las jugadas desde aquí?')) edit((g) => truncateAt(g, cur));
              }}>✂️ Borrar las jugadas desde aquí</button>
            )}
          </div>

          {errors.length ? (
            <p class="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">⚠️ {errors.join(' · ')}</p>
          ) : (
            <p class="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✅ Lección lista · {lesson?.steps.length} jugadas · {lesson?.steps.filter((s) => s.kind === 'ask').length} preguntas</p>
          )}
        </div>
      </div>

      <details class="rounded-2xl bg-slate-50 p-3 text-sm">
        <summary class="cursor-pointer font-bold">🛠️ Ver / editar el PGN (avanzado)</summary>
        <textarea class="ck-input mt-2 h-56 w-full font-mono text-xs leading-relaxed" spellcheck={false} value={value.pgn}
          onChange={(e) => onChange({ ...value, pgn: (e.target as HTMLTextAreaElement).value, questions: undefined })} />
        <p class="mt-1 text-slate-500">Etiquetas: <code class="ck-code">[%ask ¿…?]</code> <code class="ck-code">[%hint …]</code> <code class="ck-code">[%pts 50]</code> <code class="ck-code">[%retry]</code> <code class="ck-code">[%wait]</code> <code class="ck-code">[%cal Ge2e4]</code> <code class="ck-code">[%csl Rd4]</code></p>
      </details>
    </div>
  );
}
