// Робит — SVG-маскот сайта. Инлайн, без картинок: чёткий везде, работает офлайн.
// Настроения: happy (улыбка), think (наклон + прищур), cool (звёздные глаза).
export type MascotMood = 'happy' | 'think' | 'cool';

export default function Mascot({
  mood = 'happy',
  size = 72,
  label = 'Робит, маскот сайта',
}: {
  mood?: MascotMood;
  size?: number;
  label?: string;
}) {
  const tilt = mood === 'think' ? 'rotate(-8)' : 'none';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label={label}
      style={{ transform: tilt, flex: 'none' }}
    >
      <line x1="48" y1="10" x2="48" y2="24" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
      <circle cx="48" cy="10" r="6" fill={mood === 'cool' ? '#fbbf24' : '#38bdf8'}>
        <animate attributeName="opacity" values="1;.4;1" dur="2s" repeatCount="indefinite" />
      </circle>
      <rect x="22" y="24" width="52" height="44" rx="16" fill="#2563eb" />
      <rect x="22" y="24" width="52" height="44" rx="16" fill="url(#mg)" opacity="0.35" />
      <defs>
        <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {mood === 'cool' ? (
        <>
          <text x="36" y="52" fontSize="16" textAnchor="middle">★</text>
          <text x="60" y="52" fontSize="16" textAnchor="middle">★</text>
        </>
      ) : (
        <>
          <ellipse cx="37" cy="46" rx="6" ry={mood === 'think' ? 3 : 7} fill="#fff" />
          <ellipse cx="59" cy="46" rx="6" ry={7} fill="#fff" />
          <circle cx="38" cy="47" r="3" fill="#0f172a" />
          <circle cx="58" cy="47" r="3" fill="#0f172a" />
        </>
      )}
      {mood === 'think' ? (
        <path d="M36 60 Q48 56 60 60" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M34 58 Q48 68 62 58" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      <rect x="30" y="70" width="36" height="14" rx="7" fill="#1e3a8a" />
      <circle cx="40" cy="77" r="2.5" fill="#fbbf24" />
      <circle cx="48" cy="77" r="2.5" fill="#38bdf8" />
      <circle cx="56" cy="77" r="2.5" fill="#4ade80" />
    </svg>
  );
}
