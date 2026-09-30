// "Potróculo", the sophisticated ChessKids mascot for projector mode: a professional knight with a monocle.
export type Mood = 'happy' | 'think' | 'sad' | 'party' | 'wow';

export function Potroculo({ mood = 'happy', size = 96, class: cls = '' }: { mood?: Mood; size?: number; class?: string }) {
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
    <svg viewBox="0 0 120 140" width={size} height={size * 140 / 120} class={cls} aria-hidden="true">
      <defs>
        {/* Shading gradients for a more professional 3D-like look */}
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#9333ea" />
          <stop offset="100%" stop-color="#6b21a8" />
        </linearGradient>
        <linearGradient id="maneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7e22ce" />
          <stop offset="100%" stop-color="#4c1d95" />
        </linearGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a" />
          <stop offset="50%" stop-color="#eab308" />
          <stop offset="100%" stop-color="#854d0e" />
        </linearGradient>
        <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8" />
          <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.2" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.4" />
        </linearGradient>
        <linearGradient id="hatGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <linearGradient id="tieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ef4444" />
          <stop offset="100%" stop-color="#991b1b" />
        </linearGradient>
        <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.25" />
        </filter>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.15" />
        </filter>
      </defs>

      <g transform="translate(0, 10)">
        {/* base */}
        <ellipse cx="60" cy="122" rx="38" ry="6" fill="#000" opacity=".2" />
        <path d="M22 118 q38 -14 76 0 v-10 q-38 -12 -76 0z" fill="url(#maneGrad)" filter="url(#dropShadow)" />
        
        {/* head/neck (knight silhouette) */}
        <path d="M34 108 C30 88 30 70 38 56 C28 58 18 54 16 46 C14 38 22 30 32 26 C40 14 56 8 72 12 C92 16 104 34 102 58 C100 78 92 92 88 108 Z" fill="url(#bodyGrad)" filter="url(#dropShadow)" />
        
        {/* mane */}
        <path d="M72 12 C84 10 96 18 100 30 C104 42 104 56 100 66 C98 52 94 40 86 32 C82 24 78 18 72 12Z" fill="url(#maneGrad)" />
        <path d="M86 20 l10 -12 l2 14z M78 14 l4 -12 l6 12z" fill="url(#maneGrad)" />
        
        {/* ear */}
        <path d="M58 14 l6 -12 l8 14z" fill="url(#bodyGrad)" stroke="url(#maneGrad)" stroke-width="2" />
        
        {/* snout */}
        <ellipse cx="26" cy="42" rx="11" ry="9" fill="#d8b4fe" />
        <circle cx="22" cy="40" r="2" fill="#4c1d95" />

        {/* eyes (normal left eye, monocle right eye) */}
        <circle cx="48" cy={eyeY} r="11" fill="white" filter="url(#softShadow)" />
        
        {/* Right eye white base for monocle */}
        <circle cx="74" cy={eyeY} r="11" fill="white" />

        {mood === 'party' ? (
          <>
            <path d={`M41 ${eyeY + 2} q7 -9 14 0`} stroke="#1e1b4b" stroke-width="3.5" fill="none" stroke-linecap="round" />
            <path d={`M67 ${eyeY + 2} q7 -9 14 0`} stroke="#1e1b4b" stroke-width="3.5" fill="none" stroke-linecap="round" />
          </>
        ) : (
          <>
            <circle cx={50 + pupilDx} cy={eyeY + 1 + pupilDy} r={mood === 'wow' ? 6 : 5} fill="#1e1b4b" />
            <circle cx={76 + pupilDx} cy={eyeY + 1 + pupilDy} r={mood === 'wow' ? 6 : 5} fill="#1e1b4b" />
            <circle cx={52 + pupilDx} cy={eyeY - 1 + pupilDy} r="2" fill="white" />
            <circle cx={78 + pupilDx} cy={eyeY - 1 + pupilDy} r="2" fill="white" />
          </>
        )}
        
        {mood === 'sad' && <path d="M40 36 l14 5 M84 36 l-14 5" stroke="#4c1d95" stroke-width="3" stroke-linecap="round" />}
        
        {/* Monocle on right eye */}
        <g>
          {/* Glass */}
          <circle cx="74" cy={eyeY} r="13" fill="url(#glassGrad)" />
          {/* Gold rim */}
          <circle cx="74" cy={eyeY} r="13" fill="none" stroke="url(#goldGrad)" stroke-width="2.5" filter="url(#softShadow)" />
          {/* Gold chain hanging from the monocle */}
          <path d="M 87,48 C 95,55 98,75 80,95" fill="none" stroke="url(#goldGrad)" stroke-width="1.5" stroke-dasharray="2 1.5" />
        </g>

        {/* cheeks */}
        <circle cx="40" cy="64" r="5" fill="#f472b6" opacity=".55" />
        <circle cx="86" cy="64" r="5" fill="#f472b6" opacity=".55" />
        
        {/* Moustache! So professional! */}
        <path d="M52 68 Q 62 65 72 68 Q 78 74 74 74 Q 68 70 62 70 Q 56 70 50 74 Q 46 74 52 68 Z" fill="#1e1b4b" filter="url(#softShadow)" />
        
        {/* mouth */}
        {mouth}
        {mood === 'party' && <path d="M60 4 l6 -2 l-3 10z" fill="#facc15" />}
        
        {/* Top Hat */}
        <g filter="url(#dropShadow)">
          {/* Hat brim */}
          <ellipse cx="62" cy="18" rx="26" ry="6" fill="url(#hatGrad)" />
          {/* Hat body */}
          <path d="M46 16 L48 -10 C48 -14 76 -14 76 -10 L78 16 Z" fill="url(#hatGrad)" />
          {/* Hat top ellipse */}
          <ellipse cx="62" cy="-10" rx="14" ry="4" fill="#334155" />
          {/* Hat ribbon */}
          <path d="M47 8 L77 8 L78 16 L46 16 Z" fill="#ef4444" />
        </g>

        {/* Bow tie (Pajarita) */}
        <g transform="translate(62, 105)" filter="url(#dropShadow)">
          <path d="M -4,0 L -18,-8 L -16,8 Z" fill="url(#tieGrad)" />
          <path d="M 4,0 L 18,-8 L 16,8 Z" fill="url(#tieGrad)" />
          <circle cx="0" cy="0" r="5" fill="#7f1d1d" />
        </g>
      </g>
    </svg>
  );
}
