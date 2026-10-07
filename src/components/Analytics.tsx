import { useMemo, useState } from 'react';
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
  max_score: number;
  tasks: BankTask[];
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

const BANKS = import.meta.glob('../data/checks/*.json', { eager: true }) as Record<string, BankFile>;
const BY_CODE: Record<string, BankFile> = {};
for (const m of Object.values(BANKS)) BY_CODE[m.test_code] = m;

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

/** Неверный, но правдоподобный ответ для демо-данных. */
function wrongFor(t: BankTask, i: number): string {
  if (t.options?.length) return (t.options.find((o) => o.id !== t.key) ?? t.options[0]).id;
  const n = Number(String(t.key ?? '').replace(',', '.'));
  if (String(t.key ?? '').trim() !== '' && Number.isFinite(n)) return String(n + 1 + (i % 3));
  return `${t.key ?? ''}0`;
}

function markFor(pct: number): number {
  if (pct >= 90) return 5;
  if (pct >= 75) return 4;
  if (pct >= 50) return 3;
  return 2;
}

/** Демо-класс: 12 учеников, слабые места — 16СС и арифметика (как в жизни). */
function buildDemo(): AnalyticsRow[] {
  const bank = BY_CODE['numsys-control-v1'];
  if (!bank) return [];
  const weakFrom: Record<string, number> = {
    'numsys-04-hex': 4, 'numsys-05-arith': 7, 'numsys-06-review': 8, 'numsys-03-octal': 9,
  };
  return Array.from({ length: 12 }, (_, si) => {
    const answers: Record<string, string> = {};
    let score = 0;
    for (const t of bank.tasks) {
      const bad = si >= (weakFrom[t.lesson] ?? 10);
      const a = bad ? wrongFor(t, si) : String(t.key ?? '');
      answers[t.id] = a;
      if (!bad) score += t.points;
    }
    const percent = Math.round((score / bank.max_score) * 1000) / 10;
    return {
      surname: `student_${String(si + 1).padStart(3, '0')}`, firstname: 'демо',
      class_name: '8А', test_code: 'numsys-control-v1', variant: 'demo',
      answers, percent, proposed_mark: markFor(percent),
    };
  });
}

export default function Analytics({ rows }: { rows: AnalyticsRow[] }) {
  const B = import.meta.env.BASE_URL;
  const [demo, setDemo] = useState(false);
  const [code, setCode] = useState('numsys-control-v1');
  const [cls, setCls] = useState('all');

  const all = useMemo(() => (demo ? buildDemo() : rows), [demo, rows]);
  const codes = useMemo(() => [...new Set(all.map((r) => r.test_code))].filter((c) => BY_CODE[c] && WORKS[c]), [all]);
  const cur = codes.includes(code) ? code : codes[0];
  const bank = cur ? BY_CODE[cur] : undefined;
  const meta = cur ? WORKS[cur] : undefined;
  const classes = useMemo(() => [...new Set(all.filter((r) => r.test_code === cur).map((r) => r.class_name ?? '—'))], [all, cur]);
  const sel = useMemo(
    () => all.filter((r) => r.test_code === cur && (cls === 'all' || (r.class_name ?? '—') === cls)),
    [all, cur, cls],
  );
  const st = useMemo(() => (bank ? statsForWork(sel, bank.tasks) : undefined), [sel, bank]);
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
