import { useState } from 'preact/hooks';
import { GAME_META } from '../../games/meta';
import { dueLabel, scheduleDates, shortDate, type ScheduleMode } from '../../lib/dates';
import { copy, whatsappUrl } from '../ui/QR';

export interface LibItem { id: number; type: string; title: string; count: number; visibility?: string }
export interface AsgItem { id: number; activity_id: number; type: string; title: string; starts_on: string; due_on: string | null; note: string; done_count: number; avg_stars: number | null }
interface Props {
  classId: number; className: string; classCode: string; origin: string; canCreate: boolean;
  library: LibItem[]; assignments: AsgItem[]; studentCount: number; today: string; nextWeek: string;
  /** Other classes of the same club where this coach can set homework. */
  otherClasses?: { id: number; name: string; emoji: string }[];
}

const SCHEDULES: { id: ScheduleMode; label: string }[] = [
  { id: 'all', label: 'Todas a la vez' },
  { id: 'daily', label: 'Una nueva cada día' },
  { id: 'every2', label: 'Una cada 2 días' },
  { id: 'weekly', label: 'Una por semana' },
];

export default function AssignPanel({ classId, className, classCode, origin, canCreate, library, assignments, studentCount, today, nextWeek, otherClasses = [] }: Props) {
  const [sel, setSel] = useState<number[]>([]);
  const [starts, setStarts] = useState(today);
  const [due, setDue] = useState(nextWeek);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [extra, setExtra] = useState<number[]>([]);
  const [schedule, setSchedule] = useState<ScheduleMode>('all');
  const [span, setSpan] = useState(7);
  const [query, setQuery] = useState('');
  const scheduled = assignments.filter((a) => a.starts_on > today);
  const current = assignments.filter((a) => a.starts_on <= today && (!a.due_on || a.due_on >= today));
  const past = assignments.filter((a) => a.due_on && a.due_on < today);

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true); setErr('');
    const res = await fetch('/api/coach/assignments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ classId, classIds: extra, activityIds: sel, startsOn: starts, dueOn: due, note, schedule, spanDays: span }) });
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
          <p class="text-xs text-slate-500">{meta?.name} · {a.starts_on > today ? `🕒 empieza el ${shortDate(a.starts_on)}` : `desde ${shortDate(a.starts_on)}`} · {d.text}{a.note && ` · 💬 ${a.note}`}</p>
        </div>
        <div class="w-40">
          <div class="h-2.5 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-emerald-500" style={{ width: `${pct * 100}%` }} /></div>
          <p class="mt-1 text-xs font-bold text-slate-500">{a.done_count}/{studentCount} hechos{a.avg_stars != null && ` · ${a.avg_stars.toFixed(1)}⭐`}</p>
        </div>
        <a class="ck-btn-sm" href={`/profe/clase/${classId}/actividad/${a.activity_id}`} title="Ver resultados problema a problema">🔬</a>
        <a class="ck-btn-sm" href={`/profe/actividades/${a.activity_id}/probar`} title="Probar">▶</a>
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
          {!library.length && <p class="text-slate-500">Primero crea actividades en <a href="/profe/actividades" class="font-bold text-brand-600">Actividades</a>.</p>}
          {library.length > 8 && <input class="ck-input w-full" placeholder="🔍 Buscar actividad…" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />}
          <div class="grid max-h-80 gap-2 overflow-auto sm:grid-cols-2">
            {library.filter((l) => !query.trim() || l.title.toLowerCase().includes(query.trim().toLowerCase()) || sel.includes(l.id)).map((l) => {
              const on = sel.includes(l.id);
              const order = sel.indexOf(l.id);
              const meta = GAME_META[l.type];
              return (
                <label key={l.id} class={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 ${on ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                  <input type="checkbox" checked={on} onChange={() => setSel(on ? sel.filter((x) => x !== l.id) : [...sel, l.id])} />
                  {on && schedule !== 'all' && <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-black text-white">{order + 1}</span>}
                  <span class="text-2xl">{meta?.emoji}</span>
                  <span class="min-w-0 flex-1"><b class="block truncate">{l.visibility === 'private' ? '🔒 ' : ''}{l.title}</b><span class="text-xs text-slate-500">{meta?.name} · {l.count} {meta?.countLabel}</span></span>
                </label>
              );
            })}
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <label class="text-sm font-bold">📅 <select class="ck-input ml-1" value={schedule} onChange={(e) => setSchedule((e.target as HTMLSelectElement).value as ScheduleMode)}>
              {SCHEDULES.map((x) => <option value={x.id}>{x.label}</option>)}
            </select></label>
            <label class="text-sm font-bold">{schedule === 'all' ? 'Desde' : 'Empieza'} <input type="date" class="ck-input ml-1" value={starts} onInput={(e) => setStarts((e.target as HTMLInputElement).value)} /></label>
            {schedule === 'all'
              ? <label class="text-sm font-bold">Hasta <input type="date" class="ck-input ml-1" value={due} onInput={(e) => setDue((e.target as HTMLInputElement).value)} /></label>
              : <label class="text-sm font-bold">Cada misión dura <input type="number" min={1} max={60} class="ck-input ml-1 w-20" value={span} onInput={(e) => setSpan(Number((e.target as HTMLInputElement).value) || 7)} /> días</label>}
          </div>
          {schedule !== 'all' && sel.length > 0 && (
            <ol class="flex flex-wrap gap-2 text-xs">
              {scheduleDates(starts, due, sel.length, schedule, span).map((d, i) => {
                const l = library.find((x) => x.id === sel[i]);
                return <li class="rounded-full bg-brand-50 px-2 py-1 text-brand-800"><b>{i + 1}.</b> {l?.title} · {shortDate(d.startsOn)}–{d.dueOn && shortDate(d.dueOn)}</li>;
              })}
            </ol>
          )}
          <input class="ck-input w-full" placeholder="Mensaje para los alumnos (opcional)" value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} />
          {otherClasses.length > 0 && (
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="font-bold">También en:</span>
              {otherClasses.map((c) => {
                const on = extra.includes(c.id);
                return (
                  <label key={c.id} class={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-3 ${on ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                    <input type="checkbox" checked={on} onChange={() => setExtra(on ? extra.filter((x) => x !== c.id) : [...extra, c.id])} />{c.emoji} {c.name}
                  </label>
                );
              })}
            </div>
          )}
          {err && <p class="font-bold text-rose-600">{err}</p>}
          <button disabled={!sel.length || busy} class="ck-btn ck-btn-primary">Asignar {sel.length || ''} {sel.length === 1 ? 'actividad' : 'actividades'}{extra.length ? ` en ${extra.length + 1} clases` : ''}</button>
        </form>
      )}

      {scheduled.length > 0 && (
        <div class="ck-card !p-0 overflow-hidden">
          <h2 class="border-b border-slate-100 p-4 font-display text-lg font-extrabold">🕒 Programadas ({scheduled.length})</h2>
          <ul class="divide-y divide-slate-100">{scheduled.map((a) => <Row key={a.id} a={a} />)}</ul>
        </div>
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
