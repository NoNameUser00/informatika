// Вырезка ключей для ученической офлайн-сборки (запуск из offline-build.mjs).
// - Удаляет полные (с ключами) checks-JSON: страницы грузят только *-public.json,
//   glob аналитики после этого видит только публичные;
// - В тренажёрных *-tasks.json вырезает поля ключей у каждого задания.
// Восстановление: git checkout -- src/data (все touched-файлы трекаются).
// lesson-play/* и tb-quiz.json НЕ трогаем осознанно: это разборные задания
// урока/ТБ с мгновенной самопроверкой (как ответы в конце учебника),
// не контрольные. Аудит (offline-audit.mjs) разрешает ключи только там.
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA = 'src/data';
const CHECKS = join(DATA, 'checks');
const KEY_FIELDS = ['key', 'correct', 'expected', 'answerMap'];

let stripped = 0;
let removed = 0;

// 1. Полные банки проверок — удалить (оставить *-public.json и manifest.json).
for (const f of readdirSync(CHECKS)) {
  if (!f.endsWith('.json') || f.endsWith('-public.json') || f === 'manifest.json') continue;
  rmSync(join(CHECKS, f));
  removed++;
}

// 2. Тренажёрные банки — вырезать ключи, остальное (тексты, варианты, шаблоны) оставить.
for (const f of readdirSync(DATA).filter((f) => f.endsWith('-tasks.json'))) {
  const p = join(DATA, f);
  const bank = JSON.parse(readFileSync(p, 'utf-8'));
  let touched = false;
  for (const t of bank.tasks ?? []) {
    for (const k of KEY_FIELDS) {
      if (k in t) {
        delete t[k];
        touched = true;
      }
    }
  }
  if (touched) {
    writeFileSync(p, JSON.stringify(bank, null, 2) + '\n');
    stripped++;
  }
}

// 3. Контроль: в публичных файлах ключей быть не должно.
const bad = [];
const scan = (dir) => {
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    if (!f.endsWith('-public.json') && dir === CHECKS) continue;
    if (!f.endsWith('-public.json') && !f.endsWith('-tasks.json')) continue;
    const bank = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
    for (const t of bank.tasks ?? bank.pool ?? []) {
      for (const k of KEY_FIELDS) {
        if (t && typeof t === 'object' && k in t) bad.push(`${f}:${t.id ?? '?'}:${k}`);
      }
    }
  }
};
scan(DATA);
scan(CHECKS);
if (bad.length) {
  console.error('КЛЮЧИ В ПУБЛИЧНЫХ ФАЙЛАХ:\n' + bad.join('\n'));
  process.exit(1);
}
console.log(`STRIP OK: удалено полных банков ${removed}, вычищено тренажёров ${stripped}, утечек 0`);
