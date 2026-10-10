// Аудит ученической сборки: в дистрибутиве не должно быть ключей
// экзаменационных банков. Запуск: node scripts/offline-audit.mjs <dist>
// Правила:
// - teacher_only — нигде (маркер полных банков);
// - "answerMap": / "correct": / "expected": / "key": (после разэкранирования
//   HTML-сущностей) — только на formative-страницах: */tb/* (ТБ-викторина
//   с разбором) и */play/* (задания внутри уроков с самопроверкой).
//   Это осознанные исключения: ответы там — учебный разбор, не контрольные.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = process.argv[2] ?? 'dist-offline-student';
const MARKERS = ['teacher_only', '"answerMap":', '"correct":', '"expected":', '"key":'];
const ALLOW = /(^|\/)tb\/index\.html$|(^|\/)play\/[^/]+\/index\.html$/;

function unescape(s) {
  return s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
}

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p, []));
    else if (/\.(html|js|json)$/.test(f)) out.push(p);
  }
  return out;
}

const bad = [];
for (const fp of walk(DIST)) {
  const rel = relative(DIST, fp).replace(/\\/g, '/');
  if (ALLOW.test(rel)) continue;
  const s = unescape(readFileSync(fp, 'utf-8'));
  for (const m of MARKERS) {
    if (s.includes(m)) {
      bad.push(`${rel} :: ${m}`);
      break;
    }
  }
}
if (bad.length) {
  console.error('LEAK — ключи в ученической сборке:\n' + bad.join('\n'));
  process.exit(1);
}
console.log('AUDIT OK: ключей экзаменационных банков в сборке нет');
