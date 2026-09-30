import type { Api } from '@lichess-org/chessground/api';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Key } from '@lichess-org/chessground/types';
import { Chess } from 'chess.js';
import { useMemo, useRef, useState } from 'preact/hooks';
import { sfx, vibrate } from '../../lib/sfx';
import { Board, isPromotion, syncBoard } from '../chess/Board';
import type { LessonContent } from '../meta';
import { applyUci } from '../puzzle/logic';
import { ALMOST_TEXT } from '../rules';
import type { PlayerProps } from '../types';
import { compileLesson, type Step } from './lesson';
import type { Shape } from './parser';

const toCg = (shapes: Shape[]): DrawShape[] =>
  shapes.map((s) => ({ orig: s.orig as Key, dest: s.dest as Key | undefined, brush: s.brush }));

export function LessonPlayer({ content, api }: PlayerProps<LessonContent>) {
  const lesson = useMemo(() => compileLesson(content.pgn, content.questions), [content.pgn, content.questions]);
  const cg = useRef<Api | null>(null);
  const chess = useRef(new Chess(lesson.startFen));
  const st = useRef({ i: 0, tries: 0, score: 0, correct: 0, mistakes: 0, waiting: null as null | (() => void), asking: false });
  const [waiting, setWaiting] = useState(false);
  const [shake, setShake] = useState(0);
  const [glow, setGlow] = useState(0);
  const questions = lesson.steps.filter((s) => s.kind === 'ask').length;
  const [answered, setAnswered] = useState(0);

  function waitTap(then: () => void) {
    st.current.waiting = then;
    setWaiting(true);
  }
  function continueTap() {
    const fn = st.current.waiting;
    st.current.waiting = null;
    setWaiting(false);
    sfx.tap();
    fn?.();
  }

  function playMove(uci: string, then: () => void, delay = 700) {
    setTimeout(() => {
      const m = applyUci(chess.current, uci);
      m?.captured ? sfx.capture() : sfx.move();
      syncBoard(cg.current!, chess.current, { movable: null, lastMove: uci });
      then();
    }, delay);
  }

  function showText(text: string, shapes: Shape[], wait: boolean, then: () => void) {
    cg.current!.setAutoShapes(toCg(shapes));
    if (text) {
      api.say(text, { speak: api.ageGroup === 'peque' });
      if (wait || text.length > 0) return waitTap(then);
    }
    if (wait) return waitTap(then);
    then();
  }

  function run(i: number) {
    const s = st.current;
    s.i = i;
    if (i >= lesson.steps.length) {
      api.progress(1, 1);
      api.finish({ score: s.score, maxScore: lesson.maxScore, mistakes: s.mistakes, puzzlesSolved: s.correct });
      return;
    }
    api.progress(i, lesson.steps.length);
    const step = lesson.steps[i];
    if (step.kind === 'auto') {
      playMove(step.uci, () => showText(step.text, step.shapes, step.wait, () => run(i + 1)), step.text ? 500 : 800);
      return;
    }
    // Question
    s.tries = 0;
    s.asking = true;
    cg.current!.setAutoShapes(toCg(step.questionShapes));
    api.say(`❓ ${step.question}`, { speak: true });
    sfx.pop();
    syncBoard(cg.current!, chess.current, { movable: chess.current.turn() === 'w' ? 'white' : 'black' });
  }

  function afterAnswer(step: Extract<Step, { kind: 'ask' }>, earned: number, playedUci: string) {
    const s = st.current;
    s.asking = false;
    s.score += earned;
    setAnswered((a) => a + 1);
    const finishStep = () => showText(step.afterText, step.afterShapes, step.afterWait, () => run(s.i + 1));
    if (playedUci.slice(0, 4) === step.main.uci.slice(0, 4)) {
      finishStep();
    } else {
      // Alternative accepted: show the game move that continues the lesson.
      setTimeout(() => {
        chess.current.load(step.fenBefore);
        syncBoard(cg.current!, chess.current, { movable: null });
        cg.current!.setAutoShapes([{ orig: step.main.uci.slice(0, 2) as Key, dest: step.main.uci.slice(2, 4) as Key, brush: 'blue' }]);
        api.say(`En la partida se jugó ${step.main.san}. ¡Mira!`);
        playMove(step.main.uci, finishStep, 1400);
      }, 1600);
    }
  }

  function onMove(orig: Key, dest: Key) {
    const s = st.current;
    const step = lesson.steps[s.i];
    if (!s.asking || !step || step.kind !== 'ask') return;
    let uci = orig + dest;
    if (isPromotion(chess.current, orig, dest)) uci += 'q';
    const ans = step.answers.find((a) => a.uci.slice(0, 4) === uci.slice(0, 4));
    if (ans) {
      const m = applyUci(chess.current, ans.uci);
      m?.captured ? sfx.capture() : sfx.move();
      syncBoard(cg.current!, chess.current, { movable: null, lastMove: ans.uci });
      cg.current!.setAutoShapes([]);
      const earned = s.tries === 0 ? ans.pts : Math.round(ans.pts / 2);
      if (ans.isMain) s.correct++;
      setGlow((g) => g + 1);
      api.good(ans.text && !ans.isMain ? `${ans.pts >= step.main.pts ? '¡Perfecto!' : '¡Buena idea!'} ${ans.text}` : undefined, { big: ans.isMain && s.tries === 0 });
      afterAnswer(step, earned, ans.uci);
      return;
    }
    // "Not the best": back to the same position, no mistake, no penalty.
    const almost = step.almost.find((w) => w.uci.slice(0, 4) === uci.slice(0, 4));
    if (almost) {
      setTimeout(() => {
        syncBoard(cg.current!, chess.current, { movable: chess.current.turn() === 'w' ? 'white' : 'black' });
        api.say(almost.text || ALMOST_TEXT);
        sfx.hint();
      }, 350);
      return;
    }
    // Wrong
    s.tries++;
    s.mistakes++;
    vibrate(120);
    setShake((x) => x + 1);
    const known = step.wrong.find((w) => w.uci.slice(0, 4) === uci.slice(0, 4));
    setTimeout(() => {
      syncBoard(cg.current!, chess.current, { movable: chess.current.turn() === 'w' ? 'white' : 'black' });
      const from = step.main.uci.slice(0, 2) as Key;
      if (s.tries >= 3) {
        // Reveal and move on
        s.asking = false;
        api.bad(`La respuesta era ${step.main.san}. ¡La próxima la sacas! 💪`);
        cg.current!.setAutoShapes([{ orig: from, dest: step.main.uci.slice(2, 4) as Key, brush: 'green' }]);
        playMove(step.main.uci, () => afterAnswer(step, 0, step.main.uci), 1500);
        return;
      }
      api.bad(known?.text || (step.hint ? `Pista: ${step.hint}` : s.tries === 1 ? 'Mmm… piensa otra vez 🤔' : 'Pista: mira la pieza del círculo ✨'));
      if (s.tries >= 2) { cg.current!.setAutoShapes([{ orig: from, brush: 'yellow' }]); sfx.hint(); }
    }, 350);
  }

  const ready = (a: Api) => {
    cg.current = a;
    a.set({ orientation: lesson.orientation, movable: { events: { after: onMove } } });
    syncBoard(a, chess.current, { movable: null });
    const start = () => run(0);
    if (lesson.intro) showText(lesson.intro, lesson.introShapes, true, start);
    else { a.setAutoShapes(toCg(lesson.introShapes)); setTimeout(start, 600); }
  };

  return (
    <div class="flex w-full flex-col items-center gap-3">
      <div class="flex w-full max-w-[min(92vw,66vh)] items-center justify-between text-sm font-bold text-slate-500">
        <span class="rounded-full bg-white/80 px-3 py-1 shadow-sm">📖 {lesson.title}</span>
        <span class="rounded-full bg-white/80 px-3 py-1 shadow-sm">❓ {answered} / {questions}</span>
      </div>
      <div class="w-full max-w-[min(92vw,66vh)]">
        <Board config={{ fen: lesson.startFen, orientation: lesson.orientation }} onReady={ready} shake={shake} glow={glow} />
      </div>
      <div class="h-16">
        {waiting && (
          <button onClick={continueTap} class="ck-btn ck-btn-primary animate-[ck-pop_.3s_ease-out] px-10 text-xl">
            Continuar ▶
          </button>
        )}
      </div>
    </div>
  );
}
