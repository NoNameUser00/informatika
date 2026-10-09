import { useEffect, useMemo, useState } from 'react';
import { statsForWork, summary, MASTERY_LABEL } from '../lib/analytics/aggregate.mjs';
import { WORKS } from '../lib/analytics/works';
import { ERROR_REVIEW } from '../data/error-review';
import { LESSONS_7, LESSONS_8, LESSONS_9, LESSONS_10, LESSONS_11 } from '../data/lessons';

// Аналитика контрольных/проверочных для учителя.
// Что не освоено, по каким темам, сколько учеников, рекомендации куда вернуться.
// Графики — чистым CSS (без внешних библиотек). Только чтение журнала.
interface BankTask {
  id: string;
  type: string;
  prompt: string;
  lesson: string;
  points: number;
  key?: string;
  correct?: string;
  expected?: number;
  base?: number;
  answerMap?: Record<string, string>;
  options?: { id: string; text: string }[];
}

interface BankFile {
  test_code: string;
  max_score?: number;
  /** Плоский формат: тренажёры и старые работы. */
  tasks?: BankTask[];
  /** Новый формат работы: пул заданий + варианты. */
  pool?: BankTask[];
  variants?: Array<{ number: number; task_ids: string[]; max_score: number }>;
  page_size?: number;
  title?: string;
  grade?: string;
}

/**
 * Все задания работы в одном списке — для аналитики нужен полный набор,
 * а не набор одного варианта: сводка по темам считается по всему пулу.
 */
function allTasks(bank: BankFile): BankTask[] {
  if (bank.pool?.length) return bank.pool;
  return bank.tasks ?? [];
}

export interface AnalyticsRow {
  surname?: string;
  firstname?: string;
  class_name?: string;
  test_code: string;
  variant?: string;
  answers: Record<string, string>;
  percent?: number;
  proposed_mark?: number;
}

const LOCAL_MODS = import.meta.glob('../data/checks/*.json', { eager: true }) as Record<string, BankFile>;
// Полные банки с ключами — только для локальной разработки (в прод-бандл не попадают:
// import.meta.env.DEV вырезается на сборке вместе с веткой).
const LOCAL_BANKS: Record<string, BankFile> = {};
if (import.meta.env.DEV) {
  // Банки из checks-JSON — только в dev: в прод-бандл они не попадают.
  for (const [p, m] of Object.entries(LOCAL_MODS)) {
    if (p.endsWith('-public.json')) continue; // публичные копии без ключей — для страниц, не для аналитики
    LOCAL_BANKS[m.test_code] = m;
  }
}

/** Коды работ для фильтра: реестр + локальные банки + демо. */
function workCodes(): string[] {
  const out = new Set<string>(Object.keys(WORKS));
  for (const c of Object.keys(LOCAL_BANKS)) out.add(c);
  out.add(DEMO_BANK.test_code);
  return [...out];
}

// Фейковый мини-банк для демо-режима: настоящих ключей не содержит.
const DEMO_BANK: BankFile = {
  test_code: 'demo-control-v1',
  max_score: 6,
  tasks: [
    { id: 'demo-q1', type: 'single_choice', prompt: 'Демо-вопрос 1', lesson: 'numsys-02-binary', points: 2, key: 'A', correct: 'A', options: [{ id: 'A', text: 'Демо А' }, { id: 'B', text: 'Демо Б' }] },
    { id: 'demo-q2', type: 'single_choice', prompt: 'Демо-вопрос 2', lesson: 'numsys-03-octal', points: 2, key: 'B', correct: 'B', options: [{ id: 'A', text: 'Демо А' }, { id: 'B', text: 'Демо Б' }] },
    { id: 'demo-q3', type: 'single_choice', prompt: 'Демо-вопрос 3', lesson: 'numsys-04-hex', points: 2, key: 'A', correct: 'A', options: [{ id: 'A', text: 'Демо А' }, { id: 'B', text: 'Демо Б' }] },
  ],
};
const DEMO_META = { grade: '8', slug: 'control-ss', title: 'Демо: Системы счисления (данные выдуманы)' };

const TITLES = new Map(
  [...LESSONS_7, ...LESSONS_8, ...LESSONS_9, ...LESSONS_10, ...LESSONS_11].map((l) => [l.id, l.title]),
);

const GRADE_OF_LESSON: Record<string, string> = {};
for (const [g, arr] of [['7', LESSONS_7], ['8', LESSONS_8], ['9', LESSONS_9], ['10', LESSONS_10], ['11', LESSONS_11]] as const) {
  for (const l of arr) GRADE_OF_LESSON[l.id] = g;
}

interface TaskStat {
  id: string;
  prompt: string;
  lesson: string;
  points: number;
  n: number;
  correct: number;
  pct: number;
}

interface LessonStat {
  lesson: string;
  n: number;
  correct: number;
  questions: number;
  pct: number;
  level: 'ok' | 'shaky' | 'weak';
}

function barColor(pct: number): string {
  if (pct >= 75) return '#2e7d32';
  if (pct >= 50) return '#f9a825';
  return '#c62828';
}

function markFor(pct: number): number {
  if (pct >= 90) return 5;
  if (pct >= 75) return 4;
  if (pct >= 50) return 3;
  return 2;
}

/** Демо-класс: 12 учеников на фейковом мини-банке (настоящих ключей нет). */
function buildDemo(): AnalyticsRow[] {
  const bank = DEMO_BANK;
  const demoTasks = allTasks(bank);
  const max = bank.max_score ?? demoTasks.reduce((s, t) => s + t.points, 0);
  return Array.from({ length: 12 }, (_, si) => {
    const answers: Record<string, string> = {};
    let score = 0;
    for (const t of demoTasks) {
      // Демо-слабость: «восьмеричная» тема (q2) хромает у второй половины класса.
      const bad = t.id === 'demo-q2' ? si >= 5 : si >= 10;
      const a = bad ? 'B' === t.key ? 'A' : 'B' : String(t.key ?? '');
      answers[t.id] = a;
      if (!bad) score += t.points;
    }
    const percent = Math.round((score / max) * 1000) / 10;
    return {
      surname: `student_${String(si + 1).padStart(3, '0')}`, firstname: 'демо',
      class_name: '8А', test_code: DEMO_BANK.test_code, variant: 'demo',
      answers, percent, proposed_mark: markFor(percent),
    };
  });
}

async function fetchServerBank(code: string): Promise<BankFile | null> {
  try {
    const { getClient, getToken } = await import('../lib/auth/client');
    const c = getClient();
    if (!c) return null;
    const token = await getToken();
    if (!token) return null;
    const url = import.meta.env.PUBLIC_SUPABASE_URL as string;
    const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;
    const r = await fetch(`${url.replace(/\/$/, '')}/functions/v1/submit-attempt?test_code=${encodeURIComponent(code)}`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return (await r.json()) as BankFile;
  } catch {
    return null;
  }
}

export default function Analytics({ rows }: { rows: AnalyticsRow[] }) {
  const B = import.meta.env.BASE_URL;
  const [demo, setDemo] = useState(false);
  const [code, setCode] = useState('numsys-control-v1');
  const [cls, setCls] = useState('all');

  const all = useMemo(() => (demo ? buildDemo() : rows), [demo, rows]);
  // Фильтр работ: коды из ЖУРНАЛА (что реально сдавали), а не из локальных файлов.
  // Прежний вариант требовал наличия checks-JSON на машине — в проде список был пуст.
  const codes = useMemo(
    () => [...new Set(all.map((r) => r.test_code))].filter(
      (c) => WORKS[c] || c === DEMO_BANK.test_code,
    ),
    [all],
  );
  const cur = codes.includes(code) ? code : codes[0];
  const [serverBanks, setServerBanks] = useState<Record<string, BankFile>>({});
  useEffect(() => {
    if (!cur || cur === DEMO_BANK.test_code || serverBanks[cur] || LOCAL_BANKS[cur]) return;
    fetchServerBank(cur).then((b) => {
      if (b) setServerBanks((m) => ({ ...m, [cur]: b }));
    });
  }, [cur]);
  const bank = cur === DEMO_BANK.test_code ? DEMO_BANK : (serverBanks[cur] ?? LOCAL_BANKS[cur]);
  const meta = cur ? (WORKS[cur] ?? (cur === DEMO_BANK.test_code ? DEMO_META : undefined)) : undefined;
  const classes = useMemo(() => [...new Set(all.filter((r) => r.test_code === cur).map((r) => r.class_name ?? '—'))], [all, cur]);
  const sel = useMemo(
    () => all.filter((r) => r.test_code === cur && (cls === 'all' || (r.class_name ?? '—') === cls)),
    [all, cur, cls],
  );
  const st = useMemo(() => (bank ? statsForWork(sel, allTasks(bank)) : undefined), [sel, bank]);
  const sum = useMemo(() => summary(sel), [sel]);
  const review = useMemo(
    () => (meta ? ERROR_REVIEW.find((e) => e.slug === meta.slug.replace('proverka', 'control')) : undefined),
    [meta],
  );

  if (!bank || !st || !meta) {
    return (
      <div className="card">
        <h2>Аналитика работ</h2>
        <p className="muted">Пока нет сданных контрольных/проверочных в журнале{all.length ? '' : ' (и демо выключено)'}.</p>
        {!demo && (
          <p><button className="btn secondary" onClick={() => setDemo(true)}>Показать демо-класс</button></p>
        )}
      </div>
    );
  }

  const weak = st.perLesson.filter((L: LessonStat) => L.level !== 'ok');

  return (
    <div className="card">
      <h2>Аналитика работ</h2>
      <p className="muted">
        Что не освоено, по каким темам и сколькими учениками. Доля верных ответов:
        ≥75% — освоено, 50–75% — шатко, &lt;50% — не освоено.
        {demo && ' Показаны ДЕМО-данные (12 учеников 8А), реальные строки скрыты.'}
      </p>
      <p>
        <label>Работа:{' '}
          <select value={cur} onChange={(e) => { setCode(e.target.value); setCls('all'); }}>
            {codes.map((c) => (
              <option key={c} value={c}>{WORKS[c].grade} кл · {WORKS[c].title}</option>
            ))}
          </select>
        </label>{' '}
        <label>Класс:{' '}
          <select value={cls} onChange={(e) => setCls(e.target.value)}>
            <option value="all">Все ({sel.length})</option>
            {classes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>{' '}
        <a href={`${B}${meta.grade}/${meta.slug}/`}>Открыть работу →</a>{' '}
        <button className="btn secondary" onClick={() => setDemo(!demo)}>{demo ? 'Скрыть демо' : 'Демо-класс'}</button>{' '}
        <button className="btn secondary" onClick={() => window.print()}>Печать</button>
      </p>
      <p>
        Сдавших: <strong>{sum.students}</strong> · Средний процент: <strong>{sum.avgPercent}%</strong> ·
        Средняя отметка: <strong>{sum.avgMark}</strong> · Тем освоено: <strong>{st.perLesson.filter((L: LessonStat) => L.level === 'ok').length}/{st.perLesson.length}</strong>
      </p>
      <h3>По вопросам: как ответили (верно/отвечавших)</h3>
      {st.perTask.map((q: TaskStat, i: number) => (
        <div key={q.id} style={{ marginBottom: 6 }}>
          <div><strong>{i + 1}.</strong> {q.prompt.length > 90 ? q.prompt.slice(0, 90) + '…' : q.prompt}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flexGrow: 1, background: '#eee', borderRadius: 4 }}>
              <div style={{ width: `${q.pct}%`, background: barColor(q.pct), borderRadius: 4, color: '#fff', fontSize: 12, padding: '1px 6px' }}>
                {q.pct}%
              </div>
            </div>
            <span className="muted">{q.correct}/{q.n}</span>
          </div>
        </div>
      ))}
      <h3>По темам: что освоено</h3>
      {st.perLesson.map((L: LessonStat) => (
        <p key={L.lesson}>
          <span className={L.level === 'ok' ? '' : 'bad'}><strong>{MASTERY_LABEL[L.level]}</strong></span>
          {' '}— {TITLES.get(L.lesson) ?? L.lesson}: {L.correct}/{L.n} ({L.pct}%), вопросов {L.questions}{' '}
          <a href={`${B}${GRADE_OF_LESSON[L.lesson] ?? meta.grade}/${L.lesson}/`}>Вернуться к теме →</a>
        </p>
      ))}
      {weak.length > 0 && review && (
        <>
          <h3>Рекомендации: куда вернуться</h3>
          {review.traps.map((t, i) => (
            <p key={i}>→ {t.text} <a href={`${B}${t.grade}/${t.lessonId}/`}>Повторить: {TITLES.get(t.lessonId) ?? t.lessonId} →</a></p>
          ))}
        </>
      )}
    </div>
  );
}
