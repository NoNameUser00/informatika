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
  task: { text: 'Решай сам. Подсказка — только после двух ошибок.', mood: 'think' },
  final: { text: 'Урок пройден! Так держать.', mood: 'cool' },
};

type Phase = 'theory' | 'key' | 'example' | 'task' | 'final';
const PHASE_LABEL: Record<Phase, string> = {
  theory: 'Теория',
  key: 'Запиши',
  example: 'Пример',
  task: 'Задание',
  final: 'Итог',
};

type TaskState = { value: string; checked: boolean; ok: boolean; fails: number };

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
  const [revealed, setRevealed] = useState<Record<number, number>>({});
  const [written, setWritten] = useState<Record<number, boolean>>({});
  const [tasks, setTasks] = useState<Record<number, TaskState>>({});

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
    let ok = false;
    if (s.taskKind === 'numeric') {
      ok = checkNumericBase(s.expected ?? 0, cur.value, s.base ?? 10).isCorrect;
    } else {
      ok = checkSingleChoice(s.correct ?? '', cur.value).isCorrect;
    }
    setTasks({ ...tasks, [i]: { ...cur, checked: true, ok, fails: ok ? cur.fails : cur.fails + 1 } });
  }

  // Гейты «Далее»: ключевое — только после галочки, пример — после всех шагов,
  // задание — после первой проверки.
  function canNext(): boolean {
    if (isLast) return false;
    const s = lesson.steps[idx];
    if (s.kind === 'key') return written[idx] === true;
    if (s.kind === 'example') return (revealed[idx] ?? 0) >= s.lines.length;
    if (s.kind === 'task') return tasks[idx]?.checked === true;
    return true;
  }

  function gateHint(): string {
    const s = lesson.steps[isLast ? 0 : idx];
    if (isLast || s.kind === 'theory') return '';
    if (s.kind === 'key') return 'Поставь галочку «Записал в тетрадь» — без записи дальше нельзя.';
    if (s.kind === 'example') return 'Открой все шаги разбора кнопкой «Показать шаг».';
    return 'Сначала нажми «Проверить».';
  }

  const step = isLast ? null : lesson.steps[idx];
  const phases: Phase[] = ['theory', 'key', 'example', 'task', 'final'];
  const now = phaseOf(lesson, idx);
  const nowPos = phases.indexOf(now);
  const phaseTip = PHASE_TIP[isLast ? 'final' : step!.kind];
  const stepTip = !isLast && 'tip' in step! && step!.tip ? (step as { tip?: string }).tip : null;

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
        <Mascot mood={isLast ? (score.got === score.n ? 'cool' : 'happy') : phaseTip.mood} size={56} />
        <p className="mascot-say">{stepTip ?? (isLast ? (score.got === score.n ? 'Всё верно — ты звезда!' : phaseTip.text) : phaseTip.text)}</p>
      </div>
      <p className="lp-meta">
        Урок {lesson.no} · {lesson.title} · шаг {idx + 1} из {total} · ≈{lesson.minutes} мин
      </p>

      {!isLast && step?.kind === 'theory' && (
        <article className="lp-card">
          <p className="lp-kicker">Теория</p>
          <h1>{step.title}</h1>
          {step.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {step.mono && (
            <pre className="lp-mono">
              {step.mono.join('\n')}
            </pre>
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
              onChange={(e) =>
                setTasks({ ...tasks, [idx]: { value: e.target.value, checked: false, ok: false, fails: tasks[idx]?.fails ?? 0 } })
              }
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
                    onChange={() =>
                      setTasks({ ...tasks, [idx]: { value: o.id, checked: false, ok: false, fails: tasks[idx]?.fails ?? 0 } })
                    }
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
          disabled={idx === 0}
          onClick={() => setIdx(idx - 1)}
        >
          Назад
        </button>
        <span> </span>
        {!isLast ? (
          <button type="button" className="lp-next" onClick={() => canNext() && setIdx(idx + 1)}>
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
