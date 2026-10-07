import { useState } from 'react';
import { ERROR_REVIEW, REVIEW_PROTOCOL } from '../data/error-review';
import { LESSONS_7, LESSONS_8, LESSONS_9, LESSONS_10, LESSONS_11 } from '../data/lessons';

// Работа над ошибками после контрольных (КТП 7 №33, 10 №28 — и любой класс).
// Протокол + типовые ловушки с адресами повторения. Только чтение: ничего не пишет в базу.
const TITLES = new Map(
  [...LESSONS_7, ...LESSONS_8, ...LESSONS_9, ...LESSONS_10, ...LESSONS_11].map((l) => [l.id, l.title]),
);

const GRADES = ['7', '8', '9', '10', '11'];

export default function ErrorReview() {
  const B = import.meta.env.BASE_URL;
  const [code, setCode] = useState(ERROR_REVIEW[0].code);
  const [done, setDone] = useState<Set<number>>(new Set());
  const cur = ERROR_REVIEW.find((c) => c.code === code) ?? ERROR_REVIEW[0];

  function toggle(i: number) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="card">
      <h2>Работа над ошибками</h2>
      <p className="muted">Шаблон разбора после контрольной (КТП 7 №33, 10 №28). Выбери работу — получи протокол и топ ловушек с адресами повторения.</p>
      <ol>
        {REVIEW_PROTOCOL.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <p>
        <label>
          Контрольная:{' '}
          <select value={code} onChange={(e) => { setCode(e.target.value); setDone(new Set()); }}>
            {GRADES.map((g) => (
              <optgroup key={g} label={`${g} класс`}>
                {ERROR_REVIEW.filter((c) => c.grade === g).map((c) => (
                  <option key={c.code} value={c.code}>{c.title}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {' '}
        <a href={`${B}${cur.grade}/${cur.slug}/`}>Открыть работу →</a>
      </p>
      <p className="muted">Разобрано: {done.size}/{cur.traps.length}</p>
      {cur.traps.map((t, i) => (
        <p key={i}>
          <label>
            <input type="checkbox" checked={done.has(i)} onChange={() => toggle(i)} />{' '}
            {t.text}{' '}
          </label>
          <a href={`${B}${t.grade}/${t.lessonId}/`}>Повторить: {TITLES.get(t.lessonId) ?? t.lessonId} →</a>
        </p>
      ))}
      <p>
        <button className="btn secondary" onClick={() => window.print()}>Печать плана</button>{' '}
        <button className="btn secondary" onClick={() => setDone(new Set())}>Сбросить галочки</button>
      </p>
    </div>
  );
}
