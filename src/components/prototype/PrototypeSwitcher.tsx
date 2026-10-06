// PROTOTYPE (throwaway): плавающая переключалка вариантов ?variant=.
// Намеренно визуально чужеродная (тёмная пилюля), в дизайне не участвует.
import { useCallback, useEffect, useState } from 'react';

export interface VariantDef {
  key: string;
  name: string;
}

/** Корень прототипа: держит текущий вариант, синхронизирован с ?variant=. */
export function useVariant(keys: string[]): [string, (next: string) => void] {
  const [current, setCurrent] = useState(keys[0]);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('variant');
    if (q && keys.includes(q)) setCurrent(q);
  }, []);
  const go = useCallback(
    (next: string) => {
      setCurrent(next);
      const u = new URL(window.location.href);
      u.searchParams.set('variant', next);
      window.history.replaceState(null, '', u.toString());
    },
    [],
  );
  return [current, go];
}

export default function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: {
  variants: VariantDef[];
  current: string;
  onChange: (next: string) => void;
}) {
  const idx = Math.max(0, variants.findIndex((v) => v.key === current));
  const step = useCallback(
    (d: number) => {
      onChange(variants[(idx + d + variants.length) % variants.length].key);
    },
    [idx, variants, onChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  return (
    <div className="px-switcher" role="toolbar" aria-label="Переключение вариантов прототипа">
      <span className="px-tag" title="Throwaway-прототип, не прод">PROTO</span>
      <button type="button" className="px-arrow" onClick={() => step(-1)} aria-label="Предыдущий вариант">
        ←
      </button>
      <button
        type="button"
        className="px-label"
        onClick={() => step(1)}
        title="Клик — следующий вариант (или стрелки ← →)"
      >
        {variants[idx].key.toUpperCase()} · {variants[idx].name}
      </button>
      <span className="px-dots" aria-hidden="true">
        {variants.map((v) => (
          <i key={v.key} className={v.key === current ? 'on' : ''} />
        ))}
      </span>
      <button type="button" className="px-arrow" onClick={() => step(1)} aria-label="Следующий вариант">
        →
      </button>
    </div>
  );
}
