import { useMemo, useState } from 'preact/hooks';
import { GAME_META } from '../../games/meta';
import { CAMPAIGN_EMOJIS, CAMPAIGN_REWARDS, CAMPAIGN_THEMES, MAX_CAMPAIGN_NODES, mapLayout, mapPath, themeById } from '../../lib/campaigns';

export interface EditorNode { id?: number; activityId: number; title: string; type: string }
export interface EditorLib { id: number; title: string; type: string; visibility: string }
export interface EditorClass { id: number; name: string; emoji: string; assigned: boolean; canAssign: boolean }
export interface EditorProgress { classId: number; className: string; students: { name: string; avatar: string; done: number }[] }

interface Props {
  clubId: number;
  campaign: { id: number; title: string; description: string; reward_type: string; theme: string; emoji: string } | null;
  canEdit: boolean;
  nodes: EditorNode[];
  library: EditorLib[];
  classes: EditorClass[];
  progress: EditorProgress[];
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await (res.json() as Promise<any>).catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Algo ha fallado');
  return data;
}

/** Create / edit a campaign: details, ordered levels with a live map preview, classes and progress. */
export default function CampaignEditor({ clubId, campaign, canEdit, nodes: initialNodes, library, classes: initialClasses, progress }: Props) {
  const [title, setTitle] = useState(campaign?.title ?? '');
  const [description, setDescription] = useState(campaign?.description ?? '');
  const [reward, setReward] = useState(campaign?.reward_type ?? CAMPAIGN_REWARDS[0].id);
  const [theme, setTheme] = useState(campaign?.theme ?? CAMPAIGN_THEMES[0].id);
  const [emoji, setEmoji] = useState(campaign?.emoji ?? CAMPAIGN_EMOJIS[0]);
  const [nodes, setNodes] = useState<EditorNode[]>(initialNodes);
  const [classes, setClasses] = useState(initialClasses);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dirty, setDirty] = useState(!campaign);

  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); };
  const th = themeById(theme);
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library.filter((a) => !q || a.title.toLowerCase().includes(q) || (GAME_META[a.type]?.name ?? '').toLowerCase().includes(q)).slice(0, 40);
  }, [query, library]);

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= nodes.length) return;
    const next = [...nodes];
    [next[i], next[j]] = [next[j], next[i]];
    touch(setNodes)(next);
  }
  function remove(i: number) {
    const n = nodes[i];
    if (n.id && !confirm(`¿Quitar «${n.title}» del mapa? Los alumnos que ya lo superaron perderán ese nivel.`)) return;
    touch(setNodes)(nodes.filter((_, k) => k !== i));
  }
  function add(a: EditorLib) {
    if (nodes.length >= MAX_CAMPAIGN_NODES) { setErr(`Como mucho ${MAX_CAMPAIGN_NODES} niveles por campaña`); return; }
    touch(setNodes)([...nodes, { activityId: a.id, title: a.title, type: a.type }]);
  }

  async function save() {
    setBusy(true); setErr('');
    const body = { title, description, reward_type: reward, theme, emoji, nodes: nodes.map((n) => ({ id: n.id, activityId: n.activityId })) };
    try {
      if (!campaign) {
        const { id } = await send('/api/coach/campaigns', 'POST', { clubId, ...body });
        await send(`/api/coach/campaigns/${id}`, 'PUT', body);
        location.href = `/profe/campanas/${id}`;
        return;
      }
      await send(`/api/coach/campaigns/${campaign.id}`, 'PUT', body);
      location.reload(); // fresh node ids
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  async function toggleClass(c: EditorClass) {
    if (!campaign) return;
    if (c.assigned && !confirm(`¿Quitar la campaña de ${c.name}? Su progreso se guarda por si la vuelves a poner.`)) return;
    try {
      await send(`/api/coach/campaigns/${campaign.id}`, 'POST', { classId: c.id, assign: !c.assigned });
      setClasses(classes.map((x) => (x.id === c.id ? { ...x, assigned: !x.assigned } : x)));
    } catch (e) { setErr((e as Error).message); }
  }

  async function destroy() {
    if (!campaign || !confirm('¿Borrar esta campaña? Se pierde el progreso de los alumnos en ella. No se puede deshacer.')) return;
    try { await send(`/api/coach/campaigns/${campaign.id}`, 'DELETE'); location.href = '/profe/campanas'; }
    catch (e) { setErr((e as Error).message); }
  }

  const pts = mapLayout(nodes.length, 14, 88);
  const ro = !canEdit;

  return (
    <div class="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div class="space-y-6">
        {/* Details */}
        <section class="ck-card space-y-4">
          <h2 class="font-display text-xl font-extrabold">✏️ Datos de la campaña</h2>
          {ro && <p class="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Solo quien creó la campaña (o el admin del club) puede cambiarla. Tú puedes ponerla en tus clases.</p>}
          <div class="flex flex-wrap gap-3">
            <label class="block min-w-60 flex-1 text-sm font-bold">Título
              <input class="ck-input mt-1 w-full" maxLength={60} value={title} disabled={ro} placeholder="Ej: La aventura del caballo" onInput={(e) => touch(setTitle)((e.target as HTMLInputElement).value)} />
            </label>
            <label class="block min-w-60 flex-1 text-sm font-bold">Descripción (opcional)
              <input class="ck-input mt-1 w-full" maxLength={160} value={description} disabled={ro} placeholder="Ej: Aprende a mover el caballo paso a paso" onInput={(e) => touch(setDescription)((e.target as HTMLInputElement).value)} />
            </label>
          </div>
          <div>
            <p class="text-sm font-bold">Icono</p>
            <div class="mt-1 flex flex-wrap gap-1">
              {CAMPAIGN_EMOJIS.map((e) => (
                <button type="button" key={e} disabled={ro} onClick={() => touch(setEmoji)(e)} aria-pressed={emoji === e}
                  class={`h-11 w-11 rounded-xl text-2xl ${emoji === e ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-slate-50 hover:bg-slate-100'}`}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <p class="text-sm font-bold">Paisaje del mapa</p>
            <div class="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {CAMPAIGN_THEMES.map((t) => (
                <button type="button" key={t.id} disabled={ro} onClick={() => touch(setTheme)(t.id)} aria-pressed={theme === t.id}
                  class={`flex min-h-16 flex-col items-center justify-center rounded-2xl text-xs font-extrabold ${theme === t.id ? 'ring-4 ring-brand-500' : 'ring-1 ring-slate-200'} ${t.id === 'espacio' || t.id === 'volcan' ? 'text-white' : 'text-slate-800'}`}
                  style={{ background: t.bg }}>
                  <span class="text-2xl">{t.emoji}</span>{t.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p class="text-sm font-bold">Premio final</p>
            <div class="mt-1 grid gap-2 sm:grid-cols-2">
              {CAMPAIGN_REWARDS.map((r) => (
                <button type="button" key={r.id} disabled={ro} onClick={() => touch(setReward)(r.id)} aria-pressed={reward === r.id}
                  class={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left ${reward === r.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <span class="text-3xl">{r.emoji}</span>
                  <span><b class="block text-sm">{r.name}</b><span class="text-xs text-slate-500">{r.description}</span></span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Levels */}
        <section class="ck-card">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="font-display text-xl font-extrabold">🧗 Niveles ({nodes.length})</h2>
            <p class="text-xs text-slate-500">Se juegan en orden: cada nivel se abre al conseguir al menos 1 ⭐ en el anterior.</p>
          </div>
          {nodes.length === 0 && <p class="mt-3 rounded-2xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">Añade actividades de la biblioteca de abajo 👇</p>}
          <ol class="mt-3 space-y-2">
            {nodes.map((n, i) => (
              <li key={`${n.id ?? 'new'}-${n.activityId}-${i}`} class="flex items-center gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-black text-white">{i + 1}</span>
                <span class="text-2xl">{GAME_META[n.type]?.emoji ?? '🎮'}</span>
                <span class="min-w-0 flex-1"><b class="block truncate">{n.title}</b><span class="text-xs text-slate-500">{GAME_META[n.type]?.name}{!n.id && ' · nuevo'}</span></span>
                {!ro && (
                  <span class="flex shrink-0 gap-1">
                    <button type="button" class="ck-btn-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
                    <button type="button" class="ck-btn-sm" disabled={i === nodes.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">↓</button>
                    <button type="button" class="ck-btn-sm text-rose-600" onClick={() => remove(i)} aria-label="Quitar">✖</button>
                  </span>
                )}
              </li>
            ))}
          </ol>

          {!ro && (
            <div class="mt-5 border-t border-slate-100 pt-4">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-bold">➕ Añadir desde la biblioteca</h3>
                <input class="ck-input ml-auto w-full sm:w-64" placeholder="🔍 Buscar actividad…" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
              </div>
              <div class="mt-3 grid max-h-72 gap-2 overflow-auto sm:grid-cols-2">
                {found.map((a) => {
                  const used = nodes.filter((n) => n.activityId === a.id).length;
                  return (
                    <button type="button" key={a.id} onClick={() => add(a)} class="flex items-center gap-2 rounded-2xl border-2 border-slate-200 p-2 text-left hover:border-brand-400 hover:bg-brand-50">
                      <span class="text-2xl">{GAME_META[a.type]?.emoji}</span>
                      <span class="min-w-0 flex-1"><b class="block truncate text-sm">{a.visibility === 'private' ? '🔒 ' : ''}{a.title}</b><span class="text-xs text-slate-500">{GAME_META[a.type]?.name}{used ? ` · ya en el mapa${used > 1 ? ` ×${used}` : ''}` : ''}</span></span>
                      <span class="font-black text-brand-600">＋</span>
                    </button>
                  );
                })}
                {!found.length && <p class="text-sm text-slate-500">No hay actividades con ese nombre. Créalas en <a class="font-bold text-brand-600" href="/profe/actividades">Actividades</a>.</p>}
              </div>
            </div>
          )}
        </section>

        {err && <p class="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{err}</p>}
        {!ro && (
          <div class="flex flex-wrap items-center gap-3">
            <button type="button" class="ck-btn ck-btn-primary" disabled={busy || !dirty || !title.trim()} onClick={save}>{busy ? 'Guardando…' : campaign ? '💾 Guardar cambios' : '✨ Crear campaña'}</button>
            {dirty && campaign && <span class="text-sm font-bold text-amber-600">Hay cambios sin guardar</span>}
            {campaign && <button type="button" class="ml-auto text-sm font-bold text-rose-600" onClick={destroy}>🗑️ Borrar campaña</button>}
          </div>
        )}

        {campaign && (
          <section class="ck-card">
            <h2 class="font-display text-xl font-extrabold">🏫 Clases</h2>
            <p class="text-sm text-slate-500">Los alumnos verán el mapa en su inicio.</p>
            <ul class="mt-3 space-y-2">
              {classes.map((c) => (
                <li key={c.id} class={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${c.assigned ? 'bg-brand-50 ring-brand-200' : 'bg-white ring-slate-200'}`}>
                  <span class="text-2xl">{c.emoji}</span>
                  <b class="flex-1">{c.name}</b>
                  {c.canAssign ? (
                    <button type="button" class={`ck-btn-sm ${c.assigned ? '' : '!bg-brand-600 !text-white'}`} onClick={() => toggleClass(c)}>{c.assigned ? '✓ Puesta · Quitar' : 'Poner en esta clase'}</button>
                  ) : <span class="text-xs text-slate-500">{c.assigned ? '✓ Puesta' : 'Sin permiso'}</span>}
                </li>
              ))}
              {!classes.length && <li class="text-sm text-slate-500">No tienes clases en este club.</li>}
            </ul>
          </section>
        )}

        {progress.length > 0 && (
          <section class="ck-card">
            <h2 class="font-display text-xl font-extrabold">📈 Progreso</h2>
            {progress.map((p) => (
              <div key={p.classId} class="mt-3">
                <h3 class="font-bold">{p.className}</h3>
                <ul class="mt-2 grid gap-2 sm:grid-cols-2">
                  {p.students.map((s) => (
                    <li key={s.name} class="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <span class="text-xl">{s.avatar}</span>
                      <span class="min-w-0 flex-1 truncate font-bold">{s.name}</span>
                      <span class="h-2 w-20 overflow-hidden rounded-full bg-slate-200"><span class="block h-full rounded-full bg-amber-400" style={{ width: `${initialNodes.length ? (s.done / initialNodes.length) * 100 : 0}%` }} /></span>
                      <span class="w-12 text-right text-xs font-bold tabular-nums">{s.done}/{initialNodes.length}{initialNodes.length > 0 && s.done >= initialNodes.length ? ' 🏆' : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
      </div>

      {/* Live preview */}
      <aside class="lg:sticky lg:top-20 lg:self-start">
        <p class="mb-2 text-sm font-bold text-slate-500">👀 Así lo verán los alumnos</p>
        <div class="relative overflow-hidden rounded-[2rem] ring-4 ring-white shadow" style={{ background: th.bg, height: `${Math.max(380, nodes.length * 70 + 140)}px` }}>
          <span class="absolute left-1/2 top-2 -translate-x-1/2 text-4xl">{th.goal}</span>
          <svg class="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={mapPath(pts)} stroke={th.path} stroke-width="9" stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke" />
          </svg>
          {nodes.map((n, i) => (
            <span key={i} class="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-gradient-to-b from-brand-500 to-gold-500 text-xl shadow" style={{ left: `${pts[i].x}%`, top: `${pts[i].y}%` }} title={n.title}>
              {GAME_META[n.type]?.emoji ?? '🎮'}
            </span>
          ))}
          {!nodes.length && <p class="absolute inset-x-4 top-1/2 text-center font-bold text-slate-600">Tu mapa aparecerá aquí</p>}
        </div>
        <p class="mt-2 text-center text-sm font-bold text-slate-600">{emoji} {title || 'Sin título'} · 🎁 {CAMPAIGN_REWARDS.find((r) => r.id === reward)?.name}</p>
      </aside>
    </div>
  );
}
