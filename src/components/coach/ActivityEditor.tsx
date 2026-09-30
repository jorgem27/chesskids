import { useState } from 'preact/hooks';
import { getGame } from '../../games/registry';
import GamePlayer from '../game/GamePlayer';

interface Props {
  id?: number;
  clubId: number;
  type: string;
  visibility?: 'public' | 'private';
  /** Club admin: may create/edit public activities. */
  isAdmin?: boolean;
  /** Editing a public activity without being admin: saving creates a private copy. */
  willFork?: boolean;
  initial: { title: string; description: string; xpReward: number; content: any };
}

export default function ActivityEditor({ id, clubId, type, visibility = 'private', isAdmin = false, willFork = false, initial }: Props) {
  const game = getGame(type);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [xp, setXp] = useState(initial.xpReward);
  const [content, setContent] = useState(initial.content);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState(false);
  const [vis, setVis] = useState<'public' | 'private'>(visibility);
  const errors = game.validate(content);
  const Editor = game.Editor;

  async function save() {
    setSaving(true); setMsg(null);
    const res = await fetch(id ? `/api/coach/activities/${id}` : '/api/coach/activities', {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clubId, type, title, description, xpReward: xp, content, visibility: vis }),
    });
    const body = await (res.json() as Promise<any>).catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMsg({ ok: false, text: body.error ?? 'Error' });
    if (!id) { location.href = `/profe/actividades/${body.id}?guardada=1`; return; }
    if (body.forked) { location.href = `/profe/actividades/${body.id}?copia=1`; return; }
    setMsg({ ok: true, text: '✅ Guardada' });
  }

  async function remove() {
    if (!id || !confirm('¿Borrar esta actividad? También desaparecerá de los deberes donde esté asignada.')) return;
    await fetch(`/api/coach/activities/${id}`, { method: 'DELETE' });
    location.href = '/profe/actividades';
  }

  if (preview) {
    return (
      <div class="fixed inset-0 z-50 overflow-auto">
        <GamePlayer preview activity={{ id: id ?? 0, type, title: title || game.name, content }} ageGroup="explorador" exitUrl="#" />
        <button onClick={() => setPreview(false)} class="fixed right-4 top-4 z-[60] rounded-full bg-slate-900 px-4 py-2 font-bold text-white shadow-lg">✕ Cerrar vista previa</button>
      </div>
    );
  }

  return (
    <div class="space-y-5">
      <div class="flex flex-wrap items-center gap-3">
        <a href="/profe/actividades" class="ck-btn-sm">←</a>
        <span class={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${game.gradient} text-2xl`}>{game.emoji}</span>
        <h1 class="flex-1 font-display text-2xl font-extrabold">{id ? 'Editar' : 'Nueva'}: {game.name} <span class={`ml-2 align-middle rounded-full px-3 py-1 text-xs font-bold ${vis === 'public' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>{vis === 'public' ? '🌍 Pública' : '🔒 Privada'}</span></h1>
        <button class="ck-btn-sm" disabled={errors.length > 0} onClick={() => setPreview(true)}>▶ Probar</button>
        {id && !willFork && <button class="ck-btn-sm text-rose-600" onClick={remove}>🗑 Borrar</button>}
        <button class="ck-btn ck-btn-primary" disabled={saving || errors.length > 0 || !title.trim()} onClick={save}>{saving ? 'Guardando…' : willFork ? '💾 Guardar mi copia' : '💾 Guardar'}</button>
      </div>
      {msg && <p class={`rounded-xl p-3 font-bold ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.text}</p>}
      {willFork && <p class="rounded-xl bg-sky-50 p-3 font-bold text-sky-800">🌍 Esta actividad es pública. Cámbiale lo que quieras: al guardar se crea <u>tu copia privada</u> y la original no se toca.</p>}
      {typeof location !== 'undefined' && location.search.includes('copia=1') && !msg && <p class="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-700">✅ Tu copia privada está lista. Solo tú la ves y la puedes asignar como deberes.</p>}
      {typeof location !== 'undefined' && location.search.includes('guardada=1') && !msg && <p class="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-700">✅ Actividad creada. Ya puedes asignarla como deberes desde tu clase.</p>}

      {isAdmin && !id && (
        <div class="ck-card flex flex-wrap items-center gap-3">
          <span class="font-bold">¿Quién la ve?</span>
          <button type="button" onClick={() => setVis('private')} class={`rounded-full px-4 py-2 font-bold ${vis === 'private' ? 'bg-violet-600 text-white' : 'bg-white ring-1 ring-slate-200'}`}>🔒 Privada (solo yo)</button>
          <button type="button" onClick={() => setVis('public')} class={`rounded-full px-4 py-2 font-bold ${vis === 'public' ? 'bg-sky-600 text-white' : 'bg-white ring-1 ring-slate-200'}`}>🌍 Pública (todo el club)</button>
        </div>
      )}

      <div class="ck-card grid gap-3 md:grid-cols-[2fr_3fr_1fr]">
        <label class="font-bold">Título
          <input class="ck-input mt-1 w-full" value={title} placeholder="Ej: Mates en 1 con la torre" onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
        </label>
        <label class="font-bold">Descripción (opcional)
          <input class="ck-input mt-1 w-full" value={description} onInput={(e) => setDescription((e.target as HTMLInputElement).value)} />
        </label>
        <label class="font-bold">XP
          <input type="number" min={5} max={200} class="ck-input mt-1 w-full" value={xp} onInput={(e) => setXp(Number((e.target as HTMLInputElement).value))} />
        </label>
      </div>

      <div class="ck-card">
        <Editor value={content} onChange={setContent} clubId={clubId} suggestTitle={(t) => setTitle((cur) => cur.trim() ? cur : t)} />
      </div>
      {errors.length > 0 && <p class="text-sm font-bold text-amber-700">Para guardar: {errors.join(' · ')}</p>}
    </div>
  );
}
