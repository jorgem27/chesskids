import { useState } from 'preact/hooks';
import { AGE_GROUPS, AVATARS, type AgeGroup } from '../../lib/catalog';
import { Modal } from '../ui/Modal';
import { copy, QR, whatsappUrl } from '../ui/QR';

export interface StudentInfo {
  id: number; name: string; avatar: string; username: string; token: string; age_group: AgeGroup;
  xp: number; level: number; streak: number; last: string;
}
interface Created { id: number; name: string; avatar: string; username: string; password: string; pin: string; token: string }
interface Props { classId: number; classCode: string; className: string; origin: string; canManage: boolean; canView?: boolean; students: StudentInfo[] }

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await (res.json() as Promise<any>).catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Error');
  return data;
}

export default function StudentManager({ classId, classCode, className, origin, canManage, canView = false, students: initial }: Props) {
  const [students, setStudents] = useState(initial);
  const [names, setNames] = useState('');
  const [age, setAge] = useState<AgeGroup>('explorador');
  const [created, setCreated] = useState<Created[] | null>(null);
  const [open, setOpen] = useState<StudentInfo | null>(null);
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');
  const [delPass, setDelPass] = useState('');
  const [delErr, setDelErr] = useState('');
  const [newName, setNewName] = useState('');
  const classLink = `${origin}/c/${classCode}`;
  const personal = (t: string) => `${origin}/u/${t}`;

  const flashCopy = async (text: string, id: string) => { if (await copy(text)) { setCopied(id); setTimeout(() => setCopied(''), 1500); } };

  async function add(e: Event) {
    e.preventDefault();
    setErr('');
    const list = names.split('\n').map((n) => n.trim()).filter(Boolean).map((name) => ({ name, ageGroup: age }));
    try {
      const r = await api('/api/coach/students', 'POST', { classId, students: list });
      setCreated(r.created);
      setStudents([...students, ...r.created.map((c: Created) => ({ id: c.id, name: c.name, avatar: c.avatar, username: c.username, token: c.token, age_group: age, xp: 0, level: 1, streak: 0, last: 'nunca' }))]);
      setNames('');
    } catch (ex) { setErr((ex as Error).message); }
  }

  async function action(s: StudentInfo, act: string, extra: Record<string, unknown> = {}) {
    setErr('');
    try {
      const r = await api(`/api/coach/students/${s.id}`, 'PATCH', { action: act, ...extra });
      if (act === 'reset-password') setSecret({ label: 'Nueva contraseña', value: r.password });
      if (act === 'reset-pin') setSecret({ label: 'Nuevos dibujos secretos', value: r.pin });
      if (act === 'new-link') {
        const upd = { ...s, token: r.token };
        setStudents(students.map((x) => (x.id === s.id ? upd : x)));
        setOpen(upd);
        setSecret({ label: 'Enlace nuevo creado. El anterior ya no funciona y se cerraron sus sesiones.', value: '' });
      }
      if (act === 'update') {
        const upd = { ...s, ...(extra.avatar ? { avatar: extra.avatar as string } : {}), ...(extra.ageGroup ? { age_group: extra.ageGroup as AgeGroup } : {}), ...(extra.name ? { name: extra.name as string } : {}) };
        setStudents(students.map((x) => (x.id === s.id ? upd : x)));
        setOpen(upd);
      }
    } catch (ex) { setErr((ex as Error).message); }
  }

  async function remove(s: StudentInfo, e: Event) {
    e.preventDefault();
    setErr('');
    setDelErr('');
    try {
      await api(`/api/coach/students/${s.id}`, 'DELETE', { password: delPass });
      setStudents(students.filter((x) => x.id !== s.id));
      setOpen(null);
      setDelPass('');
    } catch (ex) { setDelErr((ex as Error).message); }
  }

  const familyMsg = (s: { name: string; token: string }) =>
    `¡Hola! ♟️ Este es el acceso de ${s.name} a ChessKids Academy (${className}). Tócalo desde su móvil o tablet y entrará directamente; el dispositivo le recordará:\n${personal(s.token)}`;

  return (
    <div class="space-y-6">
      {/* Class access */}
      <div class="ck-card grid items-center gap-6 md:grid-cols-[auto_1fr]">
        <QR text={classLink} size={170} class="mx-auto rounded-xl" />
        <div class="space-y-3">
          <p class="text-sm font-bold uppercase tracking-wide text-slate-500">Acceso de la clase</p>
          <p class="font-mono text-5xl font-black tracking-[0.3em] text-violet-700">{classCode}</p>
          <p class="text-sm text-slate-600">Los alumnos entran en <b>{origin.replace(/^https?:\/\//, '')}/entrar</b> con este código, eligen su animal y tocan sus 3 dibujos secretos. También pueden escanear este QR.</p>
          <div class="flex flex-wrap gap-2">
            <a class="ck-btn-sm !bg-emerald-500 !text-white" target="_blank" href={whatsappUrl(`¡Hola familias! ♟️ Enlace de la clase ${className} en ChessKids Academy: ${classLink}\nCada peque elige su animal y toca sus 3 dibujos secretos.`)}>💬 Enviar por WhatsApp</a>
            <button class="ck-btn-sm" onClick={() => flashCopy(classLink, 'class')}>{copied === 'class' ? '✅ Copiado' : '🔗 Copiar enlace'}</button>
            <a class="ck-btn-sm" href={`/profe/clase/${classId}/tarjetas`}>🖨️ Tarjetas de acceso</a>
          </div>
        </div>
      </div>

      {err && <p class="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{err}</p>}

      {/* Students list */}
      <div class="ck-card !p-0 overflow-hidden">
        <div class="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 class="font-display text-xl font-extrabold">Alumnos ({students.length})</h2>
        </div>
        <ul class="divide-y divide-slate-100">
          {students.map((s) => (
            <li key={s.id} class="flex flex-wrap items-center gap-3 px-4 py-3">
              <span class="text-4xl">{s.avatar}</span>
              <div class="min-w-0 flex-1">
                <p class="font-bold">{s.name} <span class="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{AGE_GROUPS[s.age_group]?.emoji} {AGE_GROUPS[s.age_group]?.label}</span></p>
                <p class="text-xs text-slate-500">@{s.username} · Nivel {s.level} · {s.xp} XP · 🔥 {s.streak} · última vez {s.last}</p>
              </div>
              <div class="flex gap-2">
                {canView && <a class="ck-btn-sm" href={`/profe/clase/${classId}/alumno/${s.id}`} title="Ver su progreso">📊 Ficha</a>}
                {canManage && (
                  <>
                    <a class="ck-btn-sm !bg-emerald-50 !text-emerald-700" target="_blank" href={whatsappUrl(familyMsg(s))} title="Enviar acceso a la familia">💬</a>
                    <button class="ck-btn-sm" onClick={() => { setSecret(null); setDelPass(''); setDelErr(''); setNewName(s.name); setOpen(s); }}>🔑 Acceso</button>
                  </>
                )}
              </div>
            </li>
          ))}
          {!students.length && <li class="p-6 text-center text-slate-500">Todavía no hay alumnos.</li>}
        </ul>
      </div>

      {/* Add */}
      {canManage && (
        <form onSubmit={add} class="ck-card space-y-3">
          <h2 class="font-display text-xl font-extrabold">➕ Añadir alumnos</h2>
          <p class="text-sm text-slate-500">Un nombre por línea. Se crean su usuario, contraseña, dibujos secretos y enlace personal.</p>
          <textarea value={names} onInput={(e) => setNames((e.target as HTMLTextAreaElement).value)} class="ck-input h-32 w-full" placeholder={'Lucía\nMateo\nSofía'} />
          <div class="flex flex-wrap items-center gap-3">
            <label class="text-sm font-bold">Grupo de edad
              <select class="ck-input ml-2" value={age} onChange={(e) => setAge((e.target as HTMLSelectElement).value as AgeGroup)}>
                {Object.entries(AGE_GROUPS).map(([k, v]) => <option value={k}>{v.emoji} {v.label} ({v.range})</option>)}
              </select>
            </label>
            <button class="ck-btn ck-btn-primary">Crear alumnos</button>
          </div>
        </form>
      )}

      {/* Credentials after creation */}
      <Modal open={!!created} onClose={() => setCreated(null)} wide>
        <h2 class="font-display text-2xl font-extrabold">🎉 Alumnos creados</h2>
        <p class="mb-4 text-sm text-rose-600 font-bold">Guarda o imprime ahora estas contraseñas: por seguridad no se vuelven a mostrar (se pueden regenerar).</p>
        <div id="ck-print-cards" class="grid gap-3 sm:grid-cols-2">
          {created?.map((c) => (
            <div key={c.id} class="flex gap-3 rounded-2xl border-2 border-dashed border-violet-300 p-3">
              <QR text={personal(c.token)} size={96} />
              <div class="min-w-0 text-sm">
                <p class="font-display text-lg font-extrabold">{c.avatar} {c.name}</p>
                <p>Clase: <b class="font-mono">{classCode}</b> · Dibujos: <span class="text-lg">{c.pin}</span></p>
                <p>Usuario: <b class="font-mono">{c.username}</b></p>
                <p>Contraseña: <b class="font-mono">{c.password}</b></p>
                <a class="text-emerald-600 font-bold" target="_blank" href={whatsappUrl(familyMsg(c))}>💬 Enviar a la familia</a>
              </div>
            </div>
          ))}
        </div>
        <button class="ck-btn ck-btn-primary mt-4" onClick={() => window.print()}>🖨️ Imprimir</button>
      </Modal>

      {/* Per-student access */}
      <Modal open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <span class="text-6xl">{open.avatar}</span>
              <div><h2 class="font-display text-2xl font-extrabold">{open.name}</h2><p class="font-mono text-sm text-slate-500">@{open.username}</p></div>
            </div>
            <div class="flex flex-col items-center gap-2 rounded-2xl bg-violet-50 p-4">
              <QR text={personal(open.token)} size={180} />
              <p class="text-center text-xs text-slate-600">QR / enlace personal: entra directamente y el dispositivo le recuerda.</p>
              <div class="flex flex-wrap justify-center gap-2">
                <a class="ck-btn-sm !bg-emerald-500 !text-white" target="_blank" href={whatsappUrl(familyMsg(open))}>💬 WhatsApp</a>
                <button class="ck-btn-sm" onClick={() => flashCopy(personal(open.token), 'p')}>{copied === 'p' ? '✅ Copiado' : '🔗 Copiar enlace'}</button>
              </div>
            </div>
            {secret && (
              <div class="rounded-2xl bg-amber-50 p-3 text-center">
                <p class="text-sm font-bold text-amber-800">{secret.label}</p>
                {secret.value && <p class="font-mono text-2xl font-black">{secret.value}</p>}
              </div>
            )}
            <div class="grid grid-cols-2 gap-2">
              <button class="ck-btn-sm justify-center" onClick={() => action(open, 'reset-password')}>🔑 Nueva contraseña</button>
              <button class="ck-btn-sm justify-center" onClick={() => action(open, 'reset-pin')}>🍎 Nuevos dibujos</button>
              <button class="ck-btn-sm col-span-2 justify-center" onClick={() => confirm('Se invalidará el enlace/QR actual y se cerrará la sesión en todos sus dispositivos. ¿Seguro?') && action(open, 'new-link')}>♻️ Nuevo enlace (y cerrar sesiones)</button>
            </div>
            <details class="rounded-2xl bg-slate-50 p-3">
              <summary class="cursor-pointer font-bold">✏️ Editar</summary>
              <div class="mt-3 space-y-3">
                <div class="flex gap-2">
                  <input class="ck-input min-w-0 flex-1" value={newName} maxLength={30} onInput={(e) => setNewName((e.target as HTMLInputElement).value)} aria-label="Nombre del alumno" />
                  <button class="ck-btn-sm" disabled={!newName.trim() || newName.trim() === open.name} onClick={() => action(open, 'update', { name: newName.trim() })}>Guardar nombre</button>
                </div>
                <select class="ck-input w-full" value={open.age_group} onChange={(e) => action(open, 'update', { ageGroup: (e.target as HTMLSelectElement).value })}>
                  {Object.entries(AGE_GROUPS).map(([k, v]) => <option value={k}>{v.emoji} {v.label} ({v.range})</option>)}
                </select>
                <div class="grid grid-cols-10 gap-1">
                  {AVATARS.map((a) => <button key={a} onClick={() => action(open, 'update', { avatar: a })} class={`rounded-lg text-2xl ${open.avatar === a ? 'bg-violet-200' : 'hover:bg-slate-200'}`}>{a}</button>)}
                </div>
                <form onSubmit={(e) => remove(open, e)} class="space-y-2 rounded-2xl bg-rose-50 p-3">
                  <p class="text-sm font-bold text-rose-700">🗑️ Borrar alumno</p>
                  <p class="text-xs text-rose-700">Se borran su cuenta y todo su progreso. No se puede deshacer.</p>
                  <input type="password" required autocomplete="current-password" class="ck-input w-full" placeholder="Tu contraseña para confirmar" value={delPass} onInput={(e) => setDelPass((e.target as HTMLInputElement).value)} />
                  {delErr && <p class="text-sm font-bold text-rose-600">{delErr}</p>}
                  <button class="ck-btn-sm !bg-rose-600 !text-white">Borrar a {open.name}</button>
                </form>
              </div>
            </details>
          </div>
        )}
      </Modal>
    </div>
  );
}
