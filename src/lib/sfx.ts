// Synthesized sound effects (Web Audio) — no audio files to download, works offline on phones.

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem('ck-muted') === '1';
} catch { /* private mode */ }

export function isMuted() { return muted; }
export function setMuted(v: boolean) {
  muted = v;
  try { localStorage.setItem('ck-muted', v ? '1' : '0'); } catch { /* ignore */ }
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.18, slideTo?: number) {
  const a = ac();
  if (!a || muted) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(start: number, dur: number, vol = 0.12, freq = 1800) {
  const a = ac();
  if (!a || muted) return;
  const t = a.currentTime + start;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1568;

export const sfx = {
  unlock() { ac(); },
  tap() { tone(900, 0, 0.05, 'triangle', 0.08); },
  move() { noise(0, 0.07, 0.25, 900); tone(220, 0, 0.06, 'triangle', 0.08); },
  capture() { noise(0, 0.12, 0.35, 600); tone(160, 0, 0.1, 'square', 0.05); },
  correct() { tone(C6, 0, 0.12, 'sine', 0.16); tone(E6, 0.09, 0.12, 'sine', 0.16); tone(G6, 0.18, 0.22, 'sine', 0.18); },
  wrong() { tone(330, 0, 0.14, 'triangle', 0.14, 260); tone(250, 0.13, 0.22, 'triangle', 0.14, 190); },
  hint() { tone(880, 0, 0.1, 'sine', 0.1); tone(1320, 0.08, 0.16, 'sine', 0.08); },
  pop() { tone(600, 0, 0.08, 'sine', 0.2, 1200); },
  coin() { tone(988, 0, 0.08, 'square', 0.06); tone(1319, 0.07, 0.25, 'square', 0.06); },
  combo(n: number) {
    const base = 520 * Math.pow(1.06, Math.min(n, 12));
    [0, 0.06, 0.12].forEach((d, i) => tone(base * [1, 1.25, 1.5][i], d, 0.12, 'square', 0.06));
  },
  star(i: number) { tone([C6, E6, G6][i % 3], 0, 0.25, 'triangle', 0.18); tone([C6, E6, G6][i % 3] * 2, 0.02, 0.2, 'sine', 0.06); },
  tick() { tone(1500, 0, 0.03, 'square', 0.04); },
  levelUp() {
    const seq = [C5, E5, G5, C6, G5, C6, E6];
    seq.forEach((f, i) => tone(f, i * 0.09, 0.18, 'square', 0.07));
    tone(C6, 0.65, 0.6, 'triangle', 0.16);
    tone(E6, 0.65, 0.6, 'triangle', 0.1);
    tone(G6, 0.65, 0.6, 'triangle', 0.08);
  },
  fanfare() {
    [[G5, 0], [G5, 0.12], [G5, 0.24], [C6, 0.36]].forEach(([f, d]) => tone(f, d, d === 0.36 ? 0.7 : 0.1, 'sawtooth', 0.05));
    tone(C5, 0.36, 0.7, 'triangle', 0.12);
  },
  whoosh() { noise(0, 0.35, 0.18, 2500); },
  drum() { tone(120, 0, 0.12, 'sine', 0.35, 50); noise(0, 0.05, 0.1, 3000); },
};

export function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}
