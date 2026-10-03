// Student chat: the class chat plus private chats with classmates. Polls while the page is visible.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Modal } from '../ui/Modal';
import { ChatView } from './ChatView';
import { sfx } from '../../lib/sfx';
import type { ChatMessage, ChatMode, ShareInput } from '../../lib/chat';

interface Overview {
  mode: ChatMode; className: string; classEmoji: string;
  classmates: { id: number; name: string; avatar: string }[];
  unread: { group: number; dm: Record<string, number> };
}

const THREAD_POLL = 4000;
const HOME_POLL = 20000;

export default function StudentChat({ studentId }: { studentId: number }) {
  const [home, setHome] = useState<Overview | null>(null);
  const [to, setTo] = useState<'clase' | number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadError, setLoadError] = useState('');
  const [rules, setRules] = useState(false);
  const toRef = useRef(to);
  toRef.current = to;
  const lastId = useRef(0);
  const rulesKey = `ck-chat-rules-${studentId}`;

  useEffect(() => {
    try { if (!localStorage.getItem(rulesKey)) setRules(true); } catch { setRules(true); }
    loadHome();
    // Open the class chat right away on wide screens (list and chat side by side).
    if (matchMedia('(min-width: 768px)').matches) select('clase');
    const h = setInterval(() => { if (!document.hidden) loadHome(); }, HOME_POLL);
    const t = setInterval(() => { if (!document.hidden && toRef.current !== null) poll(); }, THREAD_POLL);
    return () => { clearInterval(h); clearInterval(t); };
  }, []);

  async function loadHome() {
    try {
      const r = await fetch('/api/chat');
      if (!r.ok) throw new Error();
      setHome((await r.json()) as Overview);
      setLoadError('');
    } catch { setLoadError('Uy, no se pudo cargar el chat. ¿Tienes internet?'); }
  }

  async function poll(fresh = false) {
    const target = toRef.current;
    if (target === null) return;
    try {
      const r = await fetch(`/api/chat?to=${target}&after=${fresh ? 0 : lastId.current}`);
      if (!r.ok || toRef.current !== target) return;
      const { messages: got } = (await r.json()) as { messages: ChatMessage[] };
      if (fresh) setMessages(got);
      else if (got.length) {
        setMessages((old) => [...old, ...got.filter((m) => !old.some((o) => o.id === m.id))]);
        if (got.some((m) => !m.mine)) sfx.pop();
      }
      if (got.length) lastId.current = Math.max(lastId.current, got.at(-1)!.id);
      // Opening a chat reads it: clear its badge.
      setHome((h) => h && (target === 'clase' ? { ...h, unread: { ...h.unread, group: 0 } } : { ...h, unread: { ...h.unread, dm: { ...h.unread.dm, [target]: 0 } } }));
    } catch { /* try again on the next tick */ }
  }

  function select(t: 'clase' | number) {
    sfx.tap();
    setTo(t);
    toRef.current = t;
    setMessages([]);
    lastId.current = 0;
    poll(true);
  }

  async function send(text: string, share?: ShareInput): Promise<string | null> {
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to, text, share }) });
      const d = (await r.json()) as any;
      if (!r.ok) return d.error ?? 'No se pudo enviar';
      await poll();
      return null;
    } catch { return 'No se pudo enviar. ¿Tienes internet?'; }
  }

  async function report(id: number) {
    await fetch('/api/chat', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action: 'report' }) }).catch(() => {});
  }

  function closeRules() {
    try { localStorage.setItem(rulesKey, '1'); } catch { /* private mode: show again next time */ }
    setRules(false);
    sfx.tap();
  }

  const banner = (
    <div class="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 ring-1 ring-amber-200" role="note">
      <span class="text-2xl" aria-hidden="true">🔓</span>
      <p>Este chat <b>no es secreto</b>: los mensajes no están cifrados y <b>tu profe puede leer todo lo que escribes</b>, también en los chats privados. ¡Sé amable! 💛</p>
    </div>
  );

  if (!home) return <div>{banner}<p class="py-10 text-center font-bold text-slate-500">{loadError || 'Cargando el chat… 💬'}</p></div>;

  if (home.mode === 'off') {
    return (
      <div>
        {banner}
        <div class="ck-card mt-4 text-center"><p class="text-5xl">💤</p><p class="mt-2 font-bold text-slate-600">El chat de tu clase está apagado. Tu profe lo puede encender cuando quiera.</p></div>
      </div>
    );
  }

  const mate = typeof to === 'number' ? home.classmates.find((c) => c.id === to) : null;
  const badge = (n: number) => n > 0 && <span class="ml-auto rounded-full bg-rose-500 px-2 text-sm font-extrabold text-white">{n > 99 ? '99+' : n}<span class="sr-only"> sin leer</span></span>;

  const contacts = (
    <nav aria-label="Conversaciones" class="space-y-2">
      <button type="button" onClick={() => select('clase')} aria-current={to === 'clase' ? 'true' : undefined}
        class={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left font-bold transition ${to === 'clase' ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-200'}`}>
        <span class="text-3xl" aria-hidden="true">{home.classEmoji}</span>
        <span class="min-w-0"><span class="block truncate">Chat de la clase</span><span class={`block text-xs ${to === 'clase' ? 'text-brand-100' : 'text-slate-500'}`}>👥 Todos y tu profe</span></span>
        {badge(home.unread.group)}
      </button>
      {home.mode === 'on' && home.classmates.length > 0 && <p class="px-1 pt-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Privado con…</p>}
      {home.mode === 'on' && home.classmates.map((c) => (
        <button key={c.id} type="button" onClick={() => select(c.id)} aria-current={to === c.id ? 'true' : undefined}
          class={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-1.5 text-left font-bold transition ${to === c.id ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-200'}`}>
          <span class="text-2xl" aria-hidden="true">{c.avatar}</span>
          <span class="truncate">{c.name}</span>
          {badge(home.unread.dm[c.id] ?? 0)}
        </button>
      ))}
      {home.mode === 'group' && <p class="px-1 pt-2 text-xs font-bold text-slate-500">Tu profe ha dejado solo el chat de la clase.</p>}
    </nav>
  );

  return (
    <div>
      {/* Inside a conversation the composer repeats the notice: on phones, save the space. */}
      <div class={to !== null ? 'hidden md:block' : ''}>{banner}</div>
      <div class="mt-4 grid gap-4 md:grid-cols-[260px_1fr]">
        <div class={to !== null ? 'hidden md:block' : ''}>{contacts}</div>
        {to !== null && (
          <section class="ck-card flex h-[calc(100dvh-15rem)] min-h-[420px] flex-col !p-3 md:h-[calc(100dvh-13rem)]" aria-label="Conversación">
            <header class="flex items-center gap-2 border-b border-slate-100 pb-2">
              <button type="button" class="min-h-11 min-w-11 rounded-xl text-xl md:hidden" onClick={() => { setTo(null); toRef.current = null; loadHome(); }} aria-label="Volver">←</button>
              <span class="text-3xl" aria-hidden="true">{to === 'clase' ? home.classEmoji : mate?.avatar}</span>
              <div class="min-w-0">
                <h2 class="truncate font-display text-xl font-extrabold">{to === 'clase' ? home.className || 'Chat de la clase' : mate?.name}</h2>
                <p class="text-xs font-bold text-slate-500">{to === 'clase' ? 'Chat de la clase' : 'Chat privado · tu profe también lo puede ver 👀'}</p>
              </div>
            </header>
            <ChatView
              messages={messages} canWrite send={send} onReport={report}
              puzzlesUrl="/api/chat?view=puzzles" showNames={to === 'clase'}
              emptyText={to === 'clase' ? '¡Sé el primero en saludar! 👋' : `¡Saluda a ${mate?.name ?? 'tu compañero'}! 👋`}
              placeholder={to === 'clase' ? 'Escribe a toda la clase…' : `Escribe a ${mate?.name ?? ''}…`}
              note={<p class="mb-2 text-center text-xs font-bold text-slate-600">🔓 No es secreto: tu profe puede leerlo · Solo texto y ajedrez</p>}
            />
          </section>
        )}
      </div>

      <Modal open={rules} onClose={closeRules}>
        <div class="text-center">
          <p class="text-6xl" aria-hidden="true">💬</p>
          <h2 class="mt-2 font-display text-2xl font-extrabold">Antes de chatear…</h2>
        </div>
        <ul class="mt-4 space-y-3 font-bold text-slate-700">
          <li class="flex gap-3"><span class="text-2xl" aria-hidden="true">🔓</span><span>Los mensajes <b>no están cifrados</b>. <b>Tu profe puede leer todo</b>, también los chats privados.</span></li>
          <li class="flex gap-3"><span class="text-2xl" aria-hidden="true">💛</span><span>Sé amable. Aquí no se insulta ni se deja a nadie de lado.</span></li>
          <li class="flex gap-3"><span class="text-2xl" aria-hidden="true">🏠</span><span>No compartas tu dirección, tu teléfono ni tus contraseñas.</span></li>
          <li class="flex gap-3"><span class="text-2xl" aria-hidden="true">🚩</span><span>Si alguien te molesta, pulsa la bandera y avisa a tu profe.</span></li>
          <li class="flex gap-3"><span class="text-2xl" aria-hidden="true">♟️</span><span>¡Comparte problemas y partidas con el botón verde!</span></li>
        </ul>
        <button type="button" class="ck-btn ck-btn-primary mt-6 w-full" onClick={closeRules}>¡Entendido! 👍</button>
      </Modal>
    </div>
  );
}
