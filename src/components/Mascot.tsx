// Бипин — сова-робот, маскот сайта. Инлайн-SVG, без картинок.
// Чиби-стиль: большая круглая голова, компактное тело, индиго-палитра.
//
// ПРИНЦИП: каждая часть лица нарисована всегда и имеет стабильный класс.
// Настроение — это только CSS-класс на <svg> (m-happy, m-sad, ...), который
// задаёт трансформы через переход. Так смена эмоции плавная, а не скачком.
// Бесконечные циклы (моргание, пульс) живут во вложенных группах, чтобы
// не конфликтовать с позой слоя.
import { useId } from 'react';

export type MascotMood = 'happy' | 'ok' | 'think' | 'cool' | 'wow' | 'sad' | 'angry';

const C = {
  body: '#4f46e5',
  bodyDark: '#4338ca',
  belly: '#e0e7ff',
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
const EYE_Y = 68;
const EYE_RAD = 15;

// Звезда для wow: 5 лучей, внешний радиус 13, внутренний 5.5, центр (0,0).
const STAR =
  'M0 -13 L3.23 -4.45 L12.36 -4.02 L5.23 1.70 L7.64 10.52 L0 5.5 L-7.64 10.52 L-5.23 1.70 L-12.36 -4.02 L-3.23 -4.45 Z';

// Рты: все шесть вариантов существуют всегда, видимый задаётся классом.
const MOUTHS = {
  happy: 'M48 97 Q60 108 72 97',
  ok: 'M50 98 Q60 106 70 98',
  think: 'M50 100 L70 100',
  cool: 'M50 97 Q62 102 72 93',
  sad: 'M48 104 Q60 93 72 104',
  angry: 'M50 102 L70 102',
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
          <rect x="27" y="56" width="32" height="24" rx="11" />
          <rect x="61" y="56" width="32" height="24" rx="11" />
        </clipPath>
      </defs>

      {/* Тень и хвостик — за телом */}
      <ellipse cx="60" cy="168" rx="30" ry="6" fill={C.ink} opacity="0.25" />
      <path d="M52 150 L46 168 L60 160 L74 168 L68 150 Z" fill={C.bodyDark} />
      <line x1="60" y1="152" x2="60" y2="161" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />

      {/* Покачивание — внешний слой бесконечного цикла */}
      <g className="rb-bob">
        <g className="rb-emote">
          {/* Ушки-перья */}
          <path d="M30 50 L22 18 L50 34 Z" fill={C.bodyDark} />
          <path d="M90 50 L98 18 L70 34 Z" fill={C.bodyDark} />
          <g stroke={C.ink} strokeWidth="2" strokeLinecap="round" opacity="0.5">
            <line x1="32" y1="40" x2="28" y2="27" />
            <line x1="88" y1="40" x2="92" y2="27" />
          </g>

          {/* Голова и тело */}
          <circle cx="60" cy="72" r="40" fill={C.body} />
          {/* блик на макушке */}
          <path d="M36 48 Q48 34 66 34" fill="none" stroke={C.white} strokeWidth="4" strokeLinecap="round" opacity="0.18" />
          {/* хохолок на лбу */}
          <g stroke={C.bodyDark} strokeWidth="2.5" strokeLinecap="round" opacity="0.9">
            <line x1="54" y1="36" x2="52" y2="29" />
            <line x1="60" y1="34" x2="60" y2="27" />
            <line x1="66" y1="36" x2="68" y2="29" />
          </g>
          {/* щёчные гребешки */}
          <g fill="none" stroke={C.bodyDark} strokeWidth="2" strokeLinecap="round" opacity="0.7">
            <path d="M24 84 q4 5 0 10" />
            <path d="M96 84 q-4 5 0 10" />
          </g>
          <ellipse cx="60" cy="140" rx="26" ry="22" fill={C.body} />
          <ellipse cx="60" cy="144" rx="15" ry="14" fill={C.belly} opacity="0.8" />
          {/* ряды перьев на пузе */}
          <g fill="none" stroke={C.bodyDark} strokeWidth="2" strokeLinecap="round" opacity="0.45">
            <path d="M50 140 q5 5 10 0" />
            <path d="M52 148 q5 5 10 0" />
            <path d="M54 156 q4 4 8 0" />
          </g>

          {/* Крылья */}
          <path
            className="rb-wing-l"
            d="M28 100 Q12 120 20 152 Q28 154 33 134 Q37 114 28 100 Z"
            fill={C.bodyDark}
          />
          <path
            className="rb-wing-r"
            d="M92 100 Q108 120 100 152 Q92 154 87 134 Q83 114 90 100 Z"
            fill={C.bodyDark}
          />
          {/* швы перьев на крыльях */}
          <g fill="none" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" opacity="0.45">
            <path d="M24 118 Q28 128 26 140" />
            <path d="M96 118 Q92 128 94 140" />
          </g>

          {/* Антенна */}
          <circle cx="60" cy="34" r="4" fill={C.bodyDark} />
          <line x1="60" y1="32" x2="60" y2="22" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
          <circle className="rb-antenna" cx="60" cy="17" r="5.5" fill={C.beak} />
          <circle cx="58.5" cy="15.5" r="1.6" fill={C.white} opacity="0.8" />

          {/* === МОРДА === */}

          {/* Лицевой диск */}
          <g fill={C.belly} opacity="0.35">
            <circle cx={EYE_L} cy={EYE_Y} r="21" />
            <circle cx={EYE_R} cy={EYE_Y} r="21" />
          </g>

          {/* Брови: всегда нарисованы, настроение двигает трансформом */}
          <path
            className="rb-brow rb-brow-l"
            d="M30 50 Q42 45 54 50"
            stroke={C.ink}
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            className="rb-brow rb-brow-r"
            d="M66 50 Q78 45 90 50"
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
            <rect x="27" y="56" width="32" height="24" rx="11" fill={C.glass} />
            <rect x="61" y="56" width="32" height="24" rx="11" fill={C.glass} />
            <rect x="57" y="65" width="6" height="4" rx="2" fill={C.glass} />
            <line x1="34" y1="66" x2="44" y2="66" stroke={C.white} strokeWidth="2.5" opacity="0.5" />
            <line x1="68" y1="66" x2="78" y2="66" stroke={C.white} strokeWidth="2.5" opacity="0.5" />
            <g clipPath={`url(#${uid}-lens)`}>
              <g className="rb-shine">
                <path d="M-14 52 L-2 52 L-26 82 L-38 82 Z" fill="#fff" opacity="0.35" />
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
            <ellipse cx="60" cy="99" rx="8" ry="9" fill={C.beakDark} />
            <ellipse cx="60" cy="104" rx="4" ry="3.5" fill="#f472b6" />
          </g>

          {/* Клюв */}
          <path d="M60 84 L54 92 L66 92 Z" fill={C.beak} />
          <line x1="60" y1="85" x2="60" y2="91" stroke={C.beakDark} strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="57.5" cy="88.5" r="1.1" fill={C.beakDark} />

          {/* Румянец */}
          <g className="rb-blush" fill={C.blush} opacity="0">
            <ellipse cx="27" cy="86" rx="6" ry="4" />
            <ellipse cx="93" cy="86" rx="6" ry="4" />
          </g>

          {/* Слеза (только m-sad) */}
          <path className="rb-tear" d="M80 80 q5 7 0 11 q-5 -4 0 -11 Z" fill={C.tear} opacity="0" />

          {/* Облачко мысли (только m-think) */}
          <g className="rb-thought" opacity="0" fill={C.white}>
            <circle cx="103" cy="38" r="8" opacity="0.85" />
            <circle cx="112" cy="24" r="5" opacity="0.85" />
            <circle cx="118" cy="14" r="3" opacity="0.85" />
          </g>

          {/* === РЕКВИЗИТ === */}
          <rect x="12" y="128" width="30" height="24" rx="3" fill={C.ink} opacity="0.9" />
          <path d="M12 131 L20 128 L12 136 Z" fill={C.white} opacity="0.85" />
          <g fill="none" stroke="#94a3b8" strokeWidth="1.6" opacity="0.9">
            <circle cx="14" cy="134" r="1.6" />
            <circle cx="14" cy="140" r="1.6" />
            <circle cx="14" cy="146" r="1.6" />
          </g>
          <line x1="19" y1="136" x2="37" y2="136" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="19" y1="143" x2="32" y2="143" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="100" y1="124" x2="114" y2="90" stroke={C.beak} strokeWidth="5" strokeLinecap="round" />
          <rect x="107.5" y="98" width="7" height="5" rx="1" fill="#94a3b8" transform="rotate(24 111 100)" />
          <rect x="110.5" y="90" width="6" height="7" rx="2" fill="#f472b6" transform="rotate(24 113 93)" />
          <path d="M114 90 l3 -9 l-8 5 Z" fill={C.ink} />

          {/* Лапки с когтями */}
          <rect x="42" y="156" width="13" height="9" rx="4" fill={C.beak} />
          <rect x="65" y="156" width="13" height="9" rx="4" fill={C.beak} />
          <line x1="48.5" y1="157" x2="48.5" y2="164" stroke={C.beakDark} strokeWidth="1.6" opacity="0.8" />
          <line x1="71.5" y1="157" x2="71.5" y2="164" stroke={C.beakDark} strokeWidth="1.6" opacity="0.8" />
          <g stroke={C.beakDark} strokeWidth="2" strokeLinecap="round" opacity="0.85">
            <line x1="45" y1="165" x2="45" y2="161" />
            <line x1="52" y1="165" x2="54" y2="161" />
            <line x1="68" y1="165" x2="68" y2="161" />
            <line x1="76" y1="165" x2="78" y2="161" />
          </g>
        </g>
      </g>
    </svg>
  );
}
