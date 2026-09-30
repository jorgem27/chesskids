// Shared "how is this move judged" model, used by puzzles and interactive lessons.
//   good   : also a correct answer (gives points, defaults to the step's points)
//   almost : "not the best" — the board goes back to the same position, NOT a mistake, no points
//   wrong  : a known mistake with its own message (counts as a mistake)
export type MoveKind = 'good' | 'almost' | 'wrong';

export interface MoveRule {
  uci: string;
  kind: MoveKind;
  pts?: number;
  text?: string;
}

export const KIND_LABEL: Record<MoveKind, string> = {
  good: '✅ Correcta también',
  almost: '🟡 No es la mejor (repite)',
  wrong: '❌ Error',
};

export const ALMOST_TEXT = 'Es una buena idea, pero hay una mejor. ¡Inténtalo otra vez! 🔁';

export const sameMove = (a: string, b: string) => a.slice(0, 4) === b.slice(0, 4);

export function findRule(rules: MoveRule[] | undefined, uci: string): MoveRule | undefined {
  return rules?.find((r) => sameMove(r.uci, uci));
}

/** Adds a rule, or replaces the existing one for the same from/to squares. */
export function upsertRule(rules: MoveRule[] | undefined, rule: MoveRule): MoveRule[] {
  return [...(rules ?? []).filter((r) => !sameMove(r.uci, rule.uci)), rule];
}
