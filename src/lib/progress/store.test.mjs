import { KEY, createStore } from './store.mjs';

let n = 0;
function eq(name, got, want) {
  n++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) {
    console.error(`FAIL ${name}: got ${a}, want ${b}`);
    process.exitCode = 1;
  } else console.log(`ok ${n} ${name}`);
}

function stub() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    _raw: (k) => m.get(k),
    _setRaw: (k, v) => m.set(k, v),
  };
}

const s = createStore(stub());
eq('empty read', s.read(), null);

s.record({ grade: '8', lesson: 'numsys-02-binary', title: 'Двоичная система', href: '/x' });
const v = s.read();
eq('title kept', v.title, 'Двоичная система');
eq('href kept', v.href, '/x');
eq('grade kept', v.grade, '8');
eq('has at', typeof v.at, 'number');

s.record({ grade: '8', lesson: 'tb', title: 'ТБ', href: '/y' });
eq('overwrite', s.read().href, '/y');

s.clear();
eq('clear', s.read(), null);

const bad = stub();
bad._setRaw(KEY, 'not-json{{{');
eq('bad json', createStore(bad).read(), null);

const incomplete = stub();
incomplete._setRaw(KEY, JSON.stringify({ title: 'без href' }));
eq('missing href', createStore(incomplete).read(), null);

const throwing = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
  removeItem: () => {
    throw new Error('denied');
  },
};
const t = createStore(throwing);
t.record({ title: 'x', href: '/x' });
eq('throwing store safe', t.read(), null);
