import { useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragCancelEvent, DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { applyDrop } from '../lib/matching/drop.mjs';

// Соответствия: dnd-kit (мышь + тач + клавиатура) + tap-to-select как запасной путь.
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastDragEnd = useRef(0);
  const used = new Set(Object.values(value ?? {}));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const labelOf = (id: string): string => {
    if (id.startsWith('chip:')) return id.slice(5);
    if (id.startsWith('slot:')) return `${id.slice(5)}: ${(value ?? {})[id.slice(5)] ?? '?'}`;
    if (id.startsWith('drop:')) return `поле «${id.slice(5)}»`;
    return 'пул вариантов';
  };

  function assign(k: string, chip: string) {
    onChange(applyDrop(value ?? {}, `chip:${chip}`, `drop:${k}`) as Record<string, string>);
    setSelected(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements: {
          onDragStart: ({ active }: DragStartEvent) => `Взят вариант ${labelOf(String(active.id))}.`,
          onDragOver: ({ over }: DragOverEvent) => (over ? `Над ${labelOf(String(over.id))}.` : 'Вне полей.'),
          onDragEnd: ({ over }: DragEndEvent) => (over ? `Положено: ${labelOf(String(over.id))}.` : 'Возвращено обратно.'),
          onDragCancel: (_e: DragCancelEvent) => 'Перетаскивание отменено.',
        },
      }}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={(e) => {
        lastDragEnd.current = Date.now();
        setActiveId(null);
        const next = applyDrop(value ?? {}, String(e.active.id), e.over ? String(e.over.id) : null);
        if (next !== value) onChange(next as Record<string, string>);
        setSelected(null);
      }}
      onDragCancel={() => setActiveId(null)}
    >
      <p className="muted">Перетащи вариант в поле, двигай стрелками с пробелом или нажми вариант, затем поле.</p>
      {left.map((k) => (
        <Slot key={k} id={`drop:${k}`} label={k} filled={(value ?? {})[k] ?? null} selected={selected} assign={assign} />
      ))}
      <Pool ids={right.filter((r) => !used.has(r))} selected={selected} setSelected={setSelected} guard={lastDragEnd} />
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
      <DragOverlay dropAnimation={null}>
        {activeId ? (
          <div className="btn" style={{ width: 'auto', cursor: 'grabbing' }}>
            {activeId.startsWith('chip:') ? activeId.slice(5) : (value ?? {})[activeId.slice(5)]}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Slot({
  id,
  label,
  filled,
  selected,
  assign,
}: {
  id: string;
  label: string;
  filled: string | null;
  selected: string | null;
  assign: (k: string, chip: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const key = id.slice(5);
  return (
    <div
      ref={setNodeRef}
      role="listbox"
      aria-label={`Куда: ${label}${filled ? `, сейчас: ${filled}` : ''}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && selected) {
          e.preventDefault();
          assign(key, selected);
        }
      }}
      onClick={() => {
        if (selected) assign(key, selected);
      }}
      style={{
        border: `2px ${isOver ? 'solid #2563eb' : 'dashed #94a3b8'}`,
        borderRadius: 12,
        padding: 10,
        margin: '8px 0',
        minHeight: 52,
        background: filled ? '#eff6ff' : isOver ? '#dbeafe' : '#f8fafc',
        cursor: selected ? 'copy' : 'default',
      }}
    >
      <strong>{label} → </strong>
      {filled ? (
        <Chip id={`slot:${key}`} label={filled} />
      ) : (
        <span className="muted">{selected ? 'нажми, чтобы положить сюда' : 'перетащи сюда или выбери ниже'}</span>
      )}
    </div>
  );
}

function Pool({
  ids,
  selected,
  setSelected,
  guard,
}: {
  ids: string[];
  selected: string | null;
  setSelected: (v: string | null) => void;
  guard: React.MutableRefObject<number>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' });
  return (
    <div
      ref={setNodeRef}
      role="listbox"
      aria-label="Варианты"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
        padding: 4,
        borderRadius: 8,
        outline: isOver ? '2px solid #2563eb' : 'none',
      }}
    >
      {ids.map((r) => (
        <Chip
          key={r}
          id={`chip:${r}`}
          label={r}
          pressed={selected === r}
          onTap={() => {
            if (Date.now() - guard.current < 300) return; // только что был drag — клик не нужен
            setSelected(selected === r ? null : r);
          }}
        />
      ))}
    </div>
  );
}

function Chip({
  id,
  label,
  pressed,
  onTap,
}: {
  id: string;
  label: string;
  pressed?: boolean;
  onTap?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const { 'aria-pressed': _dndPressed, ...restAttributes } = attributes;
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={pressed ? 'btn' : 'btn secondary'}
      style={{
        width: 'auto',
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.3 : 1,
        cursor: 'grab',
        touchAction: 'none',
      }}
      aria-pressed={pressed ?? (_dndPressed as boolean | undefined)}
      onClick={onTap}
      {...listeners}
      {...restAttributes}
    >
      {label}
    </button>
  );
}
