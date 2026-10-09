// Выбор варианта работы на клиенте и сборка списка вопросов этого варианта.
//
// Работа приходит одним файлом: пул заданий + 30 вариантов (какие задания в каком
// порядке + перестановка вариантов ответа). Ключей в публичной копии нет.
//
// Номер варианта выбирается детерминированно от ФИО: ученик при повторном заходе
// получает тот же вариант, а внутри класса варианты расходятся. Учитель может
// задать вариант явно ссылкой ?v=7.
import { fnv1a } from './generator.mjs';

/** @typedef {{ number: number, task_ids: string[], orders?: Record<string, { options?: string[], right?: string[] }>, max_score: number }} Variant */
/** @typedef {{ test_code: string, variant_count: number, pool: any[], variants: Variant[] }} WorkData */

/** @param {string | null | undefined} raw @returns {number | null} */
function parseRequested(raw) {
  if (raw == null || raw === '') return null;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

/**
 * Номер варианта: явный ?v= важнее, иначе детерминированно от seedText.
 * @param {number} count @param {string | null | undefined} requested @param {string} seedText
 */
export function pickVariantNumber(count, requested, seedText) {
  if (!Number.isInteger(count) || count < 1) return 1;
  const asked = parseRequested(requested);
  if (asked !== null) {
    if (asked < 1 || asked > count) return ((asked - 1) % count + count) % count + 1;
    return asked;
  }
  const text = seedText.trim().toLowerCase();
  if (!text) return 1;
  return (fnv1a(text) % count) + 1;
}

/** @param {WorkData} data @param {number} number @returns {Variant} */
export function findVariant(data, number) {
  const v = data.variants.find((x) => x.number === number);
  if (v) return v;
  const fallback = data.variants[0];
  if (!fallback) throw new Error('В работе нет ни одного варианта');
  return fallback;
}

/**
 * Собирает вопросы варианта в порядке варианта, применяя перестановку
 * вариантов ответа. Ключи из пула не трогаются: порядок косметический,
 * ученик отвечает id (A/B/C/D или значение), а не позицией.
 */
/** @param {WorkData} data @param {Variant} variant @returns {any[]} */
export function materialize(data, variant) {
  const byId = new Map(data.pool.map((t) => [t.id, t]));
  const out = [];
  for (const id of variant.task_ids) {
    const t = byId.get(id);
    if (!t) continue;
    const ord = variant.orders?.[id];
    if (!ord) {
      out.push(t);
      continue;
    }
    if (ord.options && t.options) {
      out.push({ ...t, options: ord.options.map((oid) => t.options.find((o) => o.id === oid)).filter(Boolean) });
    } else if (ord.right && t.right) {
      out.push({ ...t, right: ord.right });
    } else {
      out.push(t);
    }
  }
  return out;
}

/** Всё вместе: номер -> вариант -> вопросы. */
/**
 * Всё вместе: номер -> вариант -> вопросы.
 * @param {WorkData} data
 * @param {{ requested?: string | null, seedText?: string }} [opts]
 */
export function resolveWork(data, opts = {}) {
  const count = data.variant_count ?? data.variants?.length ?? 1;
  const number = pickVariantNumber(count, opts.requested, opts.seedText ?? '');
  const variant = findVariant(data, number);
  return { number, variant, tasks: materialize(data, variant) };
}
