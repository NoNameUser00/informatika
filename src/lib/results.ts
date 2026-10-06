// Сохранение результатов тестов/проверочных/контрольных.
// Фамилия + вопросы + ответы + ключи + баллы + отметка — в таблицу results (см. supabase/migrations).
// ПДн: храним минимум (фамилия, имя, класс), только с согласием (consent=true).
// Тихая сдача ученика (без ключей/баллов) — только локально, до серверной проверки.
import { buildQuietAttempt, quietStatus } from './attempts/quiet.mjs';
import { getClient, getToken } from './auth/client';

export interface ResultPayload {
  surname: string;
  firstname: string;
  class_name: string;
  test_type: 'trainer' | 'proverka' | 'practical' | 'control';
  test_code: string;
  variant: string;
  answers: Record<string, string>;
  keys: Record<string, string>;
  auto_score: number;
  max_score: number;
  percent: number;
  proposed_mark: number;
  consent: boolean;
  needs_review?: boolean;
  filename?: string;
}

const QUEUE_KEY = 'results-queue-v1';

function queueLocal(payload: ResultPayload): string {
  const raw = localStorage.getItem(QUEUE_KEY);
  const arr = raw ? (JSON.parse(raw) as ResultPayload[]) : [];
  arr.push({ ...payload, consent: true });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(arr));
  return `сохранено локально (очередь ${arr.length}), отправится при появлении базы`;
}

export async function saveResult(payload: ResultPayload): Promise<string> {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return queueLocal(payload);
  // Залогинен — пишем от своего имени (RLS: user_id = auth.uid()).
  const token = await getToken();
  let userId: string | null = null;
  try {
    const { data } = await (getClient()?.auth.getUser() ?? { data: { user: null } });
    userId = data.user?.id ?? null;
  } catch { /* гость */ }
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/results`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_id: userId,
      surname: payload.surname,
      firstname: payload.firstname,
      class_name: payload.class_name,
      test_type: payload.test_type,
      test_code: payload.test_code,
      variant: payload.variant,
      answers: payload.answers,
      keys: payload.keys,
      auto_score: payload.auto_score,
      max_score: payload.max_score,
      percent: payload.percent,
      proposed_mark: payload.proposed_mark,
      consent: payload.consent,
      needs_review: payload.needs_review ?? false,
      filename: payload.filename ?? '',
    }),
  });
  if (!res.ok) {
    queueLocal(payload);
    return 'база недоступна, сохранено локально';
  }
  return 'сохранено в базу журнала';
}

export function pendingCount(): number {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  } catch {
    return 0;
  }
}

// Тихая сдача ученика: ответы без ключей/баллов/отметок — ТОЛЬКО локально.
// Серверная проверка (Edge + банк в БД) ещё не подключена: выдумывать баллы
// в базу нельзя, поэтому отметку ставит учитель позже. Возвращает статус для UI.
export function saveQuietAttempt(args: {
  surname: string;
  firstname: string;
  className: string;
  testType: string;
  testCode: string;
  variant: string;
  tasks: { id: string; type: string; left?: string[] }[];
  answers: Record<string, string | Record<string, string>>;
}): string {
  const attempt = buildQuietAttempt({
    surname: args.surname,
    firstname: args.firstname,
    className: args.className,
    testType: args.testType,
    testCode: args.testCode,
    variant: args.variant,
    tasks: args.tasks,
    answers: args.answers,
  });
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown[]) : [];
    arr.push({ ...attempt, consent: true, quiet: true });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(arr));
  } catch {
    return 'Не удалось сохранить даже локально — ответы потеряются при закрытии.';
  }
  return quietStatus(attempt);
}
