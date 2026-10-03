// One conversation (class chat or private chat): message list, composer and chess sharing.
// Shared by the student chat and the coach's chat panel. Boards are loaded lazily (ChessTools).
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Modal } from '../ui/Modal';
import { MiniFen } from './MiniFen';
import { sfx } from '../../lib/sfx';
import { gameLabel, MAX_TEXT, type ChatGame, type ChatMessage, type ChatPuzzle, type ShareInput } from '../../lib/chat';

type Tools = typeof import('./ChessTools');
let toolsPromise: Promise<Tools> | null = null;
const loadTools = () => (toolsPromise ??= import('./ChessTools'));

type Sheet =
  | { type: 'menu' } | { type: 'pick' } | { type: 'build' }
  | { type: 'solve'; puzzle: ChatPuzzle; from: string } | { type: 'view'; game: ChatGame; from: string };

interface ShareActivity { id: number; title: string; puzzles: { fen: string; prompt: string }[] }

export interface ChatViewProps {
  messages: ChatMessage[];
  canWrite: boolean;
  /** Sends a message; resolves to an error text or null. */
  send: (text: string, share?: ShareInput) => Promise<string | null>;
  puzzlesUrl: string;
  showNames: boolean;
  emptyText: string;
  placeholder?: string;
  note?: ComponentChildren; // reminder above the composer
  onReport?: (id: number) => Promise<void>;
  onModerate?: (id: number, action: 'hide' | 'unhide') => Promise<void>;
}

const fmtTime = (at: number) => {
  const d = new Date(at * 1000);
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'Europe/Madrid' };
  const day = d.toLocaleDateString('es-ES', opts);
  const time = d.toLocaleTimeString('es-ES', { ...opts, hour: '2-digit', minute: '2-digit' });
  return day === new Date().toLocaleDateString('es-ES', opts) ? time : `${d.toLocaleDateString('es-ES', { ...opts, day: 'numeric', month: 'short' })} ${time}`;
};

export function ChatView(p: ChatViewProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [tools, setTools] = useState<Tools | null>(null);
  const [acts, setActs] = useState<ShareActivity[] | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [reported, setReported] = useState<Set<number>>(new Set());
  const list = useRef<HTMLDivElement>(null);
  const lastId = p.messages.at(-1)?.id ?? 0;

  // Keep the newest message in view.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  async function open(s: Sheet) {
    sfx.tap();
    setSheet(s);
    if (s.type !== 'menu' && s.type !== 'pick' && !tools) setTools(await loadTools());
    if (s.type === 'pick' && !acts) {
      try {
        const r = await fetch(p.puzzlesUrl);
        setActs(r.ok ? ((await r.json()) as { activities: ShareActivity[] }).activities : []);
      } catch { setActs([]); }
    }
  }

  async function submit(share?: ShareInput) {
    if (busy) return;
    if (!share && !text.trim()) return;
    setBusy(true);
    setError('');
    const err = await p.send(text, share);
    setBusy(false);
    if (err) { setError(err); sfx.wrong(); return; }
    setText('');
    setSheet(null);
    sfx.pop();
  }

  async function report(id: number) {
    setConfirmId(null);
    await p.onReport?.(id);
    setReported((r) => new Set(r).add(id));
    sfx.tap();
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <div ref={list} class="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-3" role="log" aria-live="polite" aria-relevant="additions">
        {p.messages.length === 0 && <p class="py-10 text-center font-bold text-slate-500">{p.emptyText}</p>}
        {p.messages.map((m) => (
          <div key={m.id} class={`flex items-end gap-2 ${m.mine ? 'flex-row-reverse' : ''}`}>
            {!m.mine && <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-sm" aria-hidden="true">{m.who.avatar}</span>}
            <div class={`min-w-0 max-w-[82%] ${m.mine ? 'items-end' : 'items-start'} flex flex-col`}>
              {!m.mine && (p.showNames || m.who.type === 'coach') && (
                <span class={`mb-0.5 px-2 text-xs font-extrabold ${m.who.type === 'coach' ? 'text-gold-800' : 'text-slate-500'}`}>
                  {m.who.type === 'coach' ? `Profe ${m.who.name}` : m.who.name}
                </span>
              )}
              <div class={`max-w-full rounded-3xl px-4 py-2.5 shadow-sm ${m.hidden ? 'opacity-50 outline-2 outline-dashed outline-slate-400' : ''} ${
                m.mine ? 'rounded-br-md bg-brand-600 text-white' : m.who.type === 'coach' ? 'rounded-bl-md bg-gold-100 text-slate-800 ring-1 ring-gold-300' : 'rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-100'
              }`}>
                {m.puzzle && (
                  <button type="button" aria-label={`Resolver el problema de ${m.who.name}`} onClick={() => open({ type: 'solve', puzzle: m.puzzle!, from: m.who.name })}
                    class="mb-1 flex flex-col items-center gap-1.5 rounded-2xl bg-white/90 p-2 text-slate-800">
                    <MiniFen fen={m.puzzle.fen} />
                    <span class="text-sm font-extrabold">🧩 {m.puzzle.prompt || 'Problema'}</span>
                    <span class="rounded-xl bg-emerald-500 px-3 py-1 font-display text-sm font-extrabold text-white">¡Resolver!</span>
                  </button>
                )}
                {m.game && (
                  <button type="button" aria-label={`Ver la ${gameLabel(m.game).toLowerCase()} de ${m.who.name}`} onClick={() => open({ type: 'view', game: m.game!, from: m.who.name })}
                    class="mb-1 flex flex-col items-center gap-1.5 rounded-2xl bg-white/90 p-2 text-slate-800">
                    <MiniFen fen={m.game.fen} />
                    <span class="text-sm font-extrabold">♟️ {gameLabel(m.game)}</span>
                    <span class="rounded-xl bg-brand-600 px-3 py-1 font-display text-sm font-extrabold text-white">{m.game.moves.length ? '▶ Ver partida' : '👀 Ver posición'}</span>
                  </button>
                )}
                {m.body && <p class="whitespace-pre-wrap font-semibold [overflow-wrap:anywhere]">{m.body}</p>}
              </div>
              <div class="mt-0.5 flex flex-wrap items-center gap-x-2 px-2 text-xs font-bold text-slate-600">
                <span>{fmtTime(m.at)}</span>
                {m.hidden && <span>🙈 Oculto</span>}
                {!!m.flagged && <span class="text-amber-700">{m.flagged === 1 ? '🚩 Avisado' : '⚠️ Palabra tapada'}</span>}
                {p.onReport && !m.mine && m.who.type === 'student' && (
                  reported.has(m.id) ? <span class="text-emerald-700">✅ Avisado al profe</span>
                    : confirmId === m.id ? (
                      <span class="flex items-center gap-1">
                        🚩 ¿Avisar al profe?
                        <button type="button" class="min-h-11 min-w-11 rounded-lg bg-amber-400 px-2 text-amber-950" onClick={() => report(m.id)}>Sí</button>
                        <button type="button" class="min-h-11 min-w-11 rounded-lg bg-slate-200 px-2" onClick={() => setConfirmId(null)}>No</button>
                      </span>
                    ) : <button type="button" class="min-h-11 min-w-11 text-base" onClick={() => setConfirmId(m.id)} aria-label="Avisar al profe de este mensaje" title="Avisar al profe">🚩</button>
                )}
                {p.onModerate && (
                  <button type="button" class="min-h-11 rounded-lg bg-slate-100 px-2 text-slate-700" onClick={() => p.onModerate!(m.id, m.hidden ? 'unhide' : 'hide')}>
                    {m.hidden ? '👁️ Mostrar' : '🙈 Ocultar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {p.canWrite && (
        <div class="border-t border-slate-100 pt-2">
          {p.note}
          {error && <p class="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800" role="alert">{error}</p>}
          <form class="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <button type="button" onClick={() => open({ type: 'menu' })} class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-2xl text-white shadow-[0_4px_0_#047857] motion-safe:active:translate-y-1 active:shadow-none" aria-label="Compartir ajedrez" title="Compartir un problema o una partida">♟️</button>
            <label class="sr-only" for="chat-text">Mensaje</label>
            <textarea id="chat-text" rows={1} maxLength={MAX_TEXT} value={text} placeholder={p.placeholder ?? 'Escribe un mensaje…'}
              class="ck-input max-h-28 min-h-12 flex-1 resize-none py-3"
              onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !(e as any).isComposing && matchMedia('(pointer: fine)').matches) { e.preventDefault(); submit(); } }} />
            <button type="submit" disabled={busy || !text.trim()} class="ck-btn ck-btn-primary h-12 shrink-0 !px-4" aria-label="Enviar">➤</button>
          </form>
          {text.length > MAX_TEXT - 50 && <p class="mt-1 text-right text-xs font-bold text-slate-500">{text.length}/{MAX_TEXT}</p>}
        </div>
      )}

      <Modal open={!!sheet} onClose={() => setSheet(null)} wide={sheet?.type === 'pick'}>
        {sheet?.type === 'menu' && (
          <div>
            <h2 class="mb-4 text-center font-display text-2xl font-extrabold">¿Qué quieres compartir?</h2>
            <div class="grid gap-3">
              <button type="button" class="flex min-h-16 items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-left ring-2 ring-emerald-200" onClick={() => open({ type: 'pick' })}>
                <span class="text-4xl" aria-hidden="true">🧩</span>
                <span><b class="block font-display text-lg">Un problema</b><span class="text-sm text-slate-600">De tus misiones, ¡a ver quién lo resuelve!</span></span>
              </button>
              <button type="button" class="flex min-h-16 items-center gap-3 rounded-2xl bg-brand-50 p-4 text-left ring-2 ring-brand-200" onClick={() => open({ type: 'build' })}>
                <span class="text-4xl" aria-hidden="true">♟️</span>
                <span><b class="block font-display text-lg">Una partida</b><span class="text-sm text-slate-600">Mueve las piezas en el tablero y envíala</span></span>
              </button>
            </div>
            {text.trim() && <p class="mt-3 text-center text-xs font-bold text-slate-500">Tu texto se enviará junto al tablero 💬</p>}
          </div>
        )}
        {sheet?.type === 'pick' && (
          <div>
            <h2 class="mb-3 font-display text-2xl font-extrabold">🧩 Elige un problema</h2>
            {!acts && <p class="py-6 text-center font-bold text-slate-500">Cargando… ⏳</p>}
            {acts && !acts.length && <p class="py-6 text-center font-bold text-slate-500">Aún no hay problemas en las misiones de tu clase.</p>}
            {acts?.map((a) => (
              <section key={a.id} class="mb-5">
                <h3 class="mb-2 font-bold text-slate-700">{a.title}</h3>
                <div class="flex flex-wrap gap-3">
                  {a.puzzles.map((pz, i) => (
                    <button key={i} type="button" disabled={busy} onClick={() => submit({ type: 'puzzle', activityId: a.id, index: i })}
                      class="flex flex-col items-center gap-1 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200 transition hover:ring-emerald-400 motion-safe:active:scale-95">
                      <MiniFen fen={pz.fen} size={104} />
                      <span class="max-w-[104px] truncate text-xs font-bold text-slate-600">{pz.prompt || `Problema ${i + 1}`}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {error && <p class="mt-2 text-sm font-bold text-amber-800" role="alert">{error}</p>}
          </div>
        )}
        {(sheet?.type === 'build' || sheet?.type === 'solve' || sheet?.type === 'view') && !tools && <p class="py-10 text-center font-bold text-slate-500">Preparando el tablero… ♟️</p>}
        {sheet?.type === 'build' && tools && (
          <>
            <h2 class="mb-3 font-display text-2xl font-extrabold">♟️ Enviar una partida</h2>
            <tools.GameBuilder busy={busy} onSend={(g) => submit({ type: 'game', ...g })} />
            {error && <p class="mt-2 text-sm font-bold text-amber-800" role="alert">{error}</p>}
          </>
        )}
        {sheet?.type === 'solve' && tools && (
          <>
            <h2 class="mb-3 font-display text-xl font-extrabold">🧩 Problema de {sheet.from}</h2>
            <tools.PuzzleSolver puzzle={sheet.puzzle} />
          </>
        )}
        {sheet?.type === 'view' && tools && (
          <>
            <h2 class="mb-3 font-display text-xl font-extrabold">♟️ {gameLabel(sheet.game)} de {sheet.from}</h2>
            <tools.GameViewer game={sheet.game} />
          </>
        )}
      </Modal>
    </div>
  );
}
