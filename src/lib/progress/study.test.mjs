import { createStudyStore, normGroup } from './store.mjs';

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
    _setRaw: (k, v) => m.set(k, v),
  };
}

// normGroup
eq('letter', normGroup('8', 'а'), '8А');
eq('full', normGroup('8', '8б'), '8Б');
eq('latin', normGroup('10', 'B'), '10B');
eq('bad empty', normGroup('8', ''), null);
eq('bad long', normGroup('8', 'АБ'), null);
eq('bad other grade', normGroup('8', '9А'), null);

const s = createStudyStore(stub());
eq('fresh grade', s.readGrade('8'), { started: false, groups: [], active: '', pos: {} });

// start без групп: started + дефолтная группа
const g0 = s.start('8');
eq('started', g0.started, true);
eq('default group', g0.groups, ['8']);
eq('active default', g0.active, '8');

// группы
eq('add A', s.addGroup('8', 'А').name, '8А');
eq('add dup', s.addGroup('8', '8а').name, '8А');
eq('groups list', s.readGrade('8').groups, ['8', '8А']);
eq('add bad', s.addGroup('8', '??').ok, false);
eq('set active', s.setActive('8', '8А'), true);
eq('active is', s.readGrade('8').active, '8А');
eq('set active bad', s.setActive('8', '9А'), false);

// запись урока — в активную группу
s.recordLesson('8', { lesson: 'x', title: 'T', href: '/x' });
eq('pos active', s.readGrade('8').pos['8А'].title, 'T');
s.setActive('8', '8');
s.recordLesson('8', { lesson: 'y', title: 'T2', href: '/y' });
eq('pos other kept', s.readGrade('8').pos['8А'].title, 'T');
eq('pos new', s.readGrade('8').pos['8'].title, 'T2');

// удаление группы
s.removeGroup('8', '8А');
eq('removed', s.readGrade('8').groups, ['8']);
eq('pos cleaned', '8А' in s.readGrade('8').pos, false);

// запись в новый класс без start: не падает, started=false
s.recordLesson('9', { lesson: 'z', title: 'T9', href: '/z' });
eq('no start flag', s.readGrade('9').started, false);
eq('pos recorded', s.readGrade('9').pos['9'].title, 'T9');

// битый JSON
const bad = stub();
bad._setRaw('inf-study-v1', 'not-json{{{');
eq('bad json safe', createStudyStore(bad).readGrade('8').started, false);

console.log('study store: all ok');
