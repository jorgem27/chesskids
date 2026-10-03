// Classroom projector: an interactive PGN lesson where the dice picks who answers each question.
// A miss takes that kid (or team) out of the dice for the question and it bounces to the rest,
// with no clock, until someone finds the move or everybody has missed.
import type { Api } from '@lichess-org/chessground/api';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Key } from '@lichess-org/chessground/types';
import { Chess } from 'chess.js';
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Board, isPromotion, syncBoard } from '../../games/chess/Board';
import { compileLesson, type Step } from '../../games/pgn/lesson';
import type { QuestionOverrides } from '../../games/pgn/lesson';
import type { Shape } from '../../games/pgn/parser';
import { burst, cheer } from '../../lib/fx';
import { fail, isExhausted, isRebound, newRound, pickSpeaker, rollDice, roundPoints } from '../../lib/lessonRound';
import { fmtPoints, kidPoints, XP_BUDGETS } from '../../lib/projector';
import { sfx } from '../../lib/sfx';
import { useVoiceId } from '../../lib/voice/player';
import { applyUci } from '../../games/puzzle/logic';
import { Potroculo } from '../ui/Potroculo';
import CoachPicker from '../student/CoachPicker';
import { EMPTY, newNonce, Podium, shuffle, TEAM_PRESETS, tallyList, type Kid, type Tallies, type Team } from './Projector';

interface Lesson { id: number; title: string; pgn: string; questions?: QuestionOverrides }
interface Props { classId: number; className: string; students: Kid[]; lessons: Lesson[]; backUrl: string; canAward: boolean }

const CLASS_TEAM = { name: 'Clase', emoji: '🎓', color: '#2a4c9d' };
type Mode = 'intro' | 'auto' | 'idle' | 'rolling' | 'answering' | 'resolving' | 'done';

const toCg = (shapes: Shape[]): DrawShape[] => shapes.map((s) => ({ orig: s.orig as Key, dest: s.dest as Key | undefined, brush: s.brush }));

export default function LessonProjector({ classId, className, students, lessons, backUrl, canAward }: Props) {
  const costume = useVoiceId();
  const [phase, setPhase] = useState<'setup' | 'play' | 'podium'>('setup');
  const [solo, setSolo] = useState(true);
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<Team[]>([]);
  const [bench, setBench] = useState<Kid[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(lessons[0]?.id ?? null);
  const [xpBudget, setXpBudget] = useState(canAward ? 10 : 0);
  const [tallies, setTallies] = useState<Tallies>({});
  const [played, setPlayed] = useState(0);
  const [playing, setPlaying] = useState<Team[]>([]);
  const run = useRef({ nonce: '', startedAt: 0 });

  const present = students.filter((k) => !bench.some((b) => b.id === k.id));

  function makeTeams(n: number) {
    const t: Team[] = TEAM_PRESETS.slice(0, n).map((p) => ({ ...p, members: [], score: 0 }));
    shuffle(present).forEach((k, i) => t[i % n].members.push(k));
    setTeams(t);
    setSel(null);
  }
  useEffect(() => makeTeams(teamCount), [teamCount]);

  /** Tap a kid, then tap a team (or the bench) to move them there. */
  function moveTo(dest: number | 'bench') {
    const kid = students.find((k) => k.id === sel);
    if (!kid) return;
    setBench([...bench.filter((m) => m.id !== kid.id), ...(dest === 'bench' ? [kid] : [])]);
    if (!solo) setTeams(teams.map((t, i) => ({ ...t, members: [...t.members.filter((m) => m.id !== kid.id), ...(i === dest ? [kid] : [])] })));
    setSel(null);
    sfx.pop();
  }

  const lesson = lessons.find((l) => l.id === lessonId);
  function start() {
    if (!lesson || !present.length) return;
    sfx.unlock();
    sfx.fanfare();
    setPlaying(solo ? [{ ...CLASS_TEAM, members: present, score: 0 }] : teams.map((t) => ({ ...t, score: 0 })));
    setTallies({});
    setPlayed(0);
    setSel(null);
    run.current = { nonce: newNonce(), startedAt: Date.now() };
    setPhase('play');
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  if (phase === 'podium') {
    return <Podium solo={solo} teams={playing} tallies={tallies} budget={xpBudget} canAward={canAward} classId={classId} run={run.current} played={played}
      onAgain={() => setPhase('setup')} backUrl={backUrl} />;
  }
  if (phase === 'play' && lesson) {
    return <LessonArena lesson={lesson} teams={playing} setTeams={setPlaying} solo={solo} tallies={tallies} setTallies={setTallies}
      onEnd={(n) => { setPlayed(n); setPhase('podium'); }} />;
  }

  const selKid = students.find((k) => k.id === sel);
  const onBench = !!selKid && bench.some((m) => m.id === selKid.id);
  const groups: { name: string; emoji: string; color: string; members: Kid[] }[] = solo ? [{ ...CLASS_TEAM, members: present }] : teams;
  const asTarget = (active: boolean, go: () => void): JSX.HTMLAttributes<HTMLDivElement> => active
    ? { role: 'button', tabIndex: 0, onClick: go, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } } }
    : {};
  const moveHere = <p class="mt-1 rounded-xl bg-white/25 px-2 py-1 text-center font-bold">👇 Mover aquí</p>;
  const chip = (m: Kid) => (
    <button key={m.id} onClick={(e) => { e.stopPropagation(); sfx.tap(); setSel(sel === m.id ? null : m.id); }}
      class={`m-0.5 inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-1 text-sm font-bold transition ${sel === m.id ? 'scale-110 bg-amber-400 text-amber-950 ring-4 ring-amber-200' : 'bg-black/25 hover:bg-black/40'}`}>
      <span class="text-xl">{m.avatar}</span>{m.name}
    </button>
  );
  const pick = (on: boolean) => `min-h-11 rounded-xl px-4 py-2 font-black ${on ? 'bg-amber-400 text-amber-950' : 'bg-white/15'}`;

  return (
    <div class="ck-projector min-h-dvh p-6 md:p-10">
      <a href={backUrl} class="inline-flex min-h-11 items-center font-bold text-brand-200">← Volver</a>
      <div class="mx-auto max-w-6xl">
        <div class="flex items-center gap-4">
          <Potroculo costume={costume} mood="wave" size={130} />
          <div>
            <h1 class="font-display text-5xl font-extrabold">🎲 Lección con dado</h1>
            <p class="text-xl text-brand-200">{className} · El dado elige quién dice la jugada</p>
          </div>
        </div>

        <div class="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div class="rounded-3xl bg-white/10 p-5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="font-display text-2xl font-extrabold">1. ¿Quién juega?</h2>
              <div class="flex flex-wrap gap-2">
                <button onClick={() => setSolo(true)} class={pick(solo)}>🧒 Cada uno</button>
                <button onClick={() => setSolo(false)} class={pick(!solo)}>👥 Por equipos</button>
                {!solo && [2, 3, 4].map((n) => <button key={n} onClick={() => setTeamCount(n)} aria-label={`${n} equipos`} class={`h-11 w-11 rounded-xl font-black ${teamCount === n ? 'bg-amber-400 text-amber-950' : 'bg-white/15'}`}>{n}</button>)}
                {!solo && <button onClick={() => { sfx.whoosh(); makeTeams(teamCount); }} class="min-h-11 rounded-xl bg-white/15 px-3 font-bold">🔀 Mezclar</button>}
              </div>
            </div>
            <p class="mt-2 min-h-7 text-lg text-brand-100">
              {selKid ? <>👉 Toca {solo ? 'dónde' : 'un equipo o la silla'} para mover a <b>{selKid.avatar} {selKid.name}</b></> : '✋ Toca un alumno para marcarlo como ausente o cambiarlo de equipo'}
            </p>
            <div class={`mt-3 grid gap-3 ${solo ? '' : 'sm:grid-cols-2'}`}>
              {groups.map((t, i) => {
                const target = !!selKid && (solo ? onBench : !t.members.some((m) => m.id === selKid.id));
                return (
                  <div key={t.name} {...asTarget(target, () => moveTo(i))}
                    class={`rounded-2xl p-3 transition ${target ? 'cursor-pointer ring-4 ring-white/60 hover:scale-[1.02]' : ''}`}
                    style={{ background: `${t.color}33`, border: `3px solid ${t.color}` }}>
                    <p class="font-display text-xl font-extrabold">{t.emoji} {solo ? 'Hoy juegan' : t.name} <span class="text-sm font-bold opacity-80">· {t.members.length}</span></p>
                    <div class="mt-1">{t.members.map(chip)}</div>
                    {!t.members.length && <p class="text-xs opacity-80">Sin alumnos</p>}
                    {target && moveHere}
                  </div>
                );
              })}
            </div>
            {students.length > 0 && (
              <div {...asTarget(!!selKid && !onBench, () => moveTo('bench'))}
                class={`mt-3 rounded-2xl border-2 border-dashed border-white/30 p-3 ${selKid && !onBench ? 'cursor-pointer ring-4 ring-white/60' : ''}`}>
                <p class="font-bold">🪑 Hoy no vienen <span class="text-sm font-normal opacity-80">(no salen en el dado ni reciben XP)</span></p>
                <div class="mt-1">{bench.map(chip)}</div>
                {!bench.length && <p class="text-xs opacity-70">Mueve aquí a quien falte hoy.</p>}
                {selKid && !onBench && moveHere}
              </div>
            )}
          </div>

          <div class="rounded-3xl bg-white/10 p-5">
            <h2 class="font-display text-2xl font-extrabold">2. Lección</h2>
            <div class="mt-3 max-h-56 space-y-2 overflow-auto">
              {lessons.map((l) => (
                <label key={l.id} class={`flex cursor-pointer items-center gap-3 rounded-2xl p-3 ${lessonId === l.id ? 'bg-brand-500/60' : 'bg-white/10'}`}>
                  <input type="radio" name="lesson" checked={lessonId === l.id} onChange={() => setLessonId(l.id)} />
                  <span class="flex-1 font-bold">📖 {l.title}</span>
                </label>
              ))}
              {!lessons.length && <p class="opacity-80">Crea primero una lección interactiva (PGN) en el panel de profe.</p>}
            </div>
            <p class="mt-3 text-base text-brand-100">Sin tiempo: el que sale dice una jugada en el tablero. Si falla, sale del dado en esa pregunta y el dado rebota entre los demás.</p>
            <h2 class="mt-5 font-display text-2xl font-extrabold">3. Premio ✨</h2>
            {canAward ? (
              <>
                <div class="mt-2 flex flex-wrap gap-2">
                  {XP_BUDGETS.map((n) => <button key={n} onClick={() => setXpBudget(n)} class={pick(xpBudget === n)}>{n ? `${n} XP` : 'Sin XP'}</button>)}
                </div>
                <p class="mt-2 text-base text-brand-100">
                  {xpBudget ? `Hasta ${xpBudget} XP por alumno: 🎮 jugar · 🏆 puntos · 🎲 salir con el dado y acertar.` : 'Ronda de práctica: se guarda el resultado, pero no se da XP.'}
                </p>
              </>
            ) : <p class="mt-2 text-base text-brand-100">Solo el profe responsable (o con permiso para gestionar alumnos) puede dar XP. Esta ronda es de práctica.</p>}
          </div>
        </div>
        <div class="mt-6 rounded-3xl bg-white/10 p-4 md:p-6"><CoachPicker compact /></div>
        <div class="mt-8 text-center">
          {students.length > 0 && !present.length && <p class="mb-3 text-lg font-bold text-amber-200">🪑 Nadie juega hoy: marca a alguien como presente.</p>}
          <button disabled={!lesson || !present.length || (!solo && !teams.some((t) => t.members.length))} onClick={start} class="ck-btn ck-btn-orange px-16 py-6 text-3xl">¡Empezar la lección! 🎲</button>
        </div>
      </div>
    </div>
  );
}

interface ArenaProps {
  lesson: Lesson; teams: Team[]; setTeams: (t: Team[]) => void; solo: boolean;
  tallies: Tallies; setTallies: (f: (t: Tallies) => Tallies) => void; onEnd: (questionsPlayed: number) => void;
}

function LessonArena({ lesson: src, teams, setTeams, solo, tallies, setTallies, onEnd }: ArenaProps) {
  const lesson = useMemo(() => compileLesson(src.pgn, src.questions), [src]);
  const cg = useRef<Api | null>(null);
  const chess = useRef(new Chess(lesson.startFen));
  // Everything the board callback needs lives in the ref: onMove is registered once and would see stale state.
  const S = useRef({
    i: -1, q: -1, mode: 'intro' as Mode, round: newRound([]), cur: '', picked: null as Kid | null, team: 0, teams,
    picks: {} as Record<number, number>, waiting: null as null | (() => void),
  });
  S.current.teams = teams;
  const [mode, setMode] = useState<Mode>('intro');
  const [question, setQuestion] = useState('');
  const [caption, setCaption] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [picked, setPicked] = useState<Kid | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [rolling, setRolling] = useState<string | null>(null);
  const [qNum, setQNum] = useState(0);
  const [rebound, setRebound] = useState(false);
  const [shake, setShake] = useState(0);
  const [glow, setGlow] = useState(0);
  const [bump, setBump] = useState(-1);
  const [banner, setBanner] = useState<{ text: string; color: string } | null>(null);
  const [depth, setDepth] = useState(0); // > 0 while exploring a variation
  const questions = lesson.steps.filter((s) => s.kind === 'ask').length;

  const setM = (m: Mode) => { S.current.mode = m; setMode(m); };
  const color = () => (chess.current.turn() === 'w' ? 'white' : 'black') as 'white' | 'black';
  const contenders = () => (solo
    ? S.current.teams[0].members.map((k) => String(k.id))
    : S.current.teams.flatMap((t, i) => (t.members.length ? [String(i)] : [])));
  const face = (id: string) => (solo ? S.current.teams[0].members.find((k) => String(k.id) === id)?.avatar : S.current.teams[Number(id)]?.emoji) ?? '❔';

  function flash(text: string, bg: string, ms = 1800) {
    setBanner({ text, color: bg });
    setTimeout(() => setBanner(null), ms);
  }
  function waitTap(then: () => void) { S.current.waiting = then; setWaiting(true); }
  function continueTap() {
    const fn = S.current.waiting;
    S.current.waiting = null;
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

  function run(i: number) {
    const s = S.current;
    s.i = i;
    setCaption(''); setQuestion(''); setRebound(false);
    if (i >= lesson.steps.length) { onEnd(Math.max(1, s.q + 1)); return; }
    const step = lesson.steps[i];
    if (step.kind === 'jump') {
      // Into or out of a variation: announce it, then walk the board through the path (rewinding moves one by one).
      setM('auto');
      setDepth(step.depth);
      cg.current!.setAutoShapes([]);
      flash(step.text, step.depth ? '#0284c7' : '#2a4c9d', 1600);
      sfx.pop();
      step.path.forEach((f, k) => setTimeout(() => {
        chess.current.load(f.fen);
        syncBoard(cg.current!, chess.current, { movable: null, lastMove: f.lastMove });
        sfx.move();
      }, 700 + k * 450));
      setTimeout(() => run(i + 1), 700 + step.path.length * 450 + (step.depth ? 1500 : 700));
      return;
    }
    if (step.kind === 'auto') {
      setM('auto');
      playMove(step.uci, () => {
        cg.current!.setAutoShapes(toCg(step.shapes));
        if (step.text) { setCaption(step.text); waitTap(() => run(i + 1)); }
        else if (step.wait) waitTap(() => run(i + 1));
        else run(i + 1);
      }, step.text ? 500 : 800);
      return;
    }
    s.q++; setQNum(s.q + 1);
    s.round = newRound(contenders()); s.picked = null;
    setPicked(null); setFailed([]); setRebound(false);
    cg.current!.setAutoShapes(toCg(step.questionShapes));
    setQuestion(step.question);
    sfx.pop();
    syncBoard(cg.current!, chess.current, { movable: null });
    setM('idle');
  }

  /** The question is over (answered or revealed): show the game's move and wait for the coach. */
  function conclude(step: Extract<Step, { kind: 'ask' }>, playedUci: string | null) {
    const s = S.current;
    setM('done');
    const after = () => {
      cg.current!.setAutoShapes(toCg(step.afterShapes));
      if (step.afterText) setCaption(step.afterText);
      waitTap(() => run(s.i + 1));
    };
    if (playedUci && playedUci.slice(0, 4) === step.main.uci.slice(0, 4)) { after(); return; }
    setTimeout(() => {
      chess.current.load(step.fenBefore);
      syncBoard(cg.current!, chess.current, { movable: null });
      cg.current!.setAutoShapes([{ orig: step.main.uci.slice(0, 2) as Key, dest: step.main.uci.slice(2, 4) as Key, brush: playedUci ? 'blue' : 'green' }]);
      setCaption(playedUci ? `En la partida se jugó ${step.main.san}. ¡Mira!` : `La jugada era ${step.main.san}`);
      playMove(step.main.uci, after, 1400);
    }, playedUci ? 1600 : 200);
  }

  function skipQuestion() {
    const s = S.current;
    const step = lesson.steps[s.i];
    if (step?.kind !== 'ask' || (s.mode !== 'idle' && s.mode !== 'answering')) return;
    setM('resolving');
    chess.current.load(step.fenBefore);
    conclude(step, null);
  }

  function throwDice() {
    const s = S.current;
    if (s.mode !== 'idle') return;
    const id = rollDice(s.round);
    if (id === null) return;
    setM('rolling');
    cg.current!.setAutoShapes([]);
    const pool = s.round.pool;
    const spins = 14 + Math.floor(Math.random() * pool.length);
    let k = 0;
    const step = () => {
      k++;
      if (k < spins) { setRolling(face(pool[k % pool.length])); sfx.tick(); setTimeout(step, 60 + k * 12); return; }
      setRolling(null);
      land(id);
    };
    step();
  }

  function land(id: string) {
    const s = S.current;
    const bounced = isRebound(s.round);
    const teamIdx = solo ? 0 : Number(id);
    const tm = s.teams[teamIdx];
    const kid = solo ? tm.members.find((k) => String(k.id) === id)! : pickSpeaker(tm.members, s.picks)!;
    s.cur = id; s.team = teamIdx; s.picked = kid;
    s.picks[kid.id] = (s.picks[kid.id] ?? 0) + 1;
    setTallies((all) => ({ ...all, [kid.id]: { ...(all[kid.id] ?? EMPTY), picks: (all[kid.id] ?? EMPTY).picks + 1 } }));
    setPicked(kid); setRebound(bounced);
    setM('answering');
    sfx.coin();
    if (solo) cheer('kidPicked', { name: kid.name });
    else cheer(bounced ? 'teamRebound' : 'teamTurn', { team: tm.name });
    flash(solo ? `${kid.avatar} ¡${kid.name}!` : `${tm.emoji} ${tm.name} · ${kid.avatar} ${kid.name}`, tm.color, 1500);
    syncBoard(cg.current!, chess.current, { movable: color() });
  }

  function onMove(orig: Key, dest: Key) {
    const s = S.current;
    const step = lesson.steps[s.i];
    if (s.mode !== 'answering' || !step || step.kind !== 'ask') return;
    let uci = orig + dest;
    if (isPromotion(chess.current, orig, dest)) uci += 'q';
    const same = (a: { uci: string }) => a.uci.slice(0, 4) === uci.slice(0, 4);
    const ans = step.answers.find(same);
    const kid = s.picked!;
    const tm = s.teams[s.team];

    if (ans) {
      setM('resolving');
      const pts = roundPoints(isRebound(s.round), ans.pts, step.main.pts);
      const m = applyUci(chess.current, ans.uci);
      m?.captured ? sfx.capture() : sfx.move();
      syncBoard(cg.current!, chess.current, { movable: null, lastMove: ans.uci });
      cg.current!.setAutoShapes([]);
      setTeams(s.teams.map((t, i) => (i === s.team ? { ...t, score: t.score + pts } : t)));
      setBump(s.team); setTimeout(() => setBump(-1), 700);
      setTallies((all) => {
        const cur = all[kid.id] ?? EMPTY;
        return { ...all, [kid.id]: { ...cur, solved: cur.solved + 1, points: cur.points + pts } };
      });
      sfx.levelUp(); burst(0.5, 0.5, 1.4); setGlow((g) => g + 1);
      flash(`✅ ¡+${pts} para ${solo ? kid.name : `${tm.emoji} ${tm.name}`}!`, tm.color, 2000);
      if (ans.text && !ans.isMain) setCaption(ans.text);
      if (solo || Math.random() < 0.4) cheer('kidPoint', { name: kid.name });
      else cheer('teamPoint', { team: tm.name });
      conclude(step, ans.uci);
      return;
    }
    // "Not the best": same position, same speaker, no penalty.
    const almost = step.almost.find(same);
    if (almost) {
      setTimeout(() => {
        syncBoard(cg.current!, chess.current, { movable: color() });
        setCaption(almost.text || 'Casi… ¡esa no es la mejor! Prueba otra.');
        sfx.hint();
      }, 350);
      return;
    }
    // Miss: out of the dice for this question.
    setM('resolving');
    sfx.wrong();
    setShake((x) => x + 1);
    s.round = fail(s.round, s.cur);
    setFailed([...s.round.failed]);
    const known = step.wrong.find(same);
    setTimeout(() => {
      syncBoard(cg.current!, chess.current, { movable: null });
      if (known?.text) setCaption(known.text);
      if (isExhausted(s.round)) {
        flash('😮 ¡Nadie lo encontró! Mira…', '#64748b', 2000);
        conclude(step, null);
      } else {
        flash('🤔 Esa no era… ¡Rebote!', '#f59e0b', 1500);
        setM('idle');
      }
    }, 500);
  }

  const livePts = kidPoints(teams.map((t) => t.score), tallyList(teams, tallies));
  const maxScore = Math.max(1, ...teams.map((t) => t.score));
  const turnTeam = mode === 'answering' || mode === 'resolving' || mode === 'done' ? S.current.team : -1;
  const diceLabel = rebound || failed.length ? '🎲 ¡Rebote!' : '🎲 ¡Lanzar el dado!';
  const left = mode === 'idle' ? contenders().length - failed.length : 0;

  return (
    <div class="ck-projector relative flex min-h-dvh flex-col gap-4 p-4 lg:flex-row lg:p-6">
      {/* Scoreboard */}
      <aside class="flex gap-3 lg:w-72 lg:flex-col">
        {teams.map((t, i) => (
          <div key={t.name} class={`flex-1 rounded-3xl p-3 transition lg:flex-none ${i === turnTeam ? 'scale-105 ring-4' : solo ? '' : 'opacity-80'}`} style={{ background: `${t.color}40`, ['--tw-ring-color' as any]: t.color }}>
            <div class="flex items-center justify-between">
              <span class="font-display text-lg font-extrabold lg:text-2xl">{t.emoji} {t.name}</span>
              <span class="font-display text-3xl font-extrabold tabular-nums lg:text-5xl" style={bump === i ? 'animation: ck-pop .6s ease-out; display:inline-block' : ''}>{t.score}</span>
            </div>
            <div class="mt-2 h-3 overflow-hidden rounded-full bg-black/30"><div class="h-full rounded-full transition-all duration-700" style={{ width: `${(t.score / maxScore) * 100}%`, background: t.color }} /></div>
            <div class="mt-2 hidden flex-wrap gap-1 lg:flex">
              {t.members.map((m) => {
                const p = livePts.get(m.id) ?? 0;
                const out = solo ? failed.includes(String(m.id)) : failed.includes(String(i));
                return (
                  <span key={m.id} title={m.name} class={`inline-flex items-center gap-0.5 rounded-full px-1.5 text-xl ${picked?.id === m.id ? 'bg-amber-400 text-amber-950' : 'bg-black/25'} ${out ? 'opacity-40' : ''}`}>
                    {m.avatar}{p ? <b class="text-base">+{fmtPoints(p)}</b> : null}{out ? <span class="text-sm">❌</span> : null}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        <div class="hidden flex-1 lg:block" />
        <p class="hidden text-center text-sm text-brand-200 lg:block">Pregunta {Math.min(qNum, questions)} de {questions}</p>
      </aside>

      {/* Board */}
      <main class="flex flex-1 flex-col items-center justify-center">
        <p class="mb-2 min-h-16 max-w-3xl text-center font-display text-2xl font-extrabold lg:text-3xl">
          {rebound && mode !== 'done' && <span class="mr-2 rounded-full bg-amber-400 px-3 text-amber-950">REBOTE</span>}
          {question ? `❓ ${question}` : ''}
        </p>
        <div class="relative w-full max-w-[min(92vw,70vh)]">
          {depth > 0 && <span class="absolute -top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-sky-300 px-4 py-1 font-display text-lg font-extrabold text-sky-950 shadow-lg">🔀 VARIANTE</span>}
          <Board config={{ fen: lesson.startFen, orientation: lesson.orientation }} shake={shake} glow={glow} class={depth > 0 ? 'ck-variation' : ''}
            onReady={(a) => {
              cg.current = a;
              a.set({ movable: { events: { after: onMove } } });
              syncBoard(a, chess.current, { movable: null });
              if (lesson.intro) { setCaption(lesson.intro); a.setAutoShapes(toCg(lesson.introShapes)); waitTap(() => run(0)); }
              else { a.setAutoShapes(toCg(lesson.introShapes)); setTimeout(() => run(0), 600); }
            }} />
        </div>
        <p class="mt-3 min-h-14 max-w-3xl text-center text-xl font-bold text-brand-100 lg:text-2xl">{caption}</p>
      </main>

      {/* Controls */}
      <aside class="flex flex-row flex-wrap items-center justify-center gap-3 lg:w-64 lg:flex-col lg:justify-start">
        <div class="w-full rounded-3xl bg-white/10 p-3 text-center">
          <div class="flex h-20 items-center justify-center text-6xl">{rolling ?? picked?.avatar ?? '🎲'}</div>
          <p class="h-7 truncate font-display text-xl font-extrabold">{rolling ? '' : picked?.name ?? ''}</p>
          {mode === 'answering' && <p class="text-sm font-bold text-amber-200">Di tu jugada y muévela en el tablero 👆</p>}
          <button onClick={throwDice} disabled={mode !== 'idle'} class="ck-btn-sm mt-1 w-full justify-center !bg-white/20 !text-white disabled:opacity-40">{diceLabel}</button>
          {mode === 'idle' && <p class="mt-1 text-sm text-brand-200">{left === 1 ? 'Queda 1 en el dado' : `Quedan ${left} en el dado`}</p>}
        </div>
        {question && contenders().length > 1 && (
          <div class="flex w-full flex-wrap justify-center gap-1 rounded-3xl bg-white/10 p-2" aria-label="Quién sigue en el dado">
            {contenders().map((id) => (
              <span key={id} title={failed.includes(id) ? 'Fuera de esta pregunta' : 'En el dado'}
                class={`inline-flex items-center rounded-full px-2 text-2xl ${failed.includes(id) ? 'bg-black/30 opacity-40 line-through' : 'bg-white/20'} ${S.current.cur === id && mode === 'answering' ? 'ring-2 ring-amber-300' : ''}`}>
                {face(id)}{failed.includes(id) ? <span class="text-sm">❌</span> : null}
              </span>
            ))}
          </div>
        )}
        {waiting && <button onClick={continueTap} class="ck-btn ck-btn-orange w-full animate-[ck-pop_.3s_ease-out]">Continuar ▶</button>}
        <button onClick={skipQuestion} disabled={mode !== 'idle' && mode !== 'answering'} class="ck-btn-sm !bg-white/15 !text-white disabled:opacity-40">👀 Ver solución</button>
        <button onClick={() => { onEnd(Math.max(1, S.current.q + 1)); }} class="min-h-11 px-3 text-sm font-bold text-brand-200">🏁 Terminar</button>
      </aside>

      {banner && (
        <div class="pointer-events-none fixed inset-x-0 top-1/3 z-40 flex justify-center px-4">
          <div class="rounded-3xl px-10 py-6 text-center font-display text-4xl font-extrabold text-white shadow-2xl md:text-6xl" style={{ background: banner.color, animation: 'ck-pop .4s cubic-bezier(.2,.9,.3,1.4) both' }}>{banner.text}</div>
        </div>
      )}
    </div>
  );
}
