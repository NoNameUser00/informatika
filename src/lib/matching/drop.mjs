// Чистая функция применения drop в matching-заданиях.
// ID перетаскиваемого: 'chip:<значение>' (из пула) или 'slot:<ключ>' (перенос назначенного).
// ID целей: 'drop:<ключ>' (слот слева) или 'pool' (возврат в пул).
// Возвращает новый map {слева: справа} или тот же объект, если ничего не изменилось.

export function parseDragId(id) {
  if (typeof id !== 'string') return null;
  const i = id.indexOf(':');
  if (i <= 0) return null;
  const kind = id.slice(0, i);
  const rest = id.slice(i + 1);
  if ((kind === 'chip' || kind === 'slot' || kind === 'drop') && rest === '') return null;
  if (kind === 'chip') return { kind, value: rest };
  if (kind === 'slot') return { kind, key: rest };
  if (kind === 'drop') return { kind, key: rest };
  if (kind === 'pool') return { kind };
  return null;
}

export function applyDrop(value, activeId, overId) {
  const base = value && typeof value === 'object' ? value : {};
  const a = parseDragId(activeId);
  const o = overId == null ? null : parseDragId(overId);
  if (!a || !o) return value;
  const moving = a.kind === 'chip' ? a.value : base[a.key];
  if (moving == null || moving === '') return value;
  if (o.kind === 'pool') {
    if (a.kind !== 'slot' || !(a.key in base)) return value;
    const next = { ...base };
    delete next[a.key];
    return next;
  }
  const next = { ...base };
  for (const k of Object.keys(next)) if (next[k] === moving) delete next[k];
  next[o.key] = moving;
  return next;
}
