// Tiny "is the coach voice talking right now?" signal, so the mascot can move its lips.
// Kept apart from player.ts so pages that only show the mascot don't load the voice module.

type Listener = (on: boolean) => void;

const listeners = new Set<Listener>();
let talking = false;
let timers: ReturnType<typeof setTimeout>[] = [];

export function setTalking(on: boolean) {
  if (on === talking) return;
  talking = on;
  listeners.forEach((f) => f(on));
}

/** Talk for `durMs` starting in `delayMs` (used for pre-recorded clips, whose length is known). */
export function talkLater(delayMs: number, durMs: number) {
  timers.push(setTimeout(() => setTalking(true), Math.max(0, delayMs)));
  timers.push(setTimeout(() => setTalking(false), Math.max(0, delayMs) + durMs));
}

export function stopTalking() {
  timers.forEach(clearTimeout);
  timers = [];
  setTalking(false);
}

/** Subscribe to talking changes; returns the unsubscribe function. */
export function onTalking(fn: Listener): () => void {
  listeners.add(fn);
  fn(talking);
  return () => { listeners.delete(fn); };
}
