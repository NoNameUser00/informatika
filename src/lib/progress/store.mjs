// Хранилище «где остановился»: последний открытый урок (только этот браузер).
// Чистые функции поверх Storage — тестируются с in-memory стабом.

export const KEY = 'inf-last-lesson-v1';

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
