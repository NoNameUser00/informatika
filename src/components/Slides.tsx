import { useEffect, useState } from 'react';
import { checkSingleChoice, checkMatching } from '../lib/scoring/check.mjs';
import DragMatch from './DragMatch';

// Презентация урока: один экран — один слайд, стрелки/кнопки, прогресс.
// В конце — интерактивные задания по теме (тренировка, в журнал не сохраняется).
export interface SlideData {
  heading: string;
  html: string;
}

export default function Slides({ title, slides, quiz }: { title: string; slides: SlideData[]; quiz: any[] }) {
  const total = slides.length + quiz.length + (quiz.length > 0 ? 1 : 0);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(total - 1, i + 1));
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [total]);

  const isQuiz = idx >= slides.length;
  const isSummary = quiz.length > 0 && idx === slides.length + quiz.length;
  const q = isQuiz && !isSummary ? quiz[idx - slides.length] : null;
  const qNum = idx - slides.length;

  function checkQ(task: any) {
    const a = answers[task.id];
    let ok = false;
    if (task.type === 'single_choice') ok = checkSingleChoice(task.correct, String(a ?? '')).isCorrect;
    else if (task.type === 'matching') ok = checkMatching(task.answerMap, (a ?? {}) as Record<string, string>, task.points ?? 2).isCorrect;
    setChecked((c) => ({ ...c, [task.id]: ok }));
  }

  const score = quiz.filter((t) => checked[t.id]).length;

  return (
    <div>
      <p className="muted">Слайд {idx + 1} из {total}</p>
      <div style={{ background: '#e2e8f0', borderRadius: 8, height: 8, marginBottom: 12 }} aria-hidden="true">
        <div style={{ width: `${((idx + 1) / total) * 100}%`, background: 'var(--subject)', height: 8, borderRadius: 8 }} />
      </div>

      {!isQuiz && (
        <div className="card" style={{ minHeight: 300 }}>
          {idx === 0 ? <h1>{title}</h1> : <h2>{slides[idx].heading}</h2>}
          <div dangerouslySetInnerHTML={{ __html: idx === 0 ? slides[0].html : slides[idx].html }} />
        </div>
      )}

      {isQuiz && !isSummary && q && (
        <div className="card" style={{ minHeight: 300 }}>
          <p className="muted">Задание {qNum + 1} из {quiz.length} · тренировка</p>
          <p><strong>{q.prompt}</strong></p>
          {q.type === 'single_choice' && (
            <div role="radiogroup" aria-label={q.id}>
              {q.options.map((o: any) => (
                <label className="radio-row" key={o.id} style={{ fontWeight: 400 }}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === o.id}
                    onChange={() => {
                      setAnswers((a) => ({ ...a, [q.id]: o.id }));
                      setChecked((c) => {
                        const n = { ...c };
                        delete n[q.id];
                        return n;
                      });
                    }}
                  />
                  {o.id}. {o.text}
                </label>
              ))}
            </div>
          )}
          {q.type === 'matching' && (
            <DragMatch
              left={q.left}
              right={q.right}
              value={answers[q.id] ?? {}}
              onChange={(v) => {
                setAnswers((a) => ({ ...a, [q.id]: v }));
                setChecked((c) => {
                  const n = { ...c };
                  delete n[q.id];
                  return n;
                });
              }}
            />
          )}
          {!(q.id in checked) ? (
            <button className="btn" style={{ marginTop: 12 }} onClick={() => checkQ(q)}>
              Проверить
            </button>
          ) : (
            <div style={{ marginTop: 12 }}>
              <p className={checked[q.id] ? 'ok' : 'bad'}>{checked[q.id] ? 'Верно!' : 'Неверно.'}</p>
              {!checked[q.id] && <p>Правильно: {q.key}. {q.feedback ?? ''}</p>}
              {checked[q.id] && q.feedback && <p className="muted">{q.feedback}</p>}
            </div>
          )}
        </div>
      )}

      {isSummary && (
        <div className="card" style={{ minHeight: 300 }}>
          <h2>Итог тренировки: {score} из {quiz.length}</h2>
          <p className="muted">Это была тренировка — в журнал ничего не сохраняется. Для оценки иди в тренажер.</p>
          <button
            className="btn secondary"
            onClick={() => {
              setAnswers({});
              setChecked({});
              setIdx(0);
            }}
          >
            Пройти урок заново
          </button>
        </div>
      )}

      <div>
        <button className="btn secondary" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          ← Назад
        </button>
        <span> </span>
        <button className="btn" disabled={idx >= total - 1} onClick={() => setIdx(idx + 1)}>
          Далее →
        </button>
      </div>
    </div>
  );
}
