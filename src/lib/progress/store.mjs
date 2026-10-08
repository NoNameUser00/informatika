// Хранилище «где остановился»: последний открытый урок (только этот браузер).
// Чистые функции поверх Storage — тестируются с in-memory стабом.

export const KEY = 'inf-last-lesson-v1';
export const STUDY_KEY = 'inf-study-v1';

export function createStore(storage) {
  return {
    record(entry) {
      try {
        storage.setItem(KEY, JSON.stringify({ ...entry, at: Date.now() }));
      } catch {
        /* приватный режим и т.п. — молча пропускаем */
      }
    },
    read() {
      try {
        const raw = storage.getItem(KEY);
        if (!raw) return null;
        const v = JSON.parse(raw);
        if (!v || typeof v.href !== 'string' || typeof v.title !== 'string') return null;
        return v;
      } catch {
        return null;
      }
    },
    clear() {
      try {
        storage.removeItem(KEY);
      } catch {
        /* ignore */
      }
    },
  };
}

const memory = new Map();
const memoryStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => void memory.set(k, String(v)),
  removeItem: (k) => void memory.delete(k),
};

export const progressStore =
  typeof localStorage !== 'undefined' ? createStore(localStorage) : createStore(memoryStorage);

// Учёба по классам: «Начать учиться» / «Продолжить» + группы с буквами (8А, 8Б…).
// Форма: { [grade]: { started, groups: string[], active: string, pos: { [group]: entry } } }.
function blankGrade() {
  return { started: false, groups: [], active: '', pos: {} };
}

/** Нормализация группы: «а»/«8а» -> «8А» для класса 8. Иначе null. */
export function normGroup(grade, raw) {
  const t = String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^[А-ЯЁA-Z]$/.test(t)) return `${grade}${t}`;
  if (new RegExp(`^${grade}[А-ЯЁA-Z]$`).test(t)) return t;
  return null;
}

export function createStudyStore(storage) {
  function load() {
    try {
      const raw = storage.getItem(STUDY_KEY);
      if (!raw) return {};
      const v = JSON.parse(raw);
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  }
  function save(all) {
    try {
      storage.setItem(STUDY_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }
  function gradeOf(all, grade) {
    const g = all[grade];
    if (!g || typeof g !== 'object') return blankGrade();
    return {
      started: g.started === true,
      groups: Array.isArray(g.groups) ? g.groups.filter((x) => typeof x === 'string') : [],
      active: typeof g.active === 'string' ? g.active : '',
      pos: g.pos && typeof g.pos === 'object' ? g.pos : {},
    };
  }
  return {
    readGrade(grade) {
      return gradeOf(load(), grade);
    },
    start(grade) {
      const all = load();
      const g = gradeOf(all, grade);
      g.started = true;
      if (g.groups.length === 0) {
        g.groups = [`${grade}`];
        g.active = `${grade}`;
      } else if (!g.groups.includes(g.active)) {
        g.active = g.groups[0];
      }
      all[grade] = g;
      save(all);
      return g;
    },
    addGroup(grade, raw) {
      const name = normGroup(grade, raw);
      if (!name) return { ok: false, error: 'Буква класса: одна буква, напр. А' };
      const all = load();
      const g = gradeOf(all, grade);
      if (!g.groups.includes(name)) g.groups.push(name);
      if (!g.active) g.active = name;
      all[grade] = g;
      save(all);
      return { ok: true, name };
    },
    setActive(grade, group) {
      const all = load();
      const g = gradeOf(all, grade);
      if (!g.groups.includes(group)) return false;
      g.active = group;
      all[grade] = g;
      save(all);
      return true;
    },
    removeGroup(grade, group) {
      const all = load();
      const g = gradeOf(all, grade);
      g.groups = g.groups.filter((x) => x !== group);
      delete g.pos[group];
      if (g.active === group) g.active = g.groups[0] ?? '';
      all[grade] = g;
      save(all);
      return true;
    },
    recordLesson(grade, entry) {
      const all = load();
      const g = gradeOf(all, grade);
      const target = g.groups.includes(g.active) ? g.active : (g.groups[0] ?? `${grade}`);
      if (!g.groups.includes(target)) {
        g.groups.push(target);
        if (!g.active) g.active = target;
      }
      g.pos[target] = { ...entry, at: Date.now() };
      all[grade] = g;
      save(all);
    },
  };
}

export const studyStore =
  typeof localStorage !== 'undefined' ? createStudyStore(localStorage) : createStudyStore(memoryStorage);
