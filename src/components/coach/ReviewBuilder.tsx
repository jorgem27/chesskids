import { useState } from 'preact/hooks';

interface Props {
  classId: number;
  /** Review only this activity's mistakes; otherwise the class's mistakes of the last days. */
  activityId?: number | null;
  canCreate: boolean;
  /** Number of failed puzzle items available (0 hides the builder). */
  failedItems: number;
}

/** "Crear repaso con los fallos": turns the class's mistakes into a new activity in one click. */
export default function ReviewBuilder({ classId, activityId = null, canCreate, failedItems }: Props) {
  const [mode, setMode] = useState<'puzzle-hint' | 'puzzle-blitz'>('puzzle-hint');
  const [similar, setSimilar] = useState(true);
  const [assign, setAssign] = useState(true);
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<null | { id: number; count: number; similar: number; assigned: boolean }>(null);

  if (!canCreate || failedItems === 0) return null;

  async function create() {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/coach/review', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classId, activityId, days, mode, similar, assign }),
      });
      const data = await (res.json() as Promise<any>).catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Algo ha fallado');
      setDone(data);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  if (done) {
    return (
      <div class="ck-card border-2 border-emerald-300 bg-emerald-50">
        <p class="font-display text-lg font-extrabold text-emerald-800">✅ Repaso creado con {done.count} problemas{done.similar ? ` (${done.similar} parecidos de Lichess)` : ''}</p>
        <p class="text-sm text-emerald-800">{done.assigned ? 'Ya está en las misiones de la clase durante una semana.' : 'Está en tu biblioteca (privado). Asígnalo cuando quieras.'}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <a class="ck-btn-sm" href={`/profe/actividades/${done.id}/probar`}>▶ Probar</a>
          <a class="ck-btn-sm" href={`/profe/actividades/${done.id}`}>✏️ Editar</a>
        </div>
      </div>
    );
  }

  return (
    <div class="ck-card space-y-3">
      <div>
        <h3 class="font-display text-lg font-extrabold">🔁 Crear repaso con los fallos</h3>
        <p class="text-sm text-slate-500">Junta en una actividad nueva los problemas que más ha fallado la clase{activityId ? ' en esta actividad' : ''}.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode('puzzle-hint')} aria-pressed={mode === 'puzzle-hint'} class={`ck-btn-sm ${mode === 'puzzle-hint' ? '!bg-brand-600 !text-white' : ''}`}>🧩 Con pistas</button>
        <button type="button" onClick={() => setMode('puzzle-blitz')} aria-pressed={mode === 'puzzle-blitz'} class={`ck-btn-sm ${mode === 'puzzle-blitz' ? '!bg-brand-600 !text-white' : ''}`}>⚡ Relámpago</button>
        {!activityId && (
          <select class="ck-input !py-1 text-sm" value={days} onChange={(e) => setDays(Number((e.target as HTMLSelectElement).value))} aria-label="Periodo">
            <option value={7}>Última semana</option>
            <option value={14}>Últimas 2 semanas</option>
            <option value={30}>Último mes</option>
          </select>
        )}
      </div>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" checked={similar} onChange={() => setSimilar(!similar)} /> Añadir un problema parecido de Lichess tras cada fallo (si venía de Lichess)</label>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" checked={assign} onChange={() => setAssign(!assign)} /> Ponerlo ya como misión (1 semana)</label>
      {err && <p class="text-sm font-bold text-rose-600">{err}</p>}
      <button type="button" class="ck-btn ck-btn-primary" disabled={busy} onClick={create}>{busy ? 'Creando…' : '✨ Crear repaso'}</button>
    </div>
  );
}
