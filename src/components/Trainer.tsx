import { useMemo, useState } from 'react';
import {
  checkMatching,
  checkNumericBase,
  checkSingleChoice,
  percentToMark,
} from '../lib/scoring/check.mjs';
import bank from '../data/numsys-tasks.json';
import { saveResult } from '../lib/results';

// Структура как в Яндекс.Форме учителя:
// стр.1 — ФИО, Класс, Буква класса; дальше страницы по 5 вопросов,
// на каждой — инструкция «запишите только число»; основание — подстрочным (₂ ₈ ₁₀ ₁₆).
type Mode = 'trainer' | 'proverka';
type Answer = string | Record<string, string>;

interface PerQ {
  id: string;
  ok: boolean;
  score: number;
  max: number;
  given: string;
  key: string;
}

const CLASS_NUMS = ['7', '8', '9', '10', '11'];
const CLASS_LETTERS = ['Ю', 'Я', 'Ч', 'Ш', 'Э', 'У', 'Ф'];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function Trainer() {
  const [mode] = useState<Mode>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'proverka'
      ? 'proverka'
      : 'trainer',
  );
  const pages = useMemo<any[][]>(() => chunk((bank as any).tasks, (bank as any).page_size ?? 5), []);
  const totalPages = pages.length + 1; // + страница с ФИО
  const [step, setStep] = useState(0);
  const [surname, setSurname] = useState('');
  const [firstname, setFirstname] = useState('');
  const [classNum, setClassNum] = useState('');
  const [classLetter, setClassLetter] = useState('');
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | {
    per: PerQ[];
    total: number;
    max: number;
    percent: number;
    mark: number;
    saveStatus: string;
  }>(null);

  const max = useMemo(() => (bank as any).tasks.reduce((s: number, t: any) => s + t.points, 0), []);

  const setA = (id: string, v: Answer) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    setDone(null);
  };

  const isAnswered = (t: any): boolean => {
    const a = answers[t.id];
    if (a == null || a === '') return false;
    if (t.type === 'matching') return t.left.every((k: string) => (a as Record<string, string>)[k]);
    return true;
  };

  function validPersonal(): boolean {
    if (!surname.trim() || !firstname.trim()) {
      setError('Заполните фамилию и имя — без них работу нельзя сохранить в журнал.');
      return false;
    }
    if (!classNum || !classLetter) {
      setError('Выберите класс и букву класса.');
      return false;
    }
    if (!consent) {
      setError('Нужно согласие на обработку данных (за хранение фамилии и оценок в журнале).');
      return false;
    }
    return true;
  }

  function next() {
    setError('');
    if (step === 0) {
      if (validPersonal()) setStep(1);
      return;
    }
    const missing = pages[step - 1].filter((t: any) => !isAnswered(t));
    if (missing.length > 0) {
      setError(`Ответьте на все вопросы страницы (не отвечен: ${missing[0].id}).`);
      document.getElementById(missing[0].id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setStep(step + 1);
  }

  async function submit() {
    setError('');
    const missing = pages[step - 1].filter((t: any) => !isAnswered(t));
    if (missing.length > 0) {
      setError(`Ответьте на все вопросы страницы (не отвечен: ${missing[0].id}).`);
      return;
    }
    const per: PerQ[] = (bank as any).tasks.map((t: any) => {
      const a = answers[t.id];
      if (t.type === 'numeric_base') {
        const r = checkNumericBase(t.expected, String(a), t.base);
        return { id: t.id, ok: r.isCorrect, score: r.isCorrect ? t.points : 0, max: t.points, given: String(a), key: t.key };
      }
      if (t.type === 'single_choice') {
        const r = checkSingleChoice(t.correct, String(a));
        return { id: t.id, ok: r.isCorrect, score: r.isCorrect ? t.points : 0, max: t.points, given: String(a), key: t.key };
      }
      const r = checkMatching(t.answerMap, a as Record<string, string>, t.points);
      const given = t.left.map((k: string) => `${k}=${(a as Record<string, string>)[k]}`).join(', ');
      return { id: t.id, ok: r.isCorrect, score: r.score, max: t.points, given, key: t.key };
    });
    const total = Math.round(per.reduce((s, p) => s + p.score, 0) * 100) / 100;
    const percent = Math.round((total / max) * 1000) / 10;
    const mark = percentToMark(percent);
    const keys: Record<string, string> = {};
    for (const t of (bank as any).tasks) keys[t.id] = t.key;
    const plainAnswers: Record<string, string> = {};
    for (const t of (bank as any).tasks) {
      const a = answers[t.id];
      plainAnswers[t.id] = typeof a === 'string' ? a : JSON.stringify(a);
    }
    let saveStatus = 'сохранено локально';
    try {
      saveStatus = await saveResult({
        surname: surname.trim(),
        firstname: firstname.trim(),
        class_name: `${classNum}-${classLetter}`,
        test_type: mode === 'proverka' ? 'proverka' : 'trainer',
        test_code: (bank as any).test_code,
        variant: (bank as any).variant,
        answers: plainAnswers,
        keys,
        auto_score: total,
        max_score: max,
        percent,
        proposed_mark: mark,
        consent,
      });
    } catch {
      saveStatus = 'не удалось сохранить в базу, копия осталась в браузере';
    }
    setDone({ per, total, max, percent, mark, saveStatus });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderTask(t: any, i: number, globalIndex: number) {
    return (
      <fieldset className="card q" id={t.id} key={t.id}>
        <legend>Вопрос {globalIndex + 1} · {t.points} б.</legend>
        <p><strong>{t.prompt}</strong></p>
        {t.type === 'numeric_base' && (
          <input
            type="text"
            inputMode="text"
            placeholder="только число"
            value={(answers[t.id] as string) ?? ''}
            onChange={(e) => setA(t.id, e.target.value)}
            aria-label={`Ответ на вопрос ${globalIndex + 1}`}
          />
        )}
        {t.type === 'single_choice' && (
          <div role="radiogroup" aria-label={`Вопрос ${globalIndex + 1}`}>
            {t.options.map((o: any) => (
              <label className="radio-row" key={o.id} style={{ fontWeight: 400 }}>
                <input
                  type="radio"
                  name={t.id}
                  value={o.id}
                  checked={answers[t.id] === o.id}
                  onChange={() => setA(t.id, o.id)}
                />
                {o.id}. {o.text}
              </label>
            ))}
          </div>
        )}
        {t.type === 'matching' && (
          <div>
            {t.left.map((k: string) => (
              <div key={k}>
                <label htmlFor={`${t.id}-${k}`}>{k} →</label>
                <select
                  id={`${t.id}-${k}`}
                  value={((answers[t.id] as Record<string, string>) ?? {})[k] ?? ''}
                  onChange={(e) => setA(t.id, { ...((answers[t.id] as Record<string, string>) ?? {}), [k]: e.target.value })}
                >
                  <option value="">— выбрать —</option>
                  {t.right.map((r: string) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </fieldset>
    );
  }

  if (done) {
    return (
      <div>
        <div className="card">
          <h2>Результат: {done.total} из {done.max} ({done.percent}%) — отметка {done.mark}</h2>
          <p className="muted">
            {surname} {firstname}, {classNum}-{classLetter} · {mode === 'proverka' ? 'проверочная' : 'тренажер'} · {done.saveStatus}
          </p>
          {mode === 'proverka' && <p>Правильные ответы скрыты — работу посмотрит учитель и подтвердит отметку.</p>}
        </div>
        {done.per.map((p) => (
          <div className="card q" key={p.id}>
            <p>
              <strong>{p.id}</strong> — <span className={p.ok ? 'ok' : 'bad'}>{p.ok ? 'верно' : 'неверно'}</span> · {p.score}/{p.max}
            </p>
            <p className="muted">Ваш ответ: {p.given}</p>
            {mode === 'trainer' && <p>Правильно: {p.key}</p>}
          </div>
        ))}
        <button className="btn secondary" onClick={() => { setDone(null); setAnswers({}); setStep(0); }}>
          Пройти заново
        </button>
      </div>
    );
  }

  const isLast = step === pages.length;

  return (
    <div>
      <h1>{mode === 'proverka' ? 'Проверочная: Системы счисления' : 'Тренажер: Системы счисления'}</h1>
      <p className="muted">Страница {step + 1} из {totalPages}</p>

      {step === 0 && (
        <div className="card">
          <label htmlFor="surname">ФИО ученика (Фамилия Имя): фамилия *</label>
          <input id="surname" type="text" value={surname} onChange={(e) => setSurname(e.target.value)} autoComplete="family-name" />
          <label htmlFor="firstname">Имя *</label>
          <input id="firstname" type="text" value={firstname} onChange={(e) => setFirstname(e.target.value)} autoComplete="given-name" />
          <label htmlFor="klass">Класс *</label>
          <select id="klass" value={classNum} onChange={(e) => setClassNum(e.target.value)}>
            <option value="">— выбрать —</option>
            {CLASS_NUMS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label htmlFor="letter">Буква класса *</label>
          <select id="letter" value={classLetter} onChange={(e) => setClassLetter(e.target.value)}>
            <option value="">— выбрать —</option>
            {CLASS_LETTERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="radio-row">
            <input id="consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <label htmlFor="consent" style={{ margin: 0, fontWeight: 400 }}>
              Соглашаюсь на хранение фамилии, ответов и оценки в журнале (152-ФЗ, только для учителя)
            </label>
          </div>
        </div>
      )}

      {step > 0 && (
        <div>
          <div className="card">
            <p><strong>{(bank as any).instruction}</strong></p>
          </div>
          {pages[step - 1].map((t: any, i: number) =>
            renderTask(t, i, (step - 1) * ((bank as any).page_size ?? 5) + i),
          )}
        </div>
      )}

      {error && <p className="bad" role="alert">{error}</p>}
      <div>
        {step > 0 && <button className="btn secondary" onClick={() => { setError(''); setStep(step - 1); }}>Назад</button>}
        <span> </span>
        {!isLast && <button className="btn" onClick={next}>Далее</button>}
        {isLast && <button className="btn" onClick={submit}>Отправить</button>}
      </div>
      <p className="muted">Нажимая «Отправить», вы сохраняете фамилию, вопросы, ответы, ключи, баллы и отметку в базу журнала.</p>
    </div>
  );
}
