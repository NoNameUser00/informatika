// Плеер 45-минутного урока: шаги теория → ключевое (записать) →
// пошаговый пример → задание → итог. Проверка — те же чистые функции,
// что в тренажёре (нормализация ё/е, пробелов, префиксов).
import { useMemo, useState } from 'react';
import { checkNumericBase, checkSingleChoice } from '../lib/scoring/check.mjs';
import type { PlayLesson, PlayStep } from '../data/lesson-play/registry';
import Mascot, { type MascotMood } from './Mascot';

const PHASE_TIP: Record<string, { text: string; mood: MascotMood }> = {
  theory: { text: 'Читаем внимательно — дальше спрошу!', mood: 'happy' },
  key: { text: 'Это в тетрадь! Без галочки дальше не пущу.', mood: 'think' },
  example: { text: 'Открывай шаги по одному, не подглядывай.', mood: 'happy' },
  practice: { text: 'Делаем руками на компьютере — потом расскажешь, что вышло.', mood: 'happy' },
  task: { text: 'Решай сам. Подсказка — только после двух ошибок.', mood: 'think' },
  final: { text: 'Урок пройден! Так держать.', mood: 'cool' },
};

type Phase = 'theory' | 'key' | 'example' | 'practice' | 'task' | 'final';
const PHASE_LABEL: Record<Phase, string> = {
  theory: 'Теория',
  key: 'Запиши',
  example: 'Пример',
  practice: 'Практика',
  task: 'Задание',
  final: 'Итог',
};

type TaskState = { value: string; checked: boolean; ok: boolean; fails: number };

const PRAISE = [
  'Верно! Видишь, как это просто.',
  'Точно! Бип-бип — так держать.',
  'Правильно! Ты считаешь как компьютер.',
  'Да! Ещё один бит в копилку.',
];

const TRY_AGAIN = [
  'Не совсем. Разберём, где затык.',
  'Мимо. Посмотри на подсказку и попробуй ещё.',
  'Пока нет. Перечитай шаг выше — ответ рядом.',
];

// Теория бьётся на подслайды, чтобы слайд влезал в один экран без прокрутки:
// по 2 абзаца на слайд + отдельный слайд под код (если есть).
const THEORY_PER_SLIDE = 2;

function theorySlides(s: Extract<PlayStep, { kind: 'theory' }>): { paras: string[]; mono?: string[] }[] {
  const out: { paras: string[]; mono?: string[] }[] = [];
  for (let i = 0; i < s.body.length; i += THEORY_PER_SLIDE) {
    out.push({ paras: s.body.slice(i, i + THEORY_PER_SLIDE) });
  }
  if (s.mono?.length) out.push({ paras: [], mono: s.mono });
  return out.length ? out : [{ paras: [] }];
}

function subCount(s: PlayStep): number {
  return s.kind === 'theory' ? theorySlides(s).length : 1;
}

function phaseOf(lesson: PlayLesson, idx: number): Phase {
  if (idx >= lesson.steps.length) return 'final';
  return lesson.steps[idx].kind;
}

export default function LessonPlay({
  lesson,
  trainerHref,
  nextHref,
  nextTitle,
  checksBase,
}: {
  lesson: PlayLesson;
  trainerHref: string;
  nextHref?: string;
  nextTitle?: string;
  /** База маршрутов проверок, напр. `${B}8/` — slug берётся из lesson.nextCheck. */
  checksBase: string;
}) {
  const total = lesson.steps.length + 1; // + итог
  const [idx, setIdx] = useState(0);
  const [sub, setSub] = useState(0);
  const [revealed, setRevealed] = useState<Record<number, number>>({});
  const [written, setWritten] = useState<Record<number, boolean>>({});
  const [tasks, setTasks] = useState<Record<number, TaskState>>({});
  // Практика: галочка «выполнил на компьютере», как у ключевого.
  const [practiced, setPracticed] = useState<Record<number, boolean>>({});
  // Напоминание «сначала введи ответ»: по шагам, сбрасывается при вводе.
  const [needAnswer, setNeedAnswer] = useState<Record<number, boolean>>({});

  const isLast = idx === lesson.steps.length;

  const score = useMemo(() => {
    let got = 0;
    let n = 0;
    lesson.steps.forEach((s, i) => {
      if (s.kind !== 'task') return;
      n++;
      if (tasks[i]?.ok) got++;
    });
    return { got, n };
  }, [lesson, tasks]);

  function checkTask(i: number, s: Extract<PlayStep, { kind: 'task' }>) {
    const cur = tasks[i] ?? { value: '', checked: false, ok: false, fails: 0 };
    // Пустой ответ — не проверка, а напоминание. Ошибку не считаем.
    if (!cur.value || String(cur.value).trim() === '') {
      setNeedAnswer({ ...needAnswer, [i]: true });
      return;
    }
    setNeedAnswer({ ...needAnswer, [i]: false });
    let ok = false;
    if (s.taskKind === 'numeric') {
      ok = checkNumericBase(s.expected ?? 0, cur.value, s.base ?? 10).isCorrect;
    } else {
      ok = checkSingleChoice(s.correct ?? '', cur.value).isCorrect;
    }
    setTasks({ ...tasks, [i]: { ...cur, checked: true, ok, fails: ok ? cur.fails : cur.fails + 1 } });
  }

  // Гейты «Далее»: ключевое — только после галочки, пример — после всех шагов,
  // практика — после галочки «выполнил», задание — после первой проверки.
  function canNext(): boolean {
    if (isLast) return false;
    const s = lesson.steps[idx];
    if (s.kind === 'key') return written[idx] === true;
    if (s.kind === 'example') return (revealed[idx] ?? 0) >= s.lines.length;
    if (s.kind === 'practice') return practiced[idx] === true;
    if (s.kind === 'task') return tasks[idx]?.checked === true;
    return true;
  }

  function gateHint(): string {
    const s = lesson.steps[isLast ? 0 : idx];
    if (isLast || s.kind === 'theory') return '';
    if (s.kind === 'key') return 'Поставь галочку «Записал в тетрадь» — без записи дальше нельзя.';
    if (s.kind === 'example') return 'Открой все шаги разбора кнопкой «Показать шаг».';
    if (s.kind === 'practice') return 'Выполни работу на компьютере и поставь галочку «Выполнил».';
    return 'Сначала нажми «Проверить».';
  }

  const step = isLast ? null : lesson.steps[idx];
  const nSubs = !isLast && step!.kind === 'theory' ? theorySlides(step as Extract<PlayStep, { kind: 'theory' }>).length : 1;
  const cur = !isLast && step!.kind === 'theory'
    ? theorySlides(step as Extract<PlayStep, { kind: 'theory' }>)[Math.min(sub, nSubs - 1)]
    : null;

  function goNext() {
    if (!isLast && step!.kind === 'theory' && sub < nSubs - 1) {
      setSub(sub + 1);
      return;
    }
    if (canNext()) {
      setIdx(idx + 1);
      setSub(0);
    }
  }

  function goBack() {
    if (!isLast && step!.kind === 'theory' && sub > 0) {
      setSub(sub - 1);
      return;
    }
    if (idx > 0) {
      const prev = lesson.steps[idx - 1];
      setIdx(idx - 1);
      setSub(subCount(prev) - 1);
    }
  }
  const phases: Phase[] = ['theory', 'key', 'example', 'practice', 'task', 'final'];
  const now = phaseOf(lesson, idx);
  const nowPos = phases.indexOf(now);
  const phaseTip = PHASE_TIP[isLast ? 'final' : step!.kind];
  const stepTip = !isLast && 'tip' in step! && step!.tip ? (step as { tip?: string }).tip : null;

  // Бипин реагирует на результат только что проверенного задания:
  // верно — восторг (wow + прыжок), неверно — утешение,
  // 3+ ошибок — злость и молчание, пустой ответ — напоминание.
  const tState = isLast ? undefined : tasks[idx];
  const tried = tState?.checked === true;
  const okTask = tState?.ok === true;
  const fails = tState?.fails ?? 0;
  const angry = tried && !okTask && fails >= 3;
  const emptyWarn = !isLast && (needAnswer[idx] === true);
  const mood: MascotMood = angry
    ? 'angry'
    : emptyWarn
      ? 'think'
      : tried
        ? okTask
          ? 'wow'
          : 'sad'
        : isLast
          ? score.got === score.n
            ? 'cool'
            : 'happy'
          : phaseTip.mood;
  // silent=true — Бипин молчит (после 3 ошибок).
  const silent = angry;
  const bubble = silent
    ? ''
    : emptyWarn
      ? 'Сначала введи ответ — потом нажмём «Проверить».'
      : tried
        ? okTask
          ? PRAISE[fails % PRAISE.length]
          : TRY_AGAIN[(fails - 1) % TRY_AGAIN.length]
        : (stepTip ?? (isLast ? (score.got === score.n ? 'Всё верно — ты звезда!' : phaseTip.text) : phaseTip.text));

  return (
    <div className="lp">
      <div className="lp-progress" aria-hidden="true">
        <i style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>
      <ol className="lp-phases">
        {phases.map((p, i) => (
          <li key={p} className={i === nowPos ? 'now' : i < nowPos ? 'past' : ''}>
            {PHASE_LABEL[p]}
          </li>
        ))}
      </ol>
      <div className="mascot-row">
        <Mascot mood={mood} size={56} />
        {!silent && <p className="mascot-say rb-say" key={bubble}>{bubble}</p>}
      </div>
      <p className="lp-meta">
        Урок {lesson.no} · {lesson.title} · шаг {idx + 1} из {total}
        {!isLast && step?.kind === 'theory' && nSubs > 1 ? ` · слайд ${Math.min(sub, nSubs - 1) + 1} из ${nSubs}` : ''} · ≈{lesson.minutes} мин
      </p>

      {!isLast && step?.kind === 'theory' && cur && (
        <article className="lp-card">
          <p className="lp-kicker">Теория{cur.mono ? ' — смотрим код' : ''}</p>
          <h1>{step.title}</h1>
          {cur.paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {cur.mono && (
            <pre className="lp-mono">
              {cur.mono.join('\n')}
            </pre>
          )}
          {nSubs > 1 && (
            <p>
              <button type="button" className="lp-stepbtn" disabled={sub >= nSubs - 1} onClick={() => setSub(sub + 1)}>
                Следующий слайд ({Math.min(sub, nSubs - 1) + 1} из {nSubs})
              </button>
            </p>
          )}
        </article>
      )}

      {!isLast && step?.kind === 'key' && (
        <article className="lp-card lp-key">
          <p className="lp-kicker">Ключевое — записать в тетрадь</p>
          <h1>{step.title}</h1>
          <ol>
            {step.body.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
          {step.mono && (
            <pre className="lp-mono">
              {step.mono.join('\n')}
            </pre>
          )}
          <p className="lp-write">✍️ {step.writeDown}</p>
          <label className="lp-check">
            <input
              type="checkbox"
              checked={written[idx] === true}
              onChange={(e) => setWritten({ ...written, [idx]: e.target.checked })}
            />
            Записал в тетрадь
          </label>
        </article>
      )}

      {!isLast && step?.kind === 'example' && (
        <article className="lp-card">
          <p className="lp-kicker">Пример — разбираем по шагам</p>
          <h1>{step.title}</h1>
          <p>{step.intro}</p>
          {step.mono && (
            <pre className="lp-mono">
              {step.mono.join('\n')}
            </pre>
          )}
          <ol className="lp-lines">
            {step.lines.slice(0, revealed[idx] ?? 0).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
          {(revealed[idx] ?? 0) < step.lines.length && (
            <button
              type="button"
              className="lp-stepbtn"
              onClick={() => setRevealed({ ...revealed, [idx]: (revealed[idx] ?? 0) + 1 })}
            >
              Показать шаг {(revealed[idx] ?? 0) + 1} из {step.lines.length}
            </button>
          )}
        </article>
      )}

      {!isLast && step?.kind === 'practice' && (
        <article className="lp-card lp-practice">
          <p className="lp-kicker">Практика — делаем на компьютере</p>
          <h1>{step.title}</h1>
          {step.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <ol>
            {step.steps.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
          <p className="lp-write">✅ {step.result}</p>
          <label className="lp-check">
            <input
              type="checkbox"
              checked={practiced[idx] === true}
              onChange={(e) => setPracticed({ ...practiced, [idx]: e.target.checked })}
            />
            Выполнил на компьютере
          </label>
        </article>
      )}

      {!isLast && step?.kind === 'task' && (
        <article className="lp-card">
          <p className="lp-kicker">{step.title} — проверь себя</p>
          <p>
            <strong>{step.prompt}</strong>
          </p>
          {step.taskKind === 'numeric' ? (
            <input
              className="lp-taskinput"
              type="text"
              inputMode="text"
              placeholder="только число"
              aria-label={step.prompt}
              value={tasks[idx]?.value ?? ''}
              onChange={(e) => {
                setTasks({ ...tasks, [idx]: { value: e.target.value, checked: false, ok: false, fails: tasks[idx]?.fails ?? 0 } });
                if (needAnswer[idx]) setNeedAnswer({ ...needAnswer, [idx]: false });
              }}
            />
          ) : (
            <div role="radiogroup" aria-label={step.prompt}>
              {(step.options ?? []).map((o) => (
                <label className="lp-radio" key={o.id}>
                  <input
                    type="radio"
                    name={`lp-${idx}`}
                    value={o.id}
                    checked={(tasks[idx]?.value ?? '') === o.id}
                    onChange={() => {
                      setTasks({ ...tasks, [idx]: { value: o.id, checked: false, ok: false, fails: tasks[idx]?.fails ?? 0 } });
                      if (needAnswer[idx]) setNeedAnswer({ ...needAnswer, [idx]: false });
                    }}
                  />
                  {o.id}. {o.text}
                </label>
              ))}
            </div>
          )}
          <p>
            <button type="button" className="lp-checkbtn" onClick={() => checkTask(idx, step)}>
              Проверить
            </button>
          </p>
          {tasks[idx]?.checked && (
            <p className={tasks[idx].ok ? 'lp-ok' : 'lp-bad'} role="status">
              {tasks[idx].ok ? 'Верно! Так держать.' : 'Пока нет. Перечитай подсказку и попробуй ещё.'}
            </p>
          )}
          {tasks[idx] && tasks[idx].fails >= 2 && !tasks[idx].ok && (
            <p className="lp-hint">Подсказка: {step.hint}</p>
          )}
        </article>
      )}

      {isLast && (
        <article className="lp-card">
          <p className="lp-kicker">Итог урока</p>
          <h1>
            Задания: {score.got} из {score.n}
          </h1>
          <p>
            {score.got === score.n
              ? 'Отлично — тема усвоена. Закрепи в тренажёре.'
              : 'Хорошая работа. Разбери ошибки выше и добей в тренажёре.'}
          </p>
          {lesson.fact && (
            <p className="lp-fact">
              <span className="lp-fact-label">💡 Интересный факт</span>
              {lesson.fact}
            </p>
          )}
          {lesson.nextCheck && (
            <p className="lp-write">
              ⚠️ Следующий шаг — {lesson.nextCheck.kind === 'proverka' ? 'проверочная' : 'контрольная'}:{' '}
              <a href={`${checksBase}${lesson.nextCheck.slug}/`}>{lesson.nextCheck.title} →</a>
              {' '}Повтори ключевое выше — дальше без подсказок.
            </p>
          )}
          <p>
            <a className="lp-next" href={trainerHref}>
              В тренажёр →
            </a>
          </p>
          {nextHref && (
            <p>
              <a href={nextHref}>Следующий урок: {nextTitle} →</a>
            </p>
          )}
        </article>
      )}

      {!canNext() && gateHint() && (
        <p className="lp-gate" role="note">
          {gateHint()}
        </p>
      )}
      <div className="lp-nav">
        <button
          type="button"
          className="lp-back"
          disabled={idx === 0 && (isLast || step?.kind !== 'theory' || sub === 0)}
          onClick={goBack}
        >
          Назад
        </button>
        <span> </span>
        {!isLast ? (
          <button type="button" className="lp-next" onClick={goNext}>
            Далее
          </button>
        ) : (
          <a className="lp-next" href={trainerHref}>
            В тренажёр →
          </a>
        )}
      </div>
    </div>
  );
}
