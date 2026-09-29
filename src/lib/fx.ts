// Visual celebrations + Spanish voice-over. Client only.
import confetti from 'canvas-confetti';

const COLORS = ['#a855f7', '#f59e0b', '#22c55e', '#0ea5e9', '#ef4444', '#facc15'];

export function burst(x = 0.5, y = 0.6, power = 1) {
  confetti({ particleCount: Math.round(70 * power), spread: 70 + 20 * power, startVelocity: 35 + 10 * power, origin: { x, y }, colors: COLORS, scalar: 1.1 });
}

export function sideCannons() {
  const end = Date.now() + 900;
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors: COLORS });
    confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors: COLORS });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function starShower() {
  const star = confetti.shapeFromText ? confetti.shapeFromText({ text: '⭐', scalar: 2 }) : undefined;
  confetti({ particleCount: 40, spread: 120, origin: { y: 0.3 }, shapes: star ? [star] : undefined, scalar: 2, gravity: 0.8, ticks: 200 });
}

export function emojiRain(emoji: string) {
  if (!confetti.shapeFromText) return burst();
  const s = confetti.shapeFromText({ text: emoji, scalar: 2.5 });
  confetti({ particleCount: 30, spread: 160, origin: { y: 0.2 }, shapes: [s], scalar: 2.5, gravity: 0.7, ticks: 250, flat: true } as any);
}

// ---------- Voice (speechSynthesis in Spanish) ----------

let voice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  const vs = window.speechSynthesis?.getVoices() ?? [];
  voice = vs.find((v) => v.lang === 'es-ES') ?? vs.find((v) => v.lang.startsWith('es')) ?? null;
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

export function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''));
    u.lang = 'es-ES';
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.pitch = 1.15;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
