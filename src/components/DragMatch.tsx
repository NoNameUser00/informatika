import { useState } from 'react';

// Перетаскивание соответствий: HTML5 DnD + tap-to-select (тач и клавиатура).
// value: {слева: выбранное справа}. onChange — наружу для проверки.
export default function DragMatch({
  left,
  right,
  value,
  onChange,
}: {
  left: string[];
  right: string[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const used = new Set(Object.values(value));

  function assign(k: string, chip: string) {
    const next = { ...value };
    for (const key of Object.keys(next)) if (next[key] === chip) delete next[key];
    next[k] = chip;
    onChange(next);
    setSelected(null);
  }

  return (
    <div>
      {left.map((k) => (
        <div
          key={k}
          role="listbox"
          aria-label={`Куда: ${k}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && selected) {
              e.preventDefault();
              assign(k, selected);
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const chip = e.dataTransfer.getData('text/plain');
            if (chip) assign(k, chip);
          }}
          onClick={() => {
            if (selected) assign(k, selected);
          }}
          style={{
            border: '2px dashed #94a3b8',
            borderRadius: 12,
            padding: 10,
            margin: '8px 0',
            minHeight: 52,
            background: value[k] ? '#eff6ff' : '#f8fafc',
            cursor: selected ? 'copy' : 'default',
          }}
        >
          <strong>{k} → </strong>
          {value[k] ?? <span className="muted">{selected ? 'нажми, чтобы положить сюда' : 'перетащи сюда или выбери ниже'}</span>}
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }} role="listbox" aria-label="Варианты">
        {right
          .filter((r) => !used.has(r))
          .map((r) => (
            <button
              key={r}
              type="button"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', r)}
              onClick={() => setSelected(selected === r ? null : r)}
              className={selected === r ? 'btn' : 'btn secondary'}
              style={{ width: 'auto' }}
              aria-pressed={selected === r}
            >
              {r}
            </button>
          ))}
      </div>
      <div>
        <button
          type="button"
          className="btn secondary"
          style={{ width: 'auto', marginTop: 8 }}
          onClick={() => {
            onChange({});
            setSelected(null);
          }}
        >
          Сбросить
        </button>
      </div>
    </div>
  );
}
