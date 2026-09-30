import { useState } from 'preact/hooks';
import { GAME_META } from '../../games/meta';
import { dueLabel, shortDate } from '../../lib/dates';
import { copy, whatsappUrl } from '../ui/QR';

export interface LibItem { id: number; type: string; title: string; count: number; visibility?: string }
export interface AsgItem { id: number; activity_id: number; type: string; title: string; starts_on: string; due_on: string | null; note: string; done_count: number; avg_stars: number | null }
interface Props {
  classId: number; className: string; classCode: string; origin: string; canCreate: boolean;
  library: LibItem[]; assignments: AsgItem[]; studentCount: number; today: string; nextWeek: string;
}

export default function AssignPanel({ classId, className, classCode, origin, canCreate, library, assignments, studentCount, today, nextWeek }: Props) {
  const [sel, setSel] = useState<number[]>([]);
  const [starts, setStarts] = useState(today);
  const [due, setDue] = useState(nextWeek);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const current = assignments.filter((a) => !a.due_on || a.due_on >= today);
  const past = assignments.filter((a) => a.due_on && a.due_on < today);

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true); setErr('');
    const res = await fetch('/api/coach/assignments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ classId, activityIds: sel, startsOn: starts, dueOn: due, note }) });
    if (res.ok) location.reload();
    else { setErr((await (res.json() as Promise<any>).catch(() => ({}))).error ?? 'Error'); setBusy(false); }
  }

  async function remove(id: number) {
    if (!confirm('¿Quitar esta misión? Los resultados ya conseguidos se conservan.')) return;
    await fetch(`/api/coach/assignments/${id}`, { method: 'DELETE' });
    location.reload();
  }

  const message = [
    `♟️ Deberes de ajedrez · ${className}`,
    ...current.map((a) => `${GAME_META[a.type]?.emoji ?? '•'} ${a.title}${a.due_on ? ` (para el ${shortDate(a.due_on)})` : ''}`),
    '',
    `Entrad aquí: ${origin}/c/${classCode}`,
    '¡A por las 3 estrellas! ⭐⭐⭐',
  ].join('\n');

  const Row = ({ a }: { a: AsgItem }) => {
    const meta = GAME_META[a.type];
    const d = dueLabel(a.due_on, today);
    const pct = studentCount ? a.done_count / studentCount : 0;
    return (
      <li class="flex flex-wrap items-center gap-3 px-4 py-3">
        <span class={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${meta?.gradient} text-2xl`}>{meta?.emoji}</span>
        <div class="min-w-0 flex-1">
          <p class="font-bold">{a.title}</p>
          <p class="text-xs text-slate-500">{meta?.name} · desde {shortDate(a.starts_on)} · {d.text}{a.note && ` · 💬 ${a.note}`}</p>
        </div>
        <div class="w-40">
          <div class="h-2.5 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-emerald-500" style={{ width: `${pct * 100}%` }} /></div>
          <p class="mt-1 text-xs font-bold text-slate-500">{a.done_count}/{studentCount} hechos{a.avg_stars != null && ` · ${a.avg_stars.toFixed(1)}⭐`}</p>
        </div>
        <a class="ck-btn-sm" href={`/profe/actividades/${a.activity_id}/probar`}>▶</a>
        {canCreate && <button class="ck-btn-sm text-rose-600" onClick={() => remove(a.id)}>🗑</button>}
      </li>
    );
  };

  return (
    <div class="space-y-6">
      <div class="ck-card !p-0 overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
          <h2 class="font-display text-xl font-extrabold">🎒 Misiones activas ({current.length})</h2>
          {current.length > 0 && (
            <div class="flex gap-2">
              <a class="ck-btn-sm !bg-emerald-500 !text-white" target="_blank" href={whatsappUrl(message)}>💬 Avisar a las familias</a>
              <button class="ck-btn-sm" onClick={async () => { if (await copy(message)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}>{copied ? '✅' : '📋'} Copiar mensaje</button>
            </div>
          )}
        </div>
        <ul class="divide-y divide-slate-100">
          {current.map((a) => <Row key={a.id} a={a} />)}
          {!current.length && <li class="p-6 text-center text-slate-500">No hay misiones activas.</li>}
        </ul>
      </div>

      {canCreate && (
        <form onSubmit={submit} class="ck-card space-y-4">
          <h2 class="font-display text-xl font-extrabold">➕ Poner deberes / misiones</h2>
          {!library.length && <p class="text-slate-500">Primero crea actividades en <a href="/profe/actividades" class="font-bold text-violet-600">Actividades</a>.</p>}
          <div class="grid max-h-80 gap-2 overflow-auto sm:grid-cols-2">
            {library.map((l) => {
              const on = sel.includes(l.id);
              const meta = GAME_META[l.type];
              return (
                <label key={l.id} class={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 ${on ? 'border-violet-500 bg-violet-50' : 'border-slate-200'}`}>
                  <input type="checkbox" checked={on} onChange={() => setSel(on ? sel.filter((x) => x !== l.id) : [...sel, l.id])} />
                  <span class="text-2xl">{meta?.emoji}</span>
                  <span class="min-w-0 flex-1"><b class="block truncate">{l.visibility === 'private' ? '🔒 ' : ''}{l.title}</b><span class="text-xs text-slate-500">{meta?.name} · {l.count} {meta?.countLabel}</span></span>
                </label>
              );
            })}
          </div>
          <div class="flex flex-wrap gap-3">
            <label class="text-sm font-bold">Desde <input type="date" class="ck-input ml-1" value={starts} onInput={(e) => setStarts((e.target as HTMLInputElement).value)} /></label>
            <label class="text-sm font-bold">Hasta <input type="date" class="ck-input ml-1" value={due} onInput={(e) => setDue((e.target as HTMLInputElement).value)} /></label>
            <input class="ck-input min-w-60 flex-1" placeholder="Mensaje para los alumnos (opcional)" value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} />
          </div>
          {err && <p class="font-bold text-rose-600">{err}</p>}
          <button disabled={!sel.length || busy} class="ck-btn ck-btn-primary">Asignar {sel.length || ''} {sel.length === 1 ? 'actividad' : 'actividades'}</button>
        </form>
      )}

      {past.length > 0 && (
        <details class="ck-card !p-0 overflow-hidden">
          <summary class="cursor-pointer p-4 font-display text-lg font-extrabold">📦 Misiones pasadas ({past.length})</summary>
          <ul class="divide-y divide-slate-100">{past.map((a) => <Row key={a.id} a={a} />)}</ul>
        </details>
      )}
    </div>
  );
}
