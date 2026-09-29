// "Trotón", the ChessKids mascot: a friendly little knight. Original SVG drawing.
export type Mood = 'happy' | 'think' | 'sad' | 'party' | 'wow';

export function Mascot({ mood = 'happy', size = 96, class: cls = '' }: { mood?: Mood; size?: number; class?: string }) {
  const mouth = {
    happy: <path d="M54 74 q8 8 16 0" stroke="#3b0764" stroke-width="3.5" fill="none" stroke-linecap="round" />,
    party: <path d="M51 71 q11 15 22 0 z" fill="#3b0764" />,
    wow: <ellipse cx="62" cy="75" rx="5" ry="6" fill="#3b0764" />,
    think: <path d="M55 76 h13" stroke="#3b0764" stroke-width="3.5" stroke-linecap="round" />,
    sad: <path d="M54 79 q8 -7 16 0" stroke="#3b0764" stroke-width="3.5" fill="none" stroke-linecap="round" />,
  }[mood];
  const eyeY = mood === 'think' ? 46 : 48;
  const pupilDx = mood === 'think' ? 3 : 0;
  const pupilDy = mood === 'think' ? -3 : 0;
  return (
    <svg viewBox="0 0 120 130" width={size} height={size * 130 / 120} class={cls} aria-hidden="true">
      {/* base */}
      <ellipse cx="60" cy="122" rx="38" ry="6" fill="#000" opacity=".12" />
      <path d="M22 118 q38 -14 76 0 v-10 q-38 -12 -76 0z" fill="#6d28d9" />
      {/* head/neck (knight silhouette) */}
      <path d="M34 108 C30 88 30 70 38 56 C28 58 18 54 16 46 C14 38 22 30 32 26 C40 14 56 8 72 12 C92 16 104 34 102 58 C100 78 92 92 88 108 Z" fill="#8b5cf6" />
      {/* mane */}
      <path d="M72 12 C84 10 96 18 100 30 C104 42 104 56 100 66 C98 52 94 40 86 32 C82 24 78 18 72 12Z" fill="#6d28d9" />
      <path d="M86 20 l10 -12 l2 14z M78 14 l4 -12 l6 12z" fill="#6d28d9" />
      {/* ear */}
      <path d="M58 14 l6 -12 l8 14z" fill="#8b5cf6" stroke="#6d28d9" stroke-width="2" />
      {/* snout */}
      <ellipse cx="26" cy="42" rx="11" ry="9" fill="#c4b5fd" />
      <circle cx="22" cy="40" r="2" fill="#4c1d95" />
      {/* eyes */}
      <circle cx="50" cy={eyeY} r="10" fill="white" />
      <circle cx="74" cy={eyeY} r="10" fill="white" />
      {mood === 'party' ? (
        <>
          <path d={`M43 ${eyeY + 2} q7 -9 14 0`} stroke="#1e1b4b" stroke-width="3.5" fill="none" stroke-linecap="round" />
          <path d={`M67 ${eyeY + 2} q7 -9 14 0`} stroke="#1e1b4b" stroke-width="3.5" fill="none" stroke-linecap="round" />
        </>
      ) : (
        <>
          <circle cx={52 + pupilDx} cy={eyeY + 1 + pupilDy} r={mood === 'wow' ? 6 : 5} fill="#1e1b4b" />
          <circle cx={76 + pupilDx} cy={eyeY + 1 + pupilDy} r={mood === 'wow' ? 6 : 5} fill="#1e1b4b" />
          <circle cx={54 + pupilDx} cy={eyeY - 1 + pupilDy} r="1.8" fill="white" />
          <circle cx={78 + pupilDx} cy={eyeY - 1 + pupilDy} r="1.8" fill="white" />
        </>
      )}
      {mood === 'sad' && <path d="M42 36 l14 5 M82 36 l-14 5" stroke="#4c1d95" stroke-width="3" stroke-linecap="round" />}
      {/* cheeks */}
      <circle cx="42" cy="64" r="5" fill="#f472b6" opacity=".55" />
      <circle cx="84" cy="64" r="5" fill="#f472b6" opacity=".55" />
      {mouth}
      {mood === 'party' && <path d="M60 4 l6 -2 l-3 10z" fill="#facc15" />}
    </svg>
  );
}
