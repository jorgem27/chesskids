import type { FunctionComponent } from 'preact';
import type { AgeGroup } from '../lib/catalog';

export interface GameResult {
  score: number;
  maxScore: number;
  mistakes: number;
  puzzlesSolved: number;
  perfect?: number; // e.g. fruit levels solved with the optimal path
}

/** What every game can call on the shell (feedback, sounds, progress, finish). */
export interface GameApi {
  ageGroup: AgeGroup;
  good(text?: string, opts?: { big?: boolean }): void;
  bad(text?: string): void;
  say(text: string, opts?: { speak?: boolean }): void; // mascot speech bubble
  progress(done: number, total: number): void;
  combo(n: number): void;
  finish(r: GameResult): void;
  speak(text: string): void;
}

export interface PlayerProps<C> { content: C; api: GameApi; title: string }
export interface EditorProps<C> {
  value: C;
  onChange: (c: C) => void;
  /** Club the activity belongs to (for editors that fetch club-scoped data). */
  clubId?: number;
  /** Lets an editor propose a title; applied only while the title is empty. */
  suggestTitle?: (t: string) => void;
}

export interface GameUi<C = any> {
  Player: FunctionComponent<PlayerProps<C>>;
  Editor: FunctionComponent<EditorProps<C>>;
}
