// Робит — сова у доски: маскот сайта. Инлайн-SVG, без картинок.
// Настроения: happy (улыбка), think (прищур + наклон), cool (звёздные глаза).
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
  const h = Math.round(size * 1.5);
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 120 180"
      role="img"
      aria-label={label}
      style={{ transform: mood === 'think' ? 'rotate(-4deg)' : 'none', flex: 'none' }}
    >
      <ellipse cx="60" cy="162" rx="30" ry="7" fill="#0f172a" opacity="0.3" />
      <ellipse cx="60" cy="105" rx="40" ry="52" fill="#1e40af" />
      <ellipse cx="60" cy="120" rx="24" ry="30" fill="#93c5fd" opacity="0.5" />
      <path d="M28 62 L20 84 L40 74 Z" fill="#1e40af" />
      <path d="M92 62 L100 84 L80 74 Z" fill="#1e40af" />
      {mood === 'cool' ? (
        <>
          <text x="44" y="78" fontSize="17" textAnchor="middle">★</text>
          <text x="76" y="78" fontSize="17" textAnchor="middle">★</text>
        </>
      ) : (
        <>
          <circle cx="44" cy="70" r="15" fill="#fff" />
          <circle cx="76" cy="70" r="15" fill="#fff" />
          <circle cx="44" cy="70" r="6" fill="#0f172a" />
          <circle cx="76" cy="70" r="6" fill="#0f172a" />
          <circle cx="46" cy="68" r="2" fill="#fff" />
          <circle cx="78" cy="68" r="2" fill="#fff" />
          {mood === 'think' && (
            <line x1="32" y1="56" x2="56" y2="60" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
          )}
        </>
      )}
      <path d="M60 82 L54 90 L66 90 Z" fill="#fbbf24" />
      {mood === 'think' ? (
        <path d="M48 98 Q60 96 72 98" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M46 96 Q60 106 74 96" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      <rect x="30" y="30" width="60" height="14" rx="4" fill="#0f172a" />
      <rect x="52" y="16" width="16" height="16" rx="2" fill="#0f172a" />
      <path d="M28 108 Q20 126 26 142" stroke="#3b82f6" strokeWidth="8" fill="none" strokeLinecap="round" />
      <line x1="94" y1="110" x2="112" y2="84" stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" />
      <circle cx="112" cy="82" r="4" fill="#fbbf24" />
      <rect x="20" y="118" width="34" height="24" rx="3" fill="#0f172a" opacity="0.85" />
      <line x1="25" y1="126" x2="49" y2="126" stroke="#4ade80" strokeWidth="2.5" />
      <line x1="25" y1="132" x2="43" y2="132" stroke="#38bdf8" strokeWidth="2.5" />
      <rect x="42" y="140" width="12" height="16" rx="5" fill="#fbbf24" />
      <rect x="66" y="140" width="12" height="16" rx="5" fill="#fbbf24" />
    </svg>
  );
}
