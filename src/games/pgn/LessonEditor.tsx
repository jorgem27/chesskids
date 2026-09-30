import { useMemo } from 'preact/hooks';
import type { LessonContent } from '../meta';
import type { EditorProps } from '../types';
import { RulesEditor } from '../RulesEditor';
import type { MoveRule } from '../rules';
import { compileLesson, validateLessonPgn, type QuestionCfg, type Step } from './lesson';

export function LessonEditor({ value, onChange }: EditorProps<LessonContent>) {
  const errors = validateLessonPgn(value.pgn, value.questions);
  const lesson = useMemo(() => {
    try { return compileLesson(value.pgn, value.questions); } catch { return null; }
  }, [value.pgn, value.questions]);

  type Ask = Extract<Step, { kind: 'ask' }>;
  const asks = (lesson?.steps.filter((s) => s.kind === 'ask') ?? []) as Ask[];

  function patchQuestion(fen: string, patch: Partial<QuestionCfg>) {
    onChange({ ...value, questions: { ...value.questions, [fen]: { ...value.questions?.[fen], ...patch } } });
  }

  /** Effective alternatives of a question (PGN + coach edits), as editable rules. */
  function rulesOf(a: Ask): MoveRule[] {
    return [
      ...a.answers.filter((x) => !x.isMain).map((x): MoveRule => ({ uci: x.uci, kind: 'good', pts: x.pts, text: x.text })),
      ...a.almost.map((x): MoveRule => ({ uci: x.uci, kind: 'almost', text: x.text })),
      ...a.wrong.map((x): MoveRule => ({ uci: x.uci, kind: 'wrong', text: x.text })),
    ];
  }

  return (
    <div class="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div class="space-y-2">
        <label class="block font-bold">PGN de la lección</label>
        <textarea class="ck-input h-[420px] w-full font-mono text-xs leading-relaxed" spellcheck={false} value={value.pgn}
          onInput={(e) => onChange({ ...value, pgn: (e.target as HTMLTextAreaElement).value })} />
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
            <li><code class="ck-code">{'( 5... Nc6 {[%retry] Casi} )'}</code> variante «no es la mejor»: vuelve a la misma posición sin contar como fallo.</li>
            <li><code class="ck-code">{'{[%ask ¿…?] [%hint Mira f7]}'}</code> pista tras fallar. Todo esto también se edita abajo sin escribir código.</li>
            <li><code class="ck-code">{'{[%pts 80]}'}</code> en la jugada principal: sus puntos (100 por defecto).</li>
            <li><code class="ck-code">{'{Texto}'}</code> comentario que lee la mascota (el alumno pulsa «Continuar»).</li>
            <li><code class="ck-code">{'[%cal Ge2e4] [%csl Rd4]'}</code> flechas y círculos (formato Lichess).</li>
            <li><code class="ck-code">{'[FEN "..."]'}</code> para empezar desde una posición.</li>
          </ul>
          <p class="mt-2 text-slate-500">Truco: crea el estudio en Lichess con comentarios y flechas y exporta el PGN.</p>
        </div>
      </div>
      {asks.length > 0 && (
        <div class="space-y-3 lg:col-span-2">
          <p class="text-lg font-black">🎯 Ajustes de cada pregunta</p>
          {asks.map((a, i) => {
            const cfg = value.questions?.[a.fenBefore] ?? {};
            return (
              <div key={a.fenBefore} class="space-y-2 rounded-2xl bg-slate-50 p-3 text-sm">
                <div class="flex flex-wrap items-center gap-3">
                  <b class="rounded-full bg-sky-600 px-3 py-1 text-white">Pregunta {i + 1}: {a.main.san}</b>
                  <label class="flex items-center gap-1 font-bold">⭐ Puntos
                    <input type="number" min={0} max={1000} class="ck-input w-20 !py-1" value={a.main.pts}
                      onInput={(e) => patchQuestion(a.fenBefore, { pts: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) })} />
                  </label>
                </div>
                <label class="block font-bold">❓ Pregunta
                  <input class="ck-input mt-1 w-full !py-1 font-normal" value={a.question}
                    onInput={(e) => patchQuestion(a.fenBefore, { question: (e.target as HTMLInputElement).value })} />
                </label>
                <label class="block font-bold">💡 Pista (se muestra tras fallar)
                  <input class="ck-input mt-1 w-full !py-1 font-normal" placeholder="Ej: ¡Defiende la casilla f7!" value={cfg.hint ?? a.hint}
                    onInput={(e) => patchQuestion(a.fenBefore, { hint: (e.target as HTMLInputElement).value })} />
                </label>
                <p class="font-bold">Otras jugadas (aceptadas, «no es la mejor» o errores)</p>
                <RulesEditor key={`${a.fenBefore}|${a.main.uci}`} fen={a.fenBefore} bestUci={a.main.uci} defaultPts={a.main.pts}
                  rules={rulesOf(a)} onChange={(rules) => patchQuestion(a.fenBefore, { rules })} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
