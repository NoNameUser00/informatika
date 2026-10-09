// Бипин — сова-робот, маскот сайта. Инлайн-SVG, без картинок.
//
// ПРИНЦИП: каждая часть лица нарисована всегда и имеет стабильный класс.
// Настроение — это только CSS-класс на <svg> (m-happy, m-sad, ...), который
// задаёт трансформы через переход. Так смена эмоции плавная, а не скачком.
// Бесконечные циклы (моргание, пульс) живут во вложенных группах, чтобы
// не конфликтовать с позой слоя.
import { useId } from 'react';

export type MascotMood = 'happy' | 'ok' | 'think' | 'cool' | 'wow' | 'sad' | 'angry';

const C = {
  body: '#2563eb',
  bodyDark: '#1d4ed8',
  belly: '#dbeafe',
  ink: '#0f172a',
  white: '#ffffff',
  beak: '#f59e0b',
  beakDark: '#b45309',
  blush: '#fca5a5',
  glass: '#0f172a',
  spark: '#fcd34d',
  tear: '#7dd3fc',
} as const;

// Лицо: центр глаз, радиус глаза.
const EYE_L = 44;
const EYE_R = 76;
const EYE_Y = 76;
const EYE_RAD = 15;

// Звезда для wow: 5 лучей, внешний радиус 13, внутренний 5.5, центр (0,0).
const STAR =
  'M0 -13 L3.23 -4.45 L12.36 -4.02 L5.23 1.70 L7.64 10.52 L0 5.5 L-7.64 10.52 L-5.23 1.70 L-12.36 -4.02 L-3.23 -4.45 Z';

// Рты: все шесть вариантов существуют всегда, видимый задаётся классом.
const MOUTHS = {
  happy: 'M48 100 Q60 111 72 100',
  ok: 'M50 101 Q60 109 70 101',
  think: 'M50 103 L70 103',
  cool: 'M50 100 Q62 105 72 96',
  sad: 'M48 107 Q60 96 72 107',
  angry: 'M50 105 L70 105',
} as const;

const MOOD_CLASS: Record<MascotMood, string> = {
  happy: 'm-happy',
  ok: 'm-ok',
  think: 'm-think',
  cool: 'm-cool',
  wow: 'm-wow',
  sad: 'm-sad',
  angry: 'm-angry',
};

export default function Mascot({
  mood = 'happy',
  size = 72,
  label = 'Бипин, маскот сайта',
  title,
  animate = true,
}: {
  mood?: MascotMood;
  size?: number;
  label?: string;
  title?: string;
  animate?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const h = Math.round(size * 1.5);
  const cls = [
    'rb',
    animate ? 'rb-anim' : '',
    MOOD_CLASS[mood],
    mood === 'think' ? 'rb-tilt' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 120 180"
      role="img"
      aria-label={label}
      className={cls}
      style={{ flex: 'none' }}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={`${uid}-eye-l`}>
          <circle cx={EYE_L} cy={EYE_Y} r={EYE_RAD} />
        </clipPath>
        <clipPath id={`${uid}-eye-r`}>
          <circle cx={EYE_R} cy={EYE_Y} r={EYE_RAD} />
        </clipPath>
        <clipPath id={`${uid}-lens`}>
          <rect x="29" y="65" width="30" height="23" rx="11" />
          <rect x="61" y="65" width="30" height="23" rx="11" />
        </clipPath>
      </defs>

      {/* Тень и хвост — за телом */}
      <ellipse cx="60" cy="168" rx="32" ry="6" fill={C.ink} opacity="0.25" />
      <path d="M48 144 L42 166 L60 158 L78 166 L72 144 Z" fill={C.bodyDark} />

      {/* Покачивание — внешний слой бесконечного цикла */}
      <g className="rb-bob">
        <g className="rb-emote">
          {/* Ушки-перья */}
          <path d="M38 64 L31 26 L58 46 Z" fill={C.bodyDark} />
          <path d="M82 64 L89 26 L62 46 Z" fill={C.bodyDark} />

          {/* Тело, пузо, перья на груди */}
          <ellipse cx="60" cy="106" rx="37" ry="49" fill={C.body} />
          <ellipse cx="60" cy="122" rx="23" ry="26" fill={C.belly} opacity="0.55" />
          <path
            d="M46 132 Q60 141 74 132"
            fill="none"
            stroke={C.belly}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.4"
          />
          <path
            d="M49 140 Q60 148 71 140"
            fill="none"
            stroke={C.belly}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.3"
          />

          {/* Крылья */}
          <path
            className="rb-wing-l"
            d="M30 92 Q12 112 20 150 Q28 152 33 132 Q37 110 30 92 Z"
            fill={C.bodyDark}
          />
          <path
            className="rb-wing-r"
            d="M90 92 Q108 112 100 150 Q92 152 87 132 Q83 110 90 92 Z"
            fill={C.bodyDark}
          />

          {/* Антенна */}
          <line x1="60" y1="60" x2="60" y2="46" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
          <circle className="rb-antenna" cx="60" cy="40" r="5.5" fill={C.beak} />

          {/* === МОРДА === */}

          {/* Лицевой диск */}
          <g fill={C.belly} opacity="0.3">
            <circle cx={EYE_L} cy={EYE_Y} r="22" />
            <circle cx={EYE_R} cy={EYE_Y} r="22" />
          </g>

          {/* Брови: всегда нарисованы, настроение двигает трансформом */}
          <path
            className="rb-brow rb-brow-l"
            d="M32 56 Q42 51 54 56"
            stroke={C.ink}
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            className="rb-brow rb-brow-r"
            d="M66 56 Q78 51 88 56"
            stroke={C.ink}
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />

          {/* Глаза: белок+зрачок в группе моргания, веко — отдельным слоем */}
          <g clipPath={`url(#${uid}-eye-l)`}>
            <g className="rb-blink">
              <circle cx={EYE_L} cy={EYE_Y} r={EYE_RAD} fill={C.white} />
              <circle cx={EYE_L} cy={EYE_Y} r="6.5" fill={C.ink} />
              <circle cx={EYE_L + 2.5} cy={EYE_Y - 2.5} r="2.2" fill={C.white} />
            </g>
            <g className="rb-lid rb-lid-l">
              <rect
                x={EYE_L - EYE_RAD}
                y={EYE_Y - EYE_RAD}
                width={EYE_RAD * 2}
                height={EYE_RAD * 2}
                fill={C.body}
              />
            </g>
          </g>
          <g clipPath={`url(#${uid}-eye-r)`}>
            <g className="rb-blink">
              <circle cx={EYE_R} cy={EYE_Y} r={EYE_RAD} fill={C.white} />
              <circle cx={EYE_R} cy={EYE_Y} r="6.5" fill={C.ink} />
              <circle cx={EYE_R + 2.5} cy={EYE_Y - 2.5} r="2.2" fill={C.white} />
            </g>
            <g className="rb-lid rb-lid-r">
              <rect
                x={EYE_R - EYE_RAD}
                y={EYE_Y - EYE_RAD}
                width={EYE_RAD * 2}
                height={EYE_RAD * 2}
                fill={C.body}
              />
            </g>
          </g>

          {/* Подмиг: закрытый глаз дугой (только m-ok) */}
          <path
            className="rb-eye-line rb-eye-line-r"
            d={`M${EYE_R - EYE_RAD} ${EYE_Y + 3} Q${EYE_R} ${EYE_Y - 8} ${EYE_R + EYE_RAD} ${EYE_Y + 3}`}
            fill="none"
            stroke={C.ink}
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Звёздные глаза (только m-wow) */}
          <g className="rb-stars" opacity="0">
            <g transform={`translate(${EYE_L} ${EYE_Y})`}>
              <path className="rb-star rb-star-l" d={STAR} fill={C.spark} />
            </g>
            <g transform={`translate(${EYE_R} ${EYE_Y})`}>
              <path className="rb-star rb-star-r" d={STAR} fill={C.spark} />
            </g>
          </g>

          {/* Очки (только m-cool) */}
          <g className="rb-glasses" opacity="0">
            <rect x="29" y="65" width="30" height="23" rx="11" fill={C.glass} />
            <rect x="61" y="65" width="30" height="23" rx="11" fill={C.glass} />
            <rect x="55" y="72" width="10" height="4" rx="2" fill={C.glass} />
            <line x1="36" y1="74" x2="45" y2="74" stroke={C.white} strokeWidth="2.5" opacity="0.5" />
            <line x1="69" y1="74" x2="78" y2="74" stroke={C.white} strokeWidth="2.5" opacity="0.5" />
            <g clipPath={`url(#${uid}-lens)`}>
              <g className="rb-shine">
                <path d="M-14 60 L-2 60 L-26 90 L-38 90 Z" fill="#fff" opacity="0.35" />
              </g>
            </g>
          </g>

          {/* Рты: все шесть вариантов, видимый задаётся классом */}
          <g fill="none" stroke={C.white} strokeWidth="4" strokeLinecap="round">
            <path className="rb-mouth rb-mouth-happy" d={MOUTHS.happy} />
            <path className="rb-mouth rb-mouth-ok" d={MOUTHS.ok} />
            <path className="rb-mouth rb-mouth-think" d={MOUTHS.think} />
            <path className="rb-mouth rb-mouth-cool" d={MOUTHS.cool} />
            <path className="rb-mouth rb-mouth-sad" d={MOUTHS.sad} />
            <path className="rb-mouth rb-mouth-angry" d={MOUTHS.angry} />
          </g>
          <g className="rb-mouth-open" opacity="0">
            <ellipse cx="60" cy="102" rx="8" ry="9" fill={C.beakDark} />
            <ellipse cx="60" cy="107" rx="4" ry="3.5" fill="#f472b6" />
          </g>

          {/* Клюв */}
          <path d="M60 88 L54 96 L66 96 Z" fill={C.beak} />

          {/* Румянец */}
          <g className="rb-blush" fill={C.blush} opacity="0">
            <ellipse cx="30" cy="92" rx="6" ry="4" />
            <ellipse cx="90" cy="92" rx="6" ry="4" />
          </g>

          {/* Слеза (только m-sad) */}
          <path className="rb-tear" d="M83 90 q5 7 0 11 q-5 -4 0 -11 Z" fill={C.tear} opacity="0" />

          {/* Облачко мысли (только m-think) */}
          <g className="rb-thought" opacity="0" fill={C.white}>
            <circle cx="100" cy="44" r="8" opacity="0.85" />
            <circle cx="110" cy="28" r="5" opacity="0.85" />
            <circle cx="116" cy="17" r="3" opacity="0.85" />
          </g>

          {/* === РЕКВИЗИТ === */}
          <rect x="15" y="126" width="32" height="25" rx="3" fill={C.ink} opacity="0.9" />
          <line x1="20" y1="134" x2="42" y2="134" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="20" y1="141" x2="36" y2="141" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="100" y1="122" x2="114" y2="88" stroke={C.beak} strokeWidth="5" strokeLinecap="round" />
          <path d="M114 88 l3 -9 l-8 5 Z" fill={C.ink} />

          {/* Лапки с когтями */}
          <rect x="40" y="150" width="14" height="12" rx="5" fill={C.beak} />
          <rect x="66" y="150" width="14" height="12" rx="5" fill={C.beak} />
          <g stroke={C.beakDark} strokeWidth="2" strokeLinecap="round" opacity="0.85">
            <line x1="44" y1="162" x2="44" y2="158" />
            <line x1="52" y1="162" x2="54" y2="158" />
            <line x1="70" y1="162" x2="70" y2="158" />
            <line x1="78" y1="162" x2="80" y2="158" />
          </g>
        </g>
      </g>
    </svg>
  );
}