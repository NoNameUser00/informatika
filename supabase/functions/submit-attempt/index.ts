// Edge Function: прием попытки, СЕРВЕРНАЯ проверка, запись в results.
// Ключи ученику не возвращаются и во фронтенд не вшиты.
//
// Пилотный статус:
// - банк вариантов грузится из таблицы test_banks (Этап 3, еще не создана) —
//   пока ее нет, функция отвечает 501;
// - тренажер/практика считают баллы в клиенте (допустимо: ответы не секретны);
// - проверочная/контрольная ОБЯЗАНЫ идти только сюда после загрузки банка в БД.
//
// Проверка — те же правила, что src/lib/scoring/check.mjs (single source там;
// здесь копия для Deno-рантайма, паритет покрыть тестом при подключении банка).
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const CYR: Record<string, string> = { 'А': 'A', 'В': 'B', 'С': 'C', 'Д': 'D', 'Е': 'E', 'Ф': 'F', 'Ё': 'E' };
const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
const ALPHA = '0123456789ABCDEF';

function norm(s: unknown): string {
  if (typeof s !== 'string') return '';
  let t = s.trim().replace(/\s+/g, '');
  t = t.replace(/[₀₁₂₃₄₅₆₇₈₉]+$/, '');
  t = t.split('').map((ch) => SUB[ch] ?? CYR[ch] ?? ch).join('');
  t = t.toUpperCase().replace(/^0(B|O|X)/, '');
  const suf = t.match(/^(.*?)(?:_(2|8|10|16)|\((2|8|10|16)\))$/);
  if (suf) t = suf[1];
  return t.replace(/_/g, '');
}

function parseBase(input: string, base: number): number {
  const t = norm(input);
  if (!t) return NaN;
  const valid = ALPHA.slice(0, base);
  let v = 0;
  for (const ch of t) {
    const i = valid.indexOf(ch);
    if (i < 0) return NaN;
    v = v * base + i;
  }
  return v;
}

function toMark(p: number): number {
  if (p >= 90) return 5;
  if (p >= 75) return 4;
  if (p >= 50) return 3;
  return 2;
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 });
  }
  const { surname, firstname, class_name, test_type, test_code, variant, answers, consent } = body as Record<string, never>;
  if (!surname || !firstname || !class_name || !answers || consent !== true) {
    return Response.json({ error: 'surname, firstname, class_name, answers, consent=true required' }, { status: 400 });
  }
  if (test_type !== 'proverka' && test_type !== 'control') {
    return Response.json({ error: 'edge check only for proverka/control; trainer counts client-side' }, { status: 400 });
  }
  // TODO(Этап 3): загрузить снапшот варианта + ключи из test_banks по (test_code, variant).
  const bank = null;
  if (!bank) {
    return Response.json({ error: 'bank not loaded: создайте test_banks (Этап 3)' }, { status: 501 });
  }
  void test_code;
  void variant;
  void parseBase;
  void toMark;
  return Response.json({ error: 'unreachable' }, { status: 500 });
});
