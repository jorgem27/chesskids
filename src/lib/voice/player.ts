// Client-side voice: picks the coach, chooses a fresh line for a cue and plays its
// pre-recorded clip (Web Audio) or, when there is no clip, the browser's speechSynthesis.
// Everything runs on the device: no per-play cost, no requests beyond our own static files.

import { audioContext, isMuted } from '../sfx';
import { COACHES, coachById, coachTemplates, type Coach } from './coaches';
import { BANKS, cleanForSpeech, clipId, pickFresh, render, type Cue, type Vars } from './phrases';
import { setTalking, stopTalking, talkLater } from './talking';

/** A coach id, 'random' (one coach per browser session) or 'none' (sounds only, no voice). */
export type CoachPref = string;

const PREF_KEY = 'ck-coach';
const SESSION_KEY = 'ck-coach-session';
const browser = typeof window !== 'undefined';

export function getCoachPref(): CoachPref {
  try { return localStorage.getItem(PREF_KEY) ?? 'random'; } catch { return 'random'; }
}

/** Save the choice; resolves once the new coach's clip list is loaded (so a sample plays as a clip). */
export async function setCoachPref(pref: CoachPref): Promise<void> {
  try { localStorage.setItem(PREF_KEY, pref); } catch { /* private mode */ }
  const c = currentCoach();
  if (c) await manifest(c);
}

let sessionCoach: string | null = null;

export function currentCoach(): Coach | null {
  const pref = getCoachPref();
  if (pref === 'none') return null;
  const chosen = coachById(pref);
  if (chosen) return chosen;
  if (!sessionCoach) {
    try { sessionCoach = sessionStorage.getItem(SESSION_KEY); } catch { /* ignore */ }
    if (!coachById(sessionCoach)) {
      sessionCoach = COACHES[Math.floor(Math.random() * COACHES.length)].id;
      try { sessionStorage.setItem(SESSION_KEY, sessionCoach); } catch { /* ignore */ }
    }
  }
  return coachById(sessionCoach) ?? COACHES[0];
}

// ---------- Clip manifests (which lines are recorded for each coach) ----------

interface Manifest { v: string; clips: Set<string> }
const manifests = new Map<string, Promise<Manifest>>();
const ready = new Map<string, Manifest>();

function manifest(c: Coach): Promise<Manifest> {
  let p = manifests.get(c.id);
  if (!p) {
    p = fetch(`/voices/${c.id}/manifest.json`)
      .then((r) => (r.ok ? r.json() : { v: '', clips: [] }))
      .then((j: any) => ({ v: String(j.v ?? ''), clips: new Set<string>(j.clips ?? []) }))
      .catch(() => ({ v: '', clips: new Set<string>() }));
    p.then((m) => ready.set(c.id, m));
    manifests.set(c.id, p);
  }
  return p;
}

// ---------- Choosing lines ----------

const recent: Partial<Record<Cue, string[]>> = {};

/**
 * A fresh line for a situation, avoiding the last ones said. When the coach has recorded
 * clips, only recorded lines are chosen (so the voice never switches mid-game).
 */
export function line(cue: Cue, vars: Vars = {}): string {
  const coach = currentCoach();
  const texts = coachTemplates(coach ?? undefined, cue, BANKS[cue])
    .map((t) => render(t, vars))
    .filter((t): t is string => !!t);
  const clips = coach ? ready.get(coach.id)?.clips : undefined;
  const recorded = clips ? texts.filter((t) => clips.has(clipId(t))) : [];
  return pickFresh(recorded.length ? recorded : texts, (recent[cue] ??= []));
}

/** Choose a line for the cue, say it and return it (to show it on screen too). */
export function cheer(cue: Cue, vars: Vars = {}, opts?: SpeakOpts): string {
  const text = line(cue, vars);
  speak(text, opts);
  return text;
}

// ---------- Playing ----------

/** `queue`: wait for the current line to finish instead of cutting it off. */
export interface SpeakOpts { queue?: boolean }

let token = 0;
let playing: AudioBufferSourceNode | null = null;
let playingEnds = 0; // AudioContext time when the current clip ends
const buffers = new Map<string, Promise<AudioBuffer>>();

function stop() {
  stopTalking();
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  try { playing?.stop(); } catch { /* ignore */ }
  playing = null;
}

function loadClip(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  let p = buffers.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then((b) => ctx.decodeAudioData(b));
    p.catch(() => buffers.delete(url));
    buffers.set(url, p);
    if (buffers.size > 60) buffers.delete(buffers.keys().next().value!);
  }
  return p;
}

async function playClip(coach: Coach, m: Manifest, id: string, my: number, queue: boolean) {
  const ctx = audioContext();
  if (!ctx) throw new Error('no audio');
  const buf = await loadClip(ctx, `/voices/${coach.id}/${id}.mp3?v=${m.v}`);
  if (my !== token || isMuted()) return;
  const at = queue ? Math.max(ctx.currentTime, playingEnds + 0.15) : ctx.currentTime;
  if (!queue) try { playing?.stop(); } catch { /* ignore */ }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(at);
  playing = src;
  playingEnds = at + buf.duration;
  talkLater((at - ctx.currentTime) * 1000, buf.duration * 1000);
}

/** Say any text with the current coach's voice (clip if recorded, browser voice otherwise). */
export function speak(text: string, opts?: SpeakOpts) {
  if (!browser || !text || isMuted()) return;
  const coach = currentCoach();
  if (!coach) return;
  const said = cleanForSpeech(text);
  if (!said) return;
  const queue = !!opts?.queue;
  if (!queue) stop();
  const my = ++token;
  const m = ready.get(coach.id);
  const id = clipId(said);
  if (m?.clips.has(id)) playClip(coach, m, id, my, queue).catch(() => { if (my === token) webSpeak(said, coach); });
  else webSpeak(said, coach); // speechSynthesis queues by itself unless stop() cancelled it
}

// ---------- Browser voice fallback ----------

let voices: SpeechSynthesisVoice[] = [];
const MALE = /pablo|[aá]lvaro|jorge|diego|juan|carlos|enrique|ra[uú]l|jos[eé]|gonzalo|tom[aá]s|alonso|dar[ií]o|andr[eé]s/i;

function bestVoice(male: boolean): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let top = -1;
  for (const v of voices) {
    if (!v.lang.toLowerCase().startsWith('es')) continue;
    let s = 0;
    if (/es[-_]es/i.test(v.lang)) s += 3;
    if (/natural|neural|online|premium|enhanced/i.test(v.name)) s += 4;
    if (/google/i.test(v.name)) s += 2;
    if (MALE.test(v.name) === male) s += 2;
    if (s > top) { top = s; best = v; }
  }
  return best;
}

let utterances = 0;

function webSpeak(text: string, coach: Coach) {
  const ss = window.speechSynthesis;
  if (!ss) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const v = bestVoice(coach.web.male);
    u.lang = v?.lang ?? 'es-ES';
    if (v) u.voice = v;
    u.rate = coach.web.rate;
    u.pitch = coach.web.pitch;
    // A cancelled utterance's onerror/onend can arrive after the next one starts: only the
    // latest utterance may turn the lips off.
    const mine = ++utterances;
    u.onstart = () => setTalking(true);
    u.onend = u.onerror = () => { if (mine === utterances) setTalking(false); };
    ss.speak(u);
  } catch { /* ignore */ }
}

if (browser) {
  if (window.speechSynthesis) {
    const load = () => { voices = window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
  }
  const c = currentCoach();
  if (c) void manifest(c);
}
