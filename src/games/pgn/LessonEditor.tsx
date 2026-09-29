import { useMemo } from 'preact/hooks';
import type { LessonContent } from '../meta';
import type { EditorProps } from '../types';
import { compileLesson, validateLessonPgn } from './lesson';

export function LessonEditor({ value, onChange }: EditorProps<LessonContent>) {
  const errors = validateLessonPgn(value.pgn);
  const lesson = useMemo(() => {
    try { return compileLesson(value.pgn); } catch { return null; }
  }, [value.pgn]);

  return (
    <div class="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div class="space-y-2">
        <label class="block font-bold">PGN de la lección</label>
        <textarea class="ck-input h-[420px] w-full font-mono text-xs leading-relaxed" spellcheck={false} value={value.pgn}
          onInput={(e) => onChange({ pgn: (e.target as HTMLTextAreaElement).value })} />
        {errors.length ? (
          <p class="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">⚠️ {errors.join(' · ')}</p>
        ) : (
          <p class="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✅ PGN correcto · {lesson?.steps.length} jugadas · {lesson?.steps.filter((s) => s.kind === 'ask').length} preguntas · tablero desde las {lesson?.orientation === 'white' ? 'blancas' : 'negras'}</p>
        )}
      </div>
      <div class="space-y-3 text-sm">
        <div class="rounded-2xl bg-sky-50 p-4">
          <p class="mb-2 font-black text-sky-900">📝 Chuleta de etiquetas</p>
          <ul class="space-y-1.5 text-slate-700">
            <li><code class="ck-code">{'{[%ask ¿Pregunta?]}'}</code> tras una jugada: se para y el alumno juega la siguiente.</li>
            <li><code class="ck-code">{'( 5... Nf6 {[%pts 50]} )'}</code> variante = alternativa válida con 50 puntos.</li>
            <li><code class="ck-code">{'( 5... Qh4 {Texto} )'}</code> variante sin puntos = error típico; se muestra el texto.</li>
            <li><code class="ck-code">{'{[%pts 80]}'}</code> en la jugada principal: sus puntos (100 por defecto).</li>
            <li><code class="ck-code">{'{Texto}'}</code> comentario que lee la mascota (el alumno pulsa «Continuar»).</li>
            <li><code class="ck-code">{'[%cal Ge2e4] [%csl Rd4]'}</code> flechas y círculos (formato Lichess).</li>
            <li><code class="ck-code">{'[FEN "..."]'}</code> para empezar desde una posición.</li>
          </ul>
          <p class="mt-2 text-slate-500">Truco: crea el estudio en Lichess con comentarios y flechas y exporta el PGN.</p>
        </div>
        {lesson && (
          <div class="rounded-2xl bg-white p-4 shadow-sm">
            <p class="mb-2 font-black">Preguntas</p>
            <ol class="list-decimal space-y-2 pl-5">
              {lesson.steps.map((s, i) => s.kind === 'ask' && (
                <li key={i}>
                  <span class="font-bold">{s.question}</span>
                  <div class="text-xs text-slate-600">
                    ✅ {s.answers.map((a) => `${a.san} (${a.pts})`).join(' · ')}
                    {s.wrong.length > 0 && <> · ❌ {s.wrong.map((w) => w.san).join(', ')}</>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
