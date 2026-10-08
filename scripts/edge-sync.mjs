// Синхронизация бандла Edge Function submit-attempt с single source репозитория.
// Копирует БАЙТ-В-байт (проверяется тестом edge-sync.test.mjs):
// - src/lib/scoring/check.mjs + src/lib/analytics/aggregate.mjs -> vendor/ (та же относительная структура,
//   чтобы import '../scoring/check.mjs' внутри aggregate.mjs не ломался);
// - ПОЛНЫЕ checks-JSON (с ключами, только для сервера!) -> vendor/bank/ (*-public.json не копируются).
// Запуск: npm run edge:sync (перед supabase functions deploy).
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'supabase', 'functions', 'submit-attempt', 'vendor');

function copy(src, dst) {
  const full = join(VENDOR, dst);
  mkdirSync(dirname(full), { recursive: true });
  copyFileSync(join(ROOT, src), full);
  console.log(`SYNC: ${src} -> vendor/${dst}`);
}

copy('src/lib/scoring/check.mjs', 'src/lib/scoring/check.mjs');
copy('src/lib/analytics/aggregate.mjs', 'src/lib/analytics/aggregate.mjs');

mkdirSync(join(VENDOR, 'bank'), { recursive: true });
let n = 0;
for (const f of readdirSync(join(ROOT, 'src', 'data', 'checks'))) {
  if (!f.endsWith('.json') || f.endsWith('-public.json')) continue;
  copy(join('src', 'data', 'checks', f), join('bank', f));
  n++;
}
console.log(`SYNC: bank JSON с ключами (только сервер): ${n} файлов`);
