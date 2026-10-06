// PROTOTYPE (throwaway): три варианта страницы урока, ?variant=a|b|c.
// A=1 экран 1 действие (шаги), B=сплит теория/практика, C=диалог с героем.
import { useState } from 'react';
import PrototypeSwitcher, { useVariant } from './PrototypeSwitcher';
import { SAMPLE } from './demo-data';

const VARIANTS = [
  { key: 'a', name: 'Шаги — 1 экран = 1 действие' },
  { key: 'b', name: 'Сплит — теория + практика' },
  { key: 'c', name: 'Диалог — урок с героем' },
];

export default function LessonPrototype({ base }: { base: string }) {
  const [v, go] = useVariant(VARIANTS.map((x) => x.key));
  return (
    <>
      {v === 'a' && <LessonA base={base} />}
      {v === 'b' && <LessonB base={base} />}
      {v === 'c' && <LessonC base={base} />}
      <PrototypeSwitcher variants={VARIANTS} current={v} onChange={go} />
    </>
  );
}

function BitsTable() {
  return (
    <div className="lx-bits" role="table" aria-label="Веса разрядов">
      {SAMPLE.bits.map((b) => (
        <span key={b} role="cell">
          {b}
        </span>
      ))}
    </div>
  );
}

function TaskOptions({
  picked,
  onPick,
}: {
  picked: string | null;
  onPick: (o: string) => void;
}) {
  return (
    <div className="lx-opts" role="radiogroup" aria-label={SAMPLE.task}>
      {SAMPLE.options.map((o) => (
        <button
          key={o}
          type="button"
          className={'lx-opt' + (picked === o ? (o === SAMPLE.correct ? ' ok' : ' bad') : '')}
          onClick={() => onPick(o)}
          aria-pressed={picked === o}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/* A — шаги: теория → пример → задание → итог, прогресс-бар сверху. */
function LessonA({ base }: { base: string }) {
  const steps = ['Теория', 'Пример', 'Задание', 'Итог'];
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const ok = picked === SAMPLE.correct;
  return (
    <div className="la">
      <header className="la-head">
        <a href={`${base}8/`}>← 8 класс</a>
        <span>
          Урок {SAMPLE.lessonNo} · {SAMPLE.lessonTitle}
        </span>
      </header>
      <div className="la-progress" aria-hidden="true">
        <i style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      <ol className="la-steps">
        {steps.map((s, i) => (
          <li key={s} className={i === step ? 'now' : i < step ? 'past' : ''}>
            {s}
          </li>
        ))}
      </ol>
      <main className="la-card">
        {step === 0 && (
          <>
            <h1>Веса разрядов</h1>
            <p>{SAMPLE.concept}</p>
            <BitsTable />
          </>
        )}
        {step === 1 && (
          <>
            <h1>Разбираем пример</h1>
            <p className="lx-example">{SAMPLE.example}</p>
            <p className="muted">{SAMPLE.hint}</p>
          </>
        )}
        {step === 2 && (
          <>
            <h1>{SAMPLE.task}</h1>
            <TaskOptions picked={picked} onPick={setPicked} />
            {picked && (
              <p className={ok ? 'ok' : 'bad'} role="status">
                {ok ? SAMPLE.praise : 'Пока нет — попробуй ещё раз.'}
              </p>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <h1>{ok || !picked ? 'Урок пройден!' : 'Почти получилось'}</h1>
            <p>
              {picked
                ? ok
                  ? '★ +10 монет · серия продолжается 🔥'
                  : 'Загляни в подсказку на шаге «Пример» и возвращайся.'
                : 'Ты пропустил задание — вернись на шаг «Задание».'}
            </p>
            <a className="lx-cta" href={`${base}8/trainer/`}>
              Закрепить в тренажёре →
            </a>
          </>
        )}
      </main>
      <footer className="la-nav">
        <button type="button" className="lx-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Назад
        </button>
        {step < steps.length - 1 ? (
          <button type="button" className="lx-cta" onClick={() => setStep(step + 1)}>
            Далее
          </button>
        ) : (
          <a className="lx-cta" href={`${base}8/`}>
            К урокам
          </a>
        )}
      </footer>
    </div>
  );
}

/* B — сплит: слева теория, справа липкая карточка задания. */
function LessonB({ base }: { base: string }) {
  const [picked, setPicked] = useState<string | null>(null);
  const ok = picked === SAMPLE.correct;
  return (
    <div className="lb">
      <header className="lb-head">
        <a href={`${base}8/`}>← 8 класс</a>
        <h1>
          Урок {SAMPLE.lessonNo} · {SAMPLE.lessonTitle}
        </h1>
      </header>
      <main className="lb-split">
        <article className="lb-theory">
          <section className="lb-block">
            <h2>💡 Теория</h2>
            <p>{SAMPLE.concept}</p>
            <BitsTable />
          </section>
          <section className="lb-block">
            <h2>🔍 Пример</h2>
            <p className="lx-example">{SAMPLE.example}</p>
            <p className="muted">{SAMPLE.hint}</p>
          </section>
        </article>
        <aside className="lb-task">
          <h2>✏️ Проверь себя</h2>
          <p>
            <strong>{SAMPLE.task}</strong>
          </p>
          <TaskOptions picked={picked} onPick={setPicked} />
          {picked && (
            <p className={ok ? 'ok' : 'bad'} role="status">
              {ok ? SAMPLE.praise : 'Пока нет — перечитай теорию слева.'}
            </p>
          )}
          {ok && (
            <a className="lx-cta" href={`${base}8/trainer/`}>
              Дальше — тренажёр →
            </a>
          )}
        </aside>
      </main>
    </div>
  );
}

/* C — диалог: урок ведёт герой Робит, задание — репликой в ленте. */
interface Msg {
  who: 'bot' | 'me';
  text: string;
}

const SCRIPT: Msg[] = [
  { who: 'bot', text: 'Привет! Я Робит 🤖 Сегодня разберём двоичную систему за 2 минуты.' },
  { who: 'bot', text: SAMPLE.concept },
  { who: 'bot', text: `Смотри пример: ${SAMPLE.example}` },
  { who: 'bot', text: `А теперь ты: ${SAMPLE.task}` },
];

function LessonC({ base }: { base: string }) {
  const [shown, setShown] = useState(2);
  const [picked, setPicked] = useState<string | null>(null);
  const ok = picked === SAMPLE.correct;
  const taskVisible = shown >= SCRIPT.length;
  return (
    <div className="lc">
      <header className="lc-head">
        <a href={`${base}8/`}>←</a>
        <span className="lc-ava" aria-hidden="true">
          🤖
        </span>
        <span>
          <strong>Робит</strong>
          <small>Урок {SAMPLE.lessonNo} · {SAMPLE.lessonTitle}</small>
        </span>
      </header>
      <main className="lc-feed">
        {SCRIPT.slice(0, shown).map((m, i) => (
          <div key={i} className={`lc-msg ${m.who}`}>
            {m.text}
          </div>
        ))}
        {taskVisible && (
          <div className="lc-msg bot task">
            <TaskOptions
              picked={picked}
              onPick={(o) => {
                setPicked(o);
              }}
            />
            {picked && (
              <p className={ok ? 'ok' : 'bad'} role="status">
                {ok ? SAMPLE.praise + ' +10 монет 💎' : 'Хм, не то. Подсказка: веса 8, 2 и 1.'}
              </p>
            )}
          </div>
        )}
      </main>
      <footer className="lc-footer">
        {!taskVisible ? (
          <button type="button" className="lx-cta" onClick={() => setShown(shown + 1)}>
            Далее
          </button>
        ) : ok ? (
          <a className="lx-cta" href={`${base}8/trainer/`}>
            В тренажёр →
          </a>
        ) : (
          <span className="muted">Выбери ответ выше ☝️</span>
        )}
      </footer>
    </div>
  );
}
