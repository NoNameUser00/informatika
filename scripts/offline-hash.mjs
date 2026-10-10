// Хэши работ для офлайн-обмена: файл ответов ученика несёт bank_hash,
// учительская сборка сверяет его со своим банком. Разошёлся — файл от
// другой версии работы, проверять нельзя.
// Запуск: node scripts/offline-hash.mjs (перезаписывает src/data/offline-hashes.json)
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA = 'src/data';
const OUT = join(DATA, 'offline-hashes.json');

function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

// Только поля, видимые ученику: идентификацию работы, а не ключи.
function publicView(bank) {
  const pickTask = (t) => ({
    id: t.id, type: t.type, points: t.points, prompt: t.prompt,
    base: t.base ?? null, options: t.options ?? null,
    left: t.left ?? null, right: t.right ?? null,
    template: t.template ?? null,
  });
  if (Array.isArray(bank.pool)) {
    return {
      test_code: bank.test_code,
      pool: bank.pool.map(pickTask),
      variants: (bank.variants ?? []).map((v) => ({ number: v.number, task_ids: v.task_ids, orders: v.orders ?? null })),
    };
  }
  return { test_code: bank.test_code, tasks: (bank.tasks ?? []).map(pickTask) };
}

const hashes = {};
const files = readdirSync(join(DATA, 'checks')).filter((f) => f.endsWith('.json') && !f.endsWith('-public.json') && f !== 'manifest.json');
for (const f of files) {
  const bank = JSON.parse(readFileSync(join(DATA, 'checks', f), 'utf-8'));
  if (!bank.test_code) throw new Error(`нет test_code: ${f}`);
  hashes[bank.test_code] = createHash('sha1').update(canon(publicView(bank))).digest('hex').slice(0, 10);
}
for (const f of readdirSync(DATA).filter((f) => f.endsWith('-tasks.json'))) {
  const bank = JSON.parse(readFileSync(join(DATA, f), 'utf-8'));
  if (!bank.test_code) throw new Error(`нет test_code: ${f}`);
  if (hashes[bank.test_code] && hashes[bank.test_code] !== createHash('sha1').update(canon(publicView(bank))).digest('hex').slice(0, 10)) {
    throw new Error(`дубль test_code с разным содержимым: ${bank.test_code} (${f})`);
  }
  hashes[bank.test_code] = createHash('sha1').update(canon(publicView(bank))).digest('hex').slice(0, 10);
}
writeFileSync(OUT, JSON.stringify(hashes, null, 2) + '\n');
console.log(`HASH OK: работ ${Object.keys(hashes).length} -> ${OUT}`);
