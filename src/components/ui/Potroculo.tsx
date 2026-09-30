// "Potróculo", the ChessKids mascot: a gentleman horse with top hat, monocle, moustache and a
// golden pawn. Original SVG "puppet": every body part is its own group (head, ears, eyes, mouth,
// arms, legs, tail, hat) so CSS can animate it — no image files, no 3D engine, cheap on phones.
// Poses and animations live in potroculo.css; the mood picks one of them.
import { useEffect, useRef, useState } from 'preact/hooks';
import { onTalking } from '../../lib/voice/talking';
import './potroculo.css';

export type Mood =
  | 'happy'  // default: breathing, blinking, tail swish
  | 'party'  // big win: dances with arms up
  | 'dance'
  | 'run'
  | 'angry'
  | 'sad'
  | 'wow'
  | 'think'
  | 'wave';

interface Props {
  mood?: Mood;
  size?: number;
  class?: string;
  /** Force the lips on/off. By default they follow the coach voice (src/lib/voice/talking.ts). */
  talking?: boolean;
}

const C = {
  line: '#3b2012',
  coat: '#c77a3a',
  coatShade: '#a65f28',
  muzzle: '#dfa066',
  mane: '#7a4320',
  maneDark: '#55290f',
  hoof: '#4a2a17',
  earIn: '#eaa877',
  hat: '#1f2430',
  hatTop: '#343b4d',
  red: '#d62828',
  redDark: '#9b1b1b',
  vest: '#1f3a6e',
  vestDark: '#142a52',
  shirt: '#ffffff',
  shirtShade: '#dbe4ef',
  gold: '#f2b632',
  goldDark: '#b77d10',
  goldLight: '#ffe38a',
  iris: '#5a3418',
  pupil: '#1a0f08',
  mouth: '#5a1d14',
  tongue: '#e46a6a',
};

// Limbs are drawn as thick rounded strokes with a darker stroke behind (cartoon outline).
function Limb({ d, fill, w }: { d: string; fill: string; w: number }) {
  return (
    <>
      <path d={d} stroke={C.line} stroke-width={w + 3.5} stroke-linecap="round" stroke-linejoin="round" fill="none" />
      <path d={d} stroke={fill} stroke-width={w} stroke-linecap="round" stroke-linejoin="round" fill="none" />
    </>
  );
}

function Hoof({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="6" fill={C.coat} stroke={C.line} stroke-width="1.8" />
      <path d={`M${x - 5.5} ${y + 1.5} a5.8 5.8 0 0 0 11 0 z`} fill={C.hoof} />
    </g>
  );
}

function Pawn({ x, y }: { x: number; y: number }) {
  // (x, y) = bottom centre of the pawn
  return (
    <g class="pt-pawn" stroke={C.goldDark} stroke-width="1.2">
      <rect x={x - 8} y={y - 4} width="16" height="5" rx="2" fill={C.gold} />
      <path d={`M${x - 5} ${y - 4} Q${x - 3} ${y - 11} ${x - 3.5} ${y - 15} h7 Q${x + 3} ${y - 11} ${x + 5} ${y - 4} z`} fill={C.gold} />
      <ellipse cx={x} cy={y - 15.5} rx="5.5" ry="1.8" fill={C.gold} />
      <circle cx={x} cy={y - 21} r="5" fill={C.gold} />
      <circle cx={x - 1.8} cy={y - 22.8} r="1.6" fill={C.goldLight} stroke="none" />
      <path d={`M${x - 2} ${y - 13} q-1 4 -2 8`} stroke={C.goldLight} stroke-width="1.4" fill="none" />
    </g>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'sad':
      return <path d="M85 123 Q95 115 105 123" stroke={C.mouth} stroke-width="3" fill="none" stroke-linecap="round" />;
    case 'wow':
      return (
        <g>
          <ellipse cx="95" cy="121" rx="6" ry="7.5" fill={C.mouth} stroke={C.line} stroke-width="1.5" />
          <ellipse cx="95" cy="125" rx="3.5" ry="2.2" fill={C.tongue} />
        </g>
      );
    case 'think':
      return <path d="M88 120 Q96 123 103 117" stroke={C.mouth} stroke-width="3" fill="none" stroke-linecap="round" />;
    case 'angry':
      return (
        <g>
          <rect x="83" y="115" width="24" height="9" rx="4" fill="#fff" stroke={C.mouth} stroke-width="2.2" />
          <path d="M83 119.5 h24 M89 115 v9 M95 115 v9 M101 115 v9" stroke={C.mouth} stroke-width="1.2" />
        </g>
      );
    case 'party':
    case 'dance':
    case 'run':
      return (
        <g>
          <path d="M79 114 Q95 136 111 114 Q95 119 79 114 Z" fill={C.mouth} stroke={C.line} stroke-width="1.6" stroke-linejoin="round" />
          <path d="M82 115.5 Q95 119.5 108 115.5 L107 119 Q95 122.5 83 119 Z" fill="#fff" />
          <path d="M88 127 Q95 122 102 127 Q95 131 88 127 Z" fill={C.tongue} />
        </g>
      );
    default:
      return (
        <g>
          <path d="M81 114 Q95 130 109 114 Q95 118 81 114 Z" fill={C.mouth} stroke={C.line} stroke-width="1.6" stroke-linejoin="round" />
          <path d="M83.5 115.3 Q95 118.8 106.5 115.3 L105.6 118.5 Q95 121.5 84.4 118.5 Z" fill="#fff" />
        </g>
      );
  }
}

// Animated "speaking" mouth: two shapes whose scale is driven by CSS (see .pt-talk).
function TalkMouth() {
  return (
    <g class="pt-talkmouth">
      <ellipse cx="95" cy="119" rx="10" ry="6.5" fill={C.mouth} stroke={C.line} stroke-width="1.6" />
      <path d="M86.5 116 Q95 113.5 103.5 116 L102.5 118 Q95 116.5 87.5 118 Z" fill="#fff" />
      <ellipse cx="95" cy="123" rx="5" ry="2.2" fill={C.tongue} />
    </g>
  );
}

function Brows({ mood }: { mood: Mood }) {
  const p = {
    angry: ['M79 66 L96 73', 'M122 66 L106 73'],
    sad: ['M80 72 Q86 66 95 67', 'M121 72 Q115 66 106 67'],
    wow: ['M80 63 Q88 57 96 62', 'M105 62 Q113 57 121 63'],
    think: ['M80 69 Q88 67 96 69', 'M105 64 Q113 59 121 63'],
  }[mood as string] ?? ['M80 68 Q88 63 96 67', 'M105 67 Q113 63 121 68'];
  return (
    <g class="pt-brows" stroke={C.maneDark} stroke-width="3.2" stroke-linecap="round" fill="none">
      <path d={p[0]} />
      <path d={p[1]} />
    </g>
  );
}

function Eyes({ mood }: { mood: Mood }) {
  if (mood === 'party' || mood === 'dance') {
    // happy closed eyes ^ ^
    return (
      <g stroke={C.pupil} stroke-width="3" stroke-linecap="round" fill="none">
        <path d="M81 82 Q88 74 95 82" />
        <path d="M106 82 Q113 74 120 82" />
      </g>
    );
  }
  const big = mood === 'wow';
  const dx = mood === 'think' ? 2 : mood === 'run' ? -2 : 0;
  const dy = mood === 'think' ? -3 : mood === 'sad' ? 2 : 0;
  const r = big ? 6 : 5;
  const eye = (cx: number, cls: string) => (
    <g class={`pt-eye ${cls}`}>
      <ellipse cx={cx} cy="80" rx="8.5" ry={big ? 10.5 : 9.5} fill="#fff" stroke={C.line} stroke-width="1.6" />
      <circle cx={cx + 1 + dx} cy={81 + dy} r={r} fill={C.iris} />
      <circle cx={cx + 1 + dx} cy={81 + dy} r={r * 0.52} fill={C.pupil} />
      <circle cx={cx + 2.6 + dx} cy={78.6 + dy} r="1.7" fill="#fff" />
      {mood === 'angry' && <path d={`M${cx - 9} 72 L${cx + 9} 72 L${cx + 9} 77 L${cx - 9} 77 Z`} fill={C.coat} />}
      {mood === 'sad' && <path d={`M${cx - 9} 71 L${cx + 9} 71 L${cx + 9} 75 L${cx - 9} 75 Z`} fill={C.coat} />}
    </g>
  );
  return (
    <>
      {eye(88, 'pt-eye-l')}
      {eye(113, 'pt-eye-r')}
    </>
  );
}

export function Potroculo({ mood = 'happy', size = 96, class: cls = '', talking }: Props) {
  const [voice, setVoice] = useState(false);
  useEffect(() => (talking === undefined ? onTalking(setVoice) : undefined), [talking]);
  const talk = talking ?? voice;
  // Pause every animation while the mascot is off-screen (saves battery on cheap phones).
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const armsUp = mood === 'party' || mood === 'dance';

  return (
    <svg
      viewBox="0 0 200 240"
      width={size}
      height={(size * 240) / 200}
      ref={ref}
      class={`pt pt-m-${mood} ${talk ? 'pt-talk' : ''} ${visible ? '' : 'pt-paused'} ${cls}`}
      aria-hidden="true"
      overflow="visible"
    >
      <ellipse class="pt-shadow" cx="100" cy="231" rx="40" ry="6" fill="#000" opacity=".16" />

      {/* speed lines + dust (only visible while running) */}
      <g class="pt-speed" stroke="#94a3b8" stroke-width="3" stroke-linecap="round" opacity=".8">
        <path d="M150 120 h26" />
        <path d="M156 146 h30" />
        <path d="M148 172 h22" />
        <circle cx="140" cy="224" r="6" fill="#e2e8f0" stroke="none" />
        <circle cx="152" cy="220" r="4" fill="#e2e8f0" stroke="none" />
      </g>

      <g class="pt-all">
        {/* tail */}
        <g class="pt-tail">
          <path d="M118 174 C142 168 156 188 151 207 C149 216 142 222 133 224 C139 213 137 200 129 193 C124 188 120 184 117 181 Z" fill={C.mane} stroke={C.line} stroke-width="1.8" stroke-linejoin="round" />
          <path d="M126 183 C139 188 146 200 141 214" stroke={C.maneDark} stroke-width="2" fill="none" stroke-linecap="round" />
        </g>

        {/* legs */}
        <g class="pt-leg pt-leg-l">
          <path d="M82 176 L82 214 Q82 219 87 219 L93 219 Q98 219 98 214 L98 176 Z" fill={C.coat} stroke={C.line} stroke-width="1.8" />
          <path d="M81 212 q4 -5 8 0 q4 -5 10 0" fill={C.coatShade} />
          <path d="M79 216 h22 q2 0 2 3 v6 q0 3 -3 3 h-18 q-3 0 -3 -3 v-6 q0 -3 2 -3 z" fill={C.hoof} stroke={C.line} stroke-width="1.6" />
        </g>
        <g class="pt-leg pt-leg-r">
          <path d="M102 176 L102 214 Q102 219 107 219 L113 219 Q118 219 118 214 L118 176 Z" fill={C.coat} stroke={C.line} stroke-width="1.8" />
          <path d="M101 212 q4 -5 8 0 q4 -5 10 0" fill={C.coatShade} />
          <path d="M99 216 h22 q2 0 2 3 v6 q0 3 -3 3 h-18 q-3 0 -3 -3 v-6 q0 -3 2 -3 z" fill={C.hoof} stroke={C.line} stroke-width="1.6" />
        </g>

        {/* body */}
        <g class="pt-body">
          <path d="M77 150 Q74 186 90 188 L110 188 Q126 186 123 150 Z" fill={C.coat} stroke={C.line} stroke-width="1.8" />
          <path d="M87 110 L113 110 L116 140 L84 140 Z" fill={C.coat} stroke={C.line} stroke-width="1.8" />
          <path d="M79 138 Q100 128 121 138 L123 176 Q100 183 77 176 Z" fill={C.shirt} stroke={C.line} stroke-width="1.8" />
          <path d="M79 138 Q86 135 92 139 L100 163 L100 181 Q87 181 77 176 Z" fill={C.vest} stroke={C.line} stroke-width="1.8" stroke-linejoin="round" />
          <path d="M121 138 Q114 135 108 139 L100 163 L100 181 Q113 181 123 176 Z" fill={C.vest} stroke={C.line} stroke-width="1.8" stroke-linejoin="round" />
          <path d="M100 165 L100 181 Q107 181 113 180" stroke={C.vestDark} stroke-width="2" fill="none" />
          <circle cx="96.5" cy="167" r="1.9" fill={C.gold} stroke={C.goldDark} stroke-width=".8" />
          <circle cx="96.5" cy="175" r="1.9" fill={C.gold} stroke={C.goldDark} stroke-width=".8" />
          <path d="M83 168 h8" stroke={C.gold} stroke-width="1.3" stroke-linecap="round" />
          <path d="M109 147 h8 v5 q0 5 -4 7 q-4 -2 -4 -7 z" fill={C.gold} stroke={C.goldDark} stroke-width=".9" />
          <path d="M111.5 155 q1.5 -5 3 -6 q1 2 0 6 z" fill={C.vestDark} />
          {/* collar + bow tie */}
          <path d="M92 131 L99 139 L91 141 Z M108 131 L101 139 L109 141 Z" fill="#fff" stroke={C.line} stroke-width="1.2" stroke-linejoin="round" />
          <g class="pt-bow">
            <path d="M100 136 L86 128 Q82 136 86 145 Z" fill={C.red} stroke={C.redDark} stroke-width="1.5" stroke-linejoin="round" />
            <path d="M100 136 L114 128 Q118 136 114 145 Z" fill={C.red} stroke={C.redDark} stroke-width="1.5" stroke-linejoin="round" />
            <rect x="96" y="132" width="8" height="8" rx="2.5" fill={C.red} stroke={C.redDark} stroke-width="1.5" />
          </g>
          {/* monocle chain */}
          <path d="M122 88 Q132 112 119 142" stroke={C.gold} stroke-width="1.4" stroke-dasharray="2 1.6" fill="none" />
        </g>

        {/* right arm (hoof on the hip) */}
        <g class="pt-arm pt-arm-r">
          <Limb d="M117 142 L134 158" fill={C.shirt} w={11} />
          <g class="pt-fore pt-fore-r">
            <Limb d="M134 158 L125 172" fill={C.shirt} w={10} />
            <Hoof x={123} y={174} />
          </g>
        </g>

        {/* left arm holding the golden pawn */}
        <g class="pt-arm pt-arm-l">
          <Limb d="M83 142 L66 152" fill={C.shirt} w={11} />
          <g class="pt-fore pt-fore-l">
            <Limb d="M66 152 L61 134" fill={C.shirt} w={10} />
            <Pawn x={60} y={128} />
            <Hoof x={60} y={130} />
          </g>
        </g>

        {/* head */}
        <g class="pt-head">
          <path d="M118 60 C138 70 142 96 133 120 C129 128 121 129 114 124 C124 108 126 86 118 60 Z" fill={C.mane} stroke={C.line} stroke-width="1.8" />
          <path d="M124 76 C130 90 130 104 125 116" stroke={C.maneDark} stroke-width="2" fill="none" stroke-linecap="round" />

          <g class="pt-ear pt-ear-l">
            <path d="M74 58 L63 27 Q79 33 86 53 Z" fill={C.coat} stroke={C.line} stroke-width="1.8" stroke-linejoin="round" />
            <path d="M75 53 L67 33 Q77 38 81 51 Z" fill={C.earIn} />
          </g>
          <g class="pt-ear pt-ear-r">
            <path d="M126 58 L137 27 Q121 33 114 53 Z" fill={C.coat} stroke={C.line} stroke-width="1.8" stroke-linejoin="round" />
            <path d="M125 53 L133 33 Q123 38 119 51 Z" fill={C.earIn} />
          </g>

          <path d="M74 70 Q72 56 88 55 L113 55 Q129 56 128 72 L128 96 Q128 108 118 112 L82 112 Q72 108 72 96 Z" fill={C.coat} stroke={C.line} stroke-width="1.8" />
          <ellipse cx="95" cy="107" rx="29" ry="20" fill={C.muzzle} stroke={C.line} stroke-width="1.8" />
          <ellipse cx="106" cy="100" rx="11" ry="5" fill="#fff" opacity=".18" />
          <ellipse cx="84" cy="99" rx="3.4" ry="2.2" fill={C.maneDark} transform="rotate(-20 84 99)" />
          <ellipse cx="104" cy="99" rx="3.4" ry="2.2" fill={C.maneDark} transform="rotate(20 104 99)" />

          <g class="pt-blush" fill="#f87171" opacity=".3">
            <ellipse cx="75" cy="93" rx="5" ry="3.2" />
            <ellipse cx="125" cy="93" rx="5" ry="3.2" />
          </g>
          <ellipse class="pt-rage" cx="100" cy="88" rx="32" ry="32" fill="#ef4444" opacity="0" />

          <g class="pt-eyes"><Eyes mood={mood} /></g>
          <Brows mood={mood} />

          {/* monocle */}
          <circle cx="113" cy="80" r="12" fill="#bfe9ff" fill-opacity=".22" stroke={C.gold} stroke-width="3" />
          <circle cx="113" cy="80" r="12" fill="none" stroke={C.goldDark} stroke-width="1" />
          <path d="M106 73 q3 -3 7 -3" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".8" />

          {/* mouth + moustache */}
          <g class="pt-mouth">
            {talk ? <TalkMouth /> : <Mouth mood={mood} />}
          </g>
          <g class="pt-stache">
            <path d="M95 108 C87 101 76 103 72 110 C69 115 73 119 76 115 C79 111 86 111 95 113 C104 111 111 111 114 115 C117 119 121 115 118 110 C114 103 103 101 95 108 Z" fill={C.maneDark} stroke={C.line} stroke-width="1.2" stroke-linejoin="round" />
          </g>

          {/* forelock + top hat */}
          <path d="M78 60 Q82 73 89 64 Q94 75 100 64 Q107 74 112 63 Q118 71 122 60 L120 55 L80 55 Z" fill={C.mane} stroke={C.line} stroke-width="1.6" stroke-linejoin="round" />
          <g class="pt-hat">
            <ellipse cx="100" cy="56" rx="37" ry="7.5" fill={C.hat} stroke={C.line} stroke-width="1.8" />
            <path d="M76 54 L79 16 Q100 10 121 16 L124 54 Q100 60 76 54 Z" fill={C.hat} stroke={C.line} stroke-width="1.8" stroke-linejoin="round" />
            <path d="M77.3 40 Q100 44 122.7 40 L123.5 51 Q100 57 76.5 51 Z" fill={C.red} stroke={C.redDark} stroke-width="1.2" />
            <ellipse cx="100" cy="15.5" rx="21" ry="4.2" fill={C.hatTop} stroke={C.line} stroke-width="1.4" />
            <path d="M85 21 L83.5 38" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".14" />
          </g>

          {/* mood extras */}
          <g class="pt-steam" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1">
            <circle cx="62" cy="40" r="5" />
            <circle cx="138" cy="40" r="5" />
          </g>
          <path class="pt-vein" d="M130 18 l6 6 M136 18 l-6 6 M133 14 v4 M133 24 v4 M126 21 h4 M136 21 h4" stroke={C.red} stroke-width="2.2" stroke-linecap="round" />
          <path class="pt-tear" d="M84 88 q-3 5 0 7 q3 -2 0 -7 z" fill="#60a5fa" />
        </g>

        {/* music notes while dancing */}
        {armsUp && (
          <g class="pt-notes" fill="#8b5cf6">
            <path d="M150 60 v-14 l9 -3 v14" stroke="#8b5cf6" stroke-width="2" fill="none" />
            <circle cx="148" cy="61" r="3" /><circle cx="157" cy="58" r="3" />
            <path d="M40 80 v-12" stroke="#ec4899" stroke-width="2" />
            <circle cx="38" cy="81" r="3" fill="#ec4899" />
          </g>
        )}
      </g>
    </svg>
  );
}
