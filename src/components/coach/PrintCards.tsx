import { useState } from 'preact/hooks';
import { QR } from '../ui/QR';

interface Kid { id: number; name: string; avatar: string; username: string; token: string }
interface Props { classId: number; className: string; classCode: string; origin: string; students: Kid[] }

export default function PrintCards({ classId, className, classCode, origin, students }: Props) {
  const [secrets, setSecrets] = useState<Record<number, { password: string; pin: string }>>({});
  const [busy, setBusy] = useState(false);

  async function regenerate() {
    if (!confirm('Se crearán contraseñas y dibujos NUEVOS para todos (los antiguos dejarán de funcionar). Los enlaces/QR personales siguen funcionando. ¿Continuar?')) return;
    setBusy(true);
    const out: Record<number, { password: string; pin: string }> = {};
    for (const s of students) {
      const call = (action: string) => fetch(`/api/coach/students/${s.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) }).then((r) => r.json() as Promise<any>);
      const [p, n] = await Promise.all([call('reset-password'), call('reset-pin')]);
      out[s.id] = { password: p.password, pin: n.pin };
    }
    setSecrets(out);
    setBusy(false);
  }

  return (
    <div class="mx-auto max-w-5xl p-6">
      <div class="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <a href={`/profe/clase/${classId}`} class="ck-btn-sm">← Volver</a>
        <h1 class="flex-1 font-display text-2xl font-extrabold">🖨️ Tarjetas de acceso · {className}</h1>
        <button class="ck-btn-sm" disabled={busy} onClick={regenerate}>{busy ? 'Generando…' : '🔑 Incluir contraseñas nuevas'}</button>
        <button class="ck-btn ck-btn-primary" onClick={() => window.print()}>Imprimir</button>
      </div>
      <p class="mb-4 text-sm text-slate-500 print:hidden">Cada tarjeta tiene el QR personal del alumno: al escanearlo con el móvil entra directamente y el dispositivo le recuerda.</p>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 print:grid-cols-3">
        {students.map((s) => (
          <div key={s.id} class="break-inside-avoid rounded-3xl border-4 border-dashed border-violet-300 p-4 text-center">
            <p class="text-xs font-black uppercase tracking-widest text-violet-500">♞ ChessKids Academy</p>
            <p class="text-5xl">{s.avatar}</p>
            <p class="font-display text-2xl font-extrabold">{s.name}</p>
            <QR text={`${origin}/u/${s.token}`} size={130} class="mx-auto my-2" />
            <p class="text-xs text-slate-500">Escanéame para entrar</p>
            <div class="mt-2 rounded-xl bg-slate-50 p-2 text-left text-xs">
              <p>Clase: <b class="font-mono">{classCode}</b>{secrets[s.id] && <> · Dibujos: <span class="text-base">{secrets[s.id].pin}</span></>}</p>
              <p>Usuario: <b class="font-mono">{s.username}</b></p>
              {secrets[s.id] && <p>Contraseña: <b class="font-mono">{secrets[s.id].password}</b></p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
