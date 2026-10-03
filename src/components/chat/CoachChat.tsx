// Coach chat panel for one class: chat on/off, messages to review, every conversation (read-only
// for private chats) and the class chat, where the coach can also write.
import { useEffect, useRef, useState } from 'preact/hooks';
import { ChatView } from './ChatView';
import { parseThread, type ChatMessage, type ChatMode, type ShareInput } from '../../lib/chat';

interface Overview {
  mode: ChatMode;
  canModerate: boolean;
  canWrite: boolean;
  students: { id: number; name: string; avatar: string; archived: number }[];
  threads: { thread: string; n: number; last_id: number }[];
  flagged: ChatMessage[];
}

const MODES: { id: ChatMode; label: string; help: string }[] = [
  { id: 'on', label: '💬 Todo', help: 'Chat de la clase y chats privados entre alumnos' },
  { id: 'group', label: '👥 Solo clase', help: 'Solo el chat de la clase' },
  { id: 'off', label: '💤 Apagado', help: 'Los alumnos no ven el chat' },
];

export default function CoachChat({ classId }: { classId: number }) {
  const [home, setHome] = useState<Overview | null>(null);
  const [thread, setThread] = useState('clase');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const threadRef = useRef(thread);
  threadRef.current = thread;
  const lastId = useRef(0);
  const api = `/api/coach/chat?classId=${classId}`;

  useEffect(() => {
    loadHome();
    select('clase');
    const h = setInterval(() => { if (!document.hidden) loadHome(); }, 30000);
    const t = setInterval(() => { if (!document.hidden) poll(); }, 5000);
    return () => { clearInterval(h); clearInterval(t); };
  }, []);

  async function loadHome() {
    try {
      const r = await fetch(api);
      const d = (await r.json()) as any;
      if (!r.ok) { setError(d.error ?? 'No se pudo cargar'); return; }
      setHome(d);
    } catch { setError('No se pudo cargar el chat'); }
  }

  async function poll(fresh = false) {
    const t = threadRef.current;
    try {
      const r = await fetch(`${api}&t=${encodeURIComponent(t)}&after=${fresh ? 0 : lastId.current}`);
      if (!r.ok || threadRef.current !== t) return;
      const { messages: got } = (await r.json()) as { messages: ChatMessage[] };
      if (fresh) setMessages(got);
      else if (got.length) setMessages((old) => [...old, ...got.filter((m) => !old.some((o) => o.id === m.id))]);
      if (got.length) lastId.current = Math.max(lastId.current, got.at(-1)!.id);
    } catch { /* next tick */ }
  }

  function select(t: string) {
    setThread(t);
    threadRef.current = t;
    setMessages([]);
    lastId.current = 0;
    poll(true);
  }

  async function patch(body: object) {
    const r = await fetch('/api/coach/chat', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ classId, ...body }) });
    const d = (await r.json().catch(() => ({}))) as any;
    if (!r.ok) { setError(d.error ?? 'No se pudo guardar'); return false; }
    setError('');
    return true;
  }

  async function moderate(id: number, action: 'hide' | 'unhide' | 'dismiss') {
    if (!(await patch({ id, action }))) return;
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, hidden: action === 'hide' ? true : action === 'unhide' ? false : m.hidden, flagged: action === 'dismiss' ? 0 : m.flagged } : m)));
    loadHome();
  }

  async function setMode(mode: ChatMode) {
    if (await patch({ chatMode: mode })) setHome((h) => h && { ...h, mode });
  }

  async function send(text: string, share?: ShareInput): Promise<string | null> {
    try {
      const r = await fetch('/api/coach/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ classId, text, share }) });
      const d = (await r.json()) as any;
      if (!r.ok) return d.error ?? 'No se pudo enviar';
      await poll();
      return null;
    } catch { return 'No se pudo enviar'; }
  }

  const who = (id: number) => home?.students.find((s) => s.id === id);
  const threadName = (t: string) => {
    const p = parseThread(t);
    if (!p) return t;
    if (p.group) return '👥 Chat de la clase';
    const a = who(p.a), b = who(p.b);
    return `${a?.avatar ?? '🙂'} ${a?.name ?? 'Alumno borrado'} ↔ ${b?.avatar ?? '🙂'} ${b?.name ?? 'Alumno borrado'}`;
  };

  if (!home) return <p class="ck-card text-slate-500">{error || 'Cargando el chat…'}</p>;
  const dms = home.threads.filter((t) => t.thread !== 'clase');
  const group = home.threads.find((t) => t.thread === 'clase');
  const flaggedThreads = new Set(home.flagged.map((m) => m.thread));

  return (
    <div class="grid gap-5 lg:grid-cols-[340px_1fr]">
      <aside class="space-y-4">
        <section class="ck-card !p-4">
          <h2 class="font-display text-lg font-extrabold">Chat de la clase</h2>
          <div class="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Modo del chat">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={home.mode === m.id} disabled={!home.canModerate}
                onClick={() => setMode(m.id)} title={m.help}
                class={`min-h-11 rounded-xl px-2 text-sm font-bold ${home.mode === m.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'} disabled:opacity-60`}>
                {m.label}
              </button>
            ))}
          </div>
          <p class="mt-2 text-xs text-slate-500">{MODES.find((m) => m.id === home.mode)?.help}. Solo texto y ajedrez: sin imágenes, stickers ni enlaces. Se quitan teléfonos y correos, y los insultos se tapan y aparecen aquí para revisar. Los mensajes se borran solos a los 180 días.</p>
          {!home.canModerate && <p class="mt-2 text-xs font-bold text-amber-700">Puedes leer el chat; para moderarlo necesitas el permiso de gestionar alumnos.</p>}
        </section>

        {error && <p class="rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800" role="alert">{error}</p>}

        <section class="ck-card !p-4">
          <h2 class="font-display text-lg font-extrabold">🚩 Para revisar {home.flagged.length > 0 && <span class="ml-1 rounded-full bg-amber-400 px-2 text-sm text-amber-950">{home.flagged.length}</span>}</h2>
          {home.flagged.length === 0 && <p class="mt-1 text-sm text-slate-500">Nada pendiente. Aquí aparecen los mensajes que un alumno te avisa o que el filtro detecta.</p>}
          <ul class="mt-2 space-y-2">
            {home.flagged.map((m) => (
              <li key={m.id} class="rounded-2xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
                <p class="text-xs font-bold text-slate-500">{m.flagged === 1 ? '🚩 Avisado por un alumno' : '⚠️ Filtro de palabras'} · {threadName(m.thread)}</p>
                <p class="mt-1"><b>{m.who.avatar} {m.who.name}:</b> {m.body || (m.puzzle ? '🧩 Problema' : '♟️ Partida')}</p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <button type="button" class="ck-btn-sm" onClick={() => select(m.thread)}>Ver conversación</button>
                  {home.canModerate && <button type="button" class="ck-btn-sm" onClick={() => moderate(m.id, m.hidden ? 'unhide' : 'hide')}>{m.hidden ? '👁️ Mostrar' : '🙈 Ocultar'}</button>}
                  {home.canModerate && <button type="button" class="ck-btn-sm" onClick={() => moderate(m.id, 'dismiss')}>✔️ Revisado</button>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section class="ck-card !p-4">
          <h2 class="font-display text-lg font-extrabold">Conversaciones</h2>
          <nav class="mt-2 space-y-1" aria-label="Conversaciones">
            <button type="button" onClick={() => select('clase')} aria-current={thread === 'clase' ? 'true' : undefined}
              class={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-bold ${thread === 'clase' ? 'bg-brand-600 text-white' : 'hover:bg-slate-50'}`}>
              <span class="flex-1">👥 Chat de la clase</span><span class="tabular-nums opacity-70">{group?.n ?? 0}</span>
            </button>
            {dms.length === 0 && <p class="px-3 py-2 text-xs text-slate-500">Aún no hay chats privados.</p>}
            {dms.map((t) => (
              <button key={t.thread} type="button" onClick={() => select(t.thread)} aria-current={thread === t.thread ? 'true' : undefined}
                class={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-bold ${thread === t.thread ? 'bg-brand-600 text-white' : 'hover:bg-slate-50'}`}>
                <span class="min-w-0 flex-1 truncate">{threadName(t.thread)}</span>
                {flaggedThreads.has(t.thread) && <span title="Mensajes para revisar">🚩</span>}
                <span class="tabular-nums opacity-70">{t.n}</span>
              </button>
            ))}
          </nav>
        </section>
      </aside>

      <section class="ck-card flex h-[calc(100dvh-12rem)] min-h-[480px] flex-col !p-4" aria-label="Conversación">
        <header class="border-b border-slate-100 pb-2">
          <h2 class="font-display text-xl font-extrabold">{threadName(thread)}</h2>
          <p class="text-xs text-slate-500">{thread === 'clase' ? 'Tus mensajes los ve toda la clase.' : 'Chat privado entre alumnos: solo lectura. Los profes escriben solo en el chat de la clase.'}</p>
        </header>
        <ChatView
          messages={messages} canWrite={thread === 'clase' && home.canWrite} send={send}
          puzzlesUrl={`${api}&view=puzzles`} showNames
          emptyText="Aún no hay mensajes."
          placeholder="Escribe a toda la clase…"
          onModerate={home.canModerate ? (id, action) => moderate(id, action) : undefined}
        />
      </section>
    </div>
  );
}
