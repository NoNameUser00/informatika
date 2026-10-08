// Тест: vendor-копии Edge Function байт-идентичны канону (single source).
// Расхождение = забыли npm run edge:sync. Запуск: node scripts/edge-sync.test.mjs
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'supabase', 'functions', 'submit-attempt', 'vendor');

function same(rel) {
  const a = join(ROOT, rel);
  const b = join(VENDOR, rel);
  assert.ok(existsSync(b), `нет vendor-копии ${rel}: запусти npm run edge:sync`);
  assert.equal(readFileSync(b, 'utf-8'), readFileSync(a, 'utf-8'), `расходится ${rel}`);
}

same(join('src', 'lib', 'scoring', 'check.mjs'));
same(join('src', 'lib', 'analytics', 'aggregate.mjs'));

function sameBank(f) {
  const a = join(ROOT, 'src', 'data', 'checks', f);
  const b = join(VENDOR, 'bank', f);
  assert.ok(existsSync(b), `нет vendor/bank/${f}: запусти npm run edge:sync`);
  assert.equal(readFileSync(b, 'utf-8'), readFileSync(a, 'utf-8'), `расходится bank/${f}`);
}

const bankDir = join(VENDOR, 'bank');
assert.ok(existsSync(bankDir), 'нет vendor/bank: запусти npm run edge:sync');
const full = readdirSync(join(ROOT, 'src', 'data', 'checks'))
  .filter((f) => f.endsWith('.json') && !f.endsWith('-public.json'));
assert.deepEqual(readdirSync(bankDir).sort(), full.sort(), 'состав vendor/bank != checks');
for (const f of full) sameBank(f);
// В vendor не должно быть публичных копий без ключей.
assert.ok(!readdirSync(bankDir).some((f) => f.endsWith('-public.json')), 'лишний -public в vendor/bank');

console.log(`edge-sync: паритет ok (2 модуля + ${full.length} банков)`);
