import { useState } from 'react';
import { studyStore } from '../lib/progress/store.mjs';
import { LESSONS_7, LESSONS_8, LESSONS_9, LESSONS_10, LESSONS_11 } from '../data/lessons';

// «Начать учиться» / «Продолжить» + классы с буквами (8А, 8Б…).
// Продолжить активна, только если хотя бы раз нажали «Начать учиться».
const BY_GRADE: Record<string, { id: string }[]> = {
  '7': LESSONS_7,
  '8': LESSONS_8,
  '9': LESSONS_9,
  '10': LESSONS_10,
  '11': LESSONS_11,
};

interface GradeState {
  started: boolean;
  groups: string[];
  active: string;
  pos: Record<string, { lesson: string; title: string; href: string; at: number }>;
}

export default function StudyProgress({ grade }: { grade: string }) {
  const B = import.meta.env.BASE_URL;
  const first = BY_GRADE[grade]?.[0];
  const firstHref = first ? `${B}${grade}/${first.id}/` : `${B}${grade}/`;
  const [st, setSt] = useState<GradeState>(() => studyStore.readGrade(grade));
  const [letter, setLetter] = useState('');
  const [err, setErr] = useState('');

  function refresh() {
    setSt(studyStore.readGrade(grade));
  }

  function start() {
    const g = studyStore.start(grade);
    setSt({ ...g });
    window.location.href = firstHref;
  }

  function add() {
    const r = studyStore.addGroup(grade, letter);
    if (!r.ok) {
      setErr(r.error ?? 'Не получилось.');
      return;
    }
    setLetter('');
    setErr('');
    refresh();
  }

  const activePos = st.groups.includes(st.active) ? st.pos[st.active] : undefined;
  const contHref = activePos?.href ?? firstHref;

  return (
    <div className="card">
      {!st.started ? (
        <p>
          <button className="btn" onClick={start}>Начать учиться → {first ? 'урок 1' : 'класс'}</button>
        </p>
      ) : (
        <p>
          <a className="btn" href={contHref}>
            Продолжить{activePos ? ` → ${st.active}: ${activePos.title}` : ' → урок 1'}
          </a>
        </p>
      )}
      {st.started && (
        <>
          <p className="muted">
            {activePos
              ? `${st.active} остановился: ${activePos.title}`
              : 'Открой урок — запомню, где остановился.'}
          </p>
          {st.groups.map((g) => (
            <p key={g}>
              <label>
                <input
                  type="radio"
                  name={`grp-${grade}`}
                  checked={st.active === g}
                  onChange={() => {
                    studyStore.setActive(grade, g);
                    refresh();
                  }}
                />{' '}
                <strong>{g}</strong>
                {st.pos[g] ? ` — ${st.pos[g].title}` : ' — ещё не начинали'}
              </label>{' '}
              {st.groups.length > 1 && (
                <button
                  className="btn secondary"
                  onClick={() => {
                    studyStore.removeGroup(grade, g);
                    refresh();
                  }}
                >
                  Убрать
                </button>
              )}
            </p>
          ))}
          <p>
            <input
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              placeholder="Буква, напр. А"
              aria-label="Буква класса"
              style={{ width: 140 }}
            />{' '}
            <button className="btn secondary" onClick={add}>Добавить класс</button>
            {err && <span className="auth-error" role="alert"> {err}</span>}
          </p>
        </>
      )}
    </div>
  );
}
