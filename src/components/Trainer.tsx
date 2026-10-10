import { useEffect, useMemo, useState } from 'react';
import {
  checkMatching,
  checkNumericBase,
  checkSingleChoice,
  percentToMark,
} from '../lib/scoring/check.mjs';
import { saveQuietAttempt, saveResult } from '../lib/results';
import { getRole, getToken, isAuthConfigured, type Role } from '../lib/auth/client';
import { WORKS } from '../lib/analytics/works';
import { resolveWork } from '../lib/variants/resolve.mjs';
import DragMatch from './DragMatch';
import CodeRunner from './CodeRunner';
import Mascot, { type MascotMood } from './Mascot';
import './mascot.css';
import { OFFLINE_STUDENT, ANSWER_FORMAT, answerFileName, downloadJson, type AnswerFile } from '../lib/offline';
import HASHES from '../data/offline-hashes.json';

// Бипин в тренажёре:
// - тренажёр: радость/печаль по результату + похвала или «попробуй ещё»;
// - проверочная/контрольная: только итоговая отметка, без разбора по вопросам;
// - пустой ответ: напоминание (ошибку не считаем, дальше не пускаем);
// - «2» на проверке: Бипин обижается и молчит.
const TRAINER_PRAISE = [
  'Всё верно! Ты считаешь как компьютер.',
  'Отлично! Бип-бип — так держать.',
  'Точно! Ещё один бит в копилку.',
];

const TRAINER_TRY = [
  'Не всё сошлось. Разбери ключи ниже и попробуй ещё раз.',
  'Мимо в этот раз. Посмотри, где затык, и пройди заново.',
  'Пока не всё. Ошибки — это тоже данные. Разбери и повтори.',
];

const MARK_BUBBLE: Record<number, string> = {
  5: 'Отлично! Пять — ты звезда.',
  4: 'Хорошо! Четыре — почти всё сошлось.',
  3: 'Тройка. Разбери ошибки и добей тему.',
};

function markMood(mark: number): MascotMood {
  if (mark === 5) return 'wow';
  if (mark === 4) return 'happy';
  if (mark === 3) return 'sad';
  return 'angry';
}

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

export default function Trainer({ data, title, forceMode }: { data: any; title: string; forceMode?: Mode }) {
  const bank = data;
  // ФИО нужно для выбора варианта (детерминированно от фамилии), поэтому вариант
  // пересчитывается при вводе ФИО. Первый рендер — без ФИО, это вариант 1.
  const [seedName, setSeedName] = useState('');
  const [requestedVariant] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('v'),
  );
  const work = useMemo(() => {
    if (!bank || !Array.isArray(bank.variants)) return null;
    return resolveWork(bank, { requested: requestedVariant, seedText: seedName });
  }, [bank, seedName, requestedVariant]);
  // Тренажёры и старые работы — плоский список без вариантов.
  const tasks: any[] = work ? work.tasks : (bank?.tasks ?? []);
  const variantNumber = work ? work.number : (bank?.variant ?? 'v1');
  const variantCount = work ? (bank.variant_count ?? bank.variants.length) : 1;

  const [mode] = useState<Mode>(() => {
    if (forceMode) return forceMode;
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'proverka'
      ? 'proverka'
      : 'trainer';
  });
  // Роль: гость — как раньше (с ответами); ученик — тихо (без верно/неверно и ключей).
  // ?as= — только для локальной разработки без бэкенда (там нет секретов).
  const [role, setRole] = useState<Role>('guest');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('as');
    if (!isAuthConfigured() && (q === 'student' || q === 'teacher' || q === 'guest')) {
      setRole(q);
      return;
    }
    getRole().then((r) => setRole(r.role));
  }, []);
  const pages = useMemo<any[][]>(() => chunk(tasks, (bank as any).page_size ?? 5), [tasks]);
  const totalPages = pages.length + 1; // + страница с ФИО
  const [step, setStep] = useState(0);
  const [surname, setSurname] = useState('');
  const [firstname, setFirstname] = useState('');
  // Смена варианта сбрасывает заполненные ответы: они относятся к прежнему набору.
  useEffect(() => { setAnswers({}); setCodeVerdicts({}); setStep(0); setDone(null); setQuietDone(null); setFileSaved(null); }, [variantNumber]);
  const [classNum, setClassNum] = useState('');
  const [classLetter, setClassLetter] = useState('');
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [codeVerdicts, setCodeVerdicts] = useState<Record<string, boolean>>({});
  const [busySubmit, setBusySubmit] = useState(false);
  const [error, setError] = useState('');
  const [quietDone, setQuietDone] = useState<string | null>(null);
  // Ученическая офлайн-сборка: имя сохранённого файла ответов.
  const [fileSaved, setFileSaved] = useState<string | null>(null);
  const [done, setDone] = useState<null | {
    per: PerQ[];
    total: number;
    max: number;
    percent: number;
    mark: number;
    correct: number;
    questions: number;
    saveStatus: string;
    server: boolean;
  }>(null);
  // Банк проверочной/контрольной (ключи — только на сервере): сдача идёт в Edge Function.
  const serverEligible = typeof (bank as any).test_code === 'string' && (bank as any).test_code in WORKS;

  const max = useMemo(() => tasks.reduce((s: number, t: any) => s + t.points, 0), [tasks]);

  const setA = (id: string, v: Answer) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    setDone(null);
    setQuietDone(null);
    setFileSaved(null);
  };

  const isAnswered = (t: any): boolean => {
    const a = answers[t.id];
    // Ученическая офлайн-сборка: код без эталона не проверить — достаточно непустого кода.
    if (t.type === 'code_run') {
      if (OFFLINE_STUDENT) return a != null && String(a).trim() !== '';
      return a != null && String(a).trim() !== '' && codeVerdicts[t.id] !== undefined;
    }
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

  // Человеческий номер вопроса в тесте (1-based), вместо технического id.
  const qNum = (id: string): number => tasks.findIndex((t: any) => t.id === id) + 1;

  function next() {
    setError('');
    if (step === 0) {
      if (validPersonal()) setStep(1);
      return;
    }
    const missing = pages[step - 1].filter((t: any) => !isAnswered(t));
    if (missing.length > 0) {
      setError(`Ответьте на все вопросы страницы (не отвечен: Вопрос №${qNum(missing[0].id)}).`);
      document.getElementById(missing[0].id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setStep(step + 1);
  }

  /** Серверная сдача проверочной/контрольной: ответы уходят, назад — только итоги. */
  async function submitServer() {
    setBusySubmit(true);
    try {
      const url = import.meta.env.PUBLIC_SUPABASE_URL as string;
      const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;
      const token = await getToken();
      let studentId: string | undefined;
      try {
        const stored = JSON.parse(localStorage.getItem('student-id-v1') || 'null');
        if (stored?.student_id) studentId = stored.student_id;
      } catch { /* ignore */ }
      const plain: Record<string, string> = {};
      for (const t of tasks) {
        const a = answers[t.id];
        plain[t.id] = typeof a === 'string' ? a : JSON.stringify(a);
      }
      const testCode = String((bank as any).test_code);
      const res = await fetch(`${url.replace(/\/$/, '')}/functions/v1/submit-attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: key,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          surname: surname.trim(),
          firstname: firstname.trim(),
          class_name: `${classNum}-${classLetter}`,
          test_type: testCode.includes('control') ? 'control' : 'proverka',
          test_code: testCode,
          variant: String(variantNumber),
          answers: plain,
          student_id: studentId,
          consent,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(`Сервер не принял работу: ${body.error ?? res.status}. Ответы не потеряны — они на экране.`);
        return;
      }
      if (role === 'student') {
        setQuietDone('Ответы сохранены на сервере. Баллы и отметку подтвердит учитель — здесь их нет.');
      } else {
        setDone({ per: [], total: body.total, max: body.max, percent: body.percent, mark: body.mark, correct: body.correct ?? 0, questions: tasks.length, saveStatus: 'проверено сервером, сохранено в журнал', server: true });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusySubmit(false);
    }
  }

  async function submit() {
    setError('');
    const missing = pages[step - 1].filter((t: any) => !isAnswered(t));
    if (missing.length > 0) {
      setError(`Ответьте на все вопросы страницы (не отвечен: Вопрос №${qNum(missing[0].id)}).`);
      return;
    }
    // Ученическая офлайн-сборка: ключей нет, проверки нет — только файл ответов.
    if (OFFLINE_STUDENT) {
      const testCode = String((bank as any).test_code ?? 'work');
      const plain: Record<string, string> = {};
      for (const t of tasks) {
        const a = answers[t.id];
        plain[t.id] = typeof a === 'string' ? a : JSON.stringify(a);
      }
      const file: AnswerFile = {
        format: ANSWER_FORMAT,
        test_code: testCode,
        variant: String(variantNumber),
        bank_hash: (HASHES as Record<string, string>)[testCode] ?? '',
        surname: surname.trim(),
        firstname: firstname.trim(),
        class_name: `${classNum}-${classLetter}`,
        answers: plain,
        created_at: new Date().toISOString(),
      };
      const name = answerFileName(file);
      downloadJson(file, name);
      setFileSaved(name);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Проверочная/контрольная с бэкендом: считает только сервер (ключей в клиенте нет).
    if (serverEligible && isAuthConfigured()) {
      await submitServer();
      return;
    }
    // Без бэкенда работу без ключей не проверить — сохраняем ответы, баллы даст учитель.
    if (serverEligible) {
      const status = saveQuietAttempt({
        surname: surname.trim(),
        firstname: firstname.trim(),
        className: `${classNum}-${classLetter}`,
        testType: mode === 'proverka' ? 'proverka' : 'trainer',
        testCode: (bank as any).test_code,
        variant: String(variantNumber),
        tasks,
        answers: answers as Record<string, string | Record<string, string>>,
      });
      setQuietDone(`${status} Без бэкенда баллы не считаются — их выставит учитель.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Тихий режим ученика: только ответы, без подсчёта и ключей.
    if (role === 'student') {
      const status = saveQuietAttempt({
        surname: surname.trim(),
        firstname: firstname.trim(),
        className: `${classNum}-${classLetter}`,
        testType: mode === 'proverka' ? 'proverka' : 'trainer',
        testCode: (bank as any).test_code,
        variant: String(variantNumber),
        tasks,
        answers: answers as Record<string, string | Record<string, string>>,
      });
      setQuietDone(status);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const per: PerQ[] = tasks.map((t: any) => {
      const a = answers[t.id];
      if (t.type === 'numeric_base') {
        const r = checkNumericBase(t.expected, String(a), t.base);
        return { id: t.id, ok: r.isCorrect, score: r.isCorrect ? t.points : 0, max: t.points, given: String(a), key: t.key };
      }
      if (t.type === 'single_choice') {
        const r = checkSingleChoice(t.correct, String(a));
        return { id: t.id, ok: r.isCorrect, score: r.isCorrect ? t.points : 0, max: t.points, given: String(a), key: t.key };
      }
      if (t.type === 'code_run') {
        const ok = codeVerdicts[t.id] === true;
        const given = String(a ?? '').split('\n')[0];
        return { id: t.id, ok, score: ok ? t.points : 0, max: t.points, given, key: t.key };
      }
      const r = checkMatching(t.answerMap, a as Record<string, string>, t.points);
      const given = t.left.map((k: string) => `${k}=${(a as Record<string, string>)[k]}`).join(', ');
      return { id: t.id, ok: r.isCorrect, score: r.score, max: t.points, given, key: t.key };
    });
    const total = Math.round(per.reduce((s, p) => s + p.score, 0) * 100) / 100;
    const percent = Math.round((total / max) * 1000) / 10;
    const mark = percentToMark(percent);
    const keys: Record<string, string> = {};
    for (const t of tasks) keys[t.id] = t.key;
    const plainAnswers: Record<string, string> = {};
    for (const t of tasks) {
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
        variant: String(variantNumber),
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
    setDone({ per, total, max, percent, mark, correct: per.filter((p) => p.ok).length, questions: tasks.length, saveStatus, server: false });
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
          <DragMatch
            left={t.left}
            right={t.right}
            value={(answers[t.id] as Record<string, string>) ?? {}}
            onChange={(v) => setA(t.id, v)}
          />
        )}
        {t.type === 'code_run' && (
          <CodeRunner
            id={t.id}
            template={String(t.template ?? '')}
            expected={String(t.expected ?? '')}
            quiet={role === 'student'}
            onResult={(ok, code) => {
              setCodeVerdicts((m) => ({ ...m, [t.id]: ok }));
              setA(t.id, code);
            }}
          />
        )}
      </fieldset>
    );
  }

  if (fileSaved) {
    return (
      <div>
        <div className="mascot-row">
          <Mascot mood="happy" size={64} />
          <p className="mascot-say rb-say" key="file">Файл готов! Передай его учителю — он всё проверит.</p>
        </div>
        <div className="card">
          <h2>Ответы сохранены в файл</h2>
          <p>
            {surname} {firstname}, {classNum}-{classLetter} · {mode === 'proverka' ? 'проверочная' : 'тренажер'}
          </p>
          <p><strong>{fileSaved}</strong></p>
          <p className="muted">
            Передай файл учителю: по почте, на флешке или по локальной сети.
            Баллов и верных ответов здесь нет — их посчитает учитель.
            Если файл не скачался, нажми «Отправить» ещё раз.
          </p>
        </div>
        <button className="btn secondary" onClick={() => { setFileSaved(null); setAnswers({}); setCodeVerdicts({}); setStep(0); }}>
          Пройти заново
        </button>
      </div>
    );
  }

  if (quietDone) {
    return (
      <div>
        <div className="mascot-row">
          <Mascot mood="happy" size={56} />
          <p className="mascot-say rb-say" key="quiet">Ответы ушли учителю. Жди отметку — я держу за тебя кулачки.</p>
        </div>
        <div className="card">
          <h2>Ответы сохранены</h2>
          <p>
            {surname} {firstname}, {classNum}-{classLetter} · {mode === 'proverka' ? 'проверочная' : 'тренажер'}
          </p>
          <p className="muted">{quietDone}</p>
          <p className="muted">Здесь нет «верно/неверно», ключей и баллов — их знает только учитель.</p>
        </div>
        <button className="btn secondary" onClick={() => { setQuietDone(null); setAnswers({}); setCodeVerdicts({}); setStep(0); }}>
          Пройти заново
        </button>
      </div>
    );
  }

  if (done) {
    const isCheck = mode === 'proverka' || done.server;
    const mood = markMood(done.mark);
    const silent = isCheck && done.mark === 2;
    const wrong = done.questions - done.correct;
    const bubble = silent
      ? ''
      : isCheck
        ? (MARK_BUBBLE[done.mark] ?? MARK_BUBBLE[3])
        : done.mark >= 4
          ? TRAINER_PRAISE[done.total % TRAINER_PRAISE.length]
          : TRAINER_TRY[done.total % TRAINER_TRY.length];
    return (
      <div>
        <div className="mascot-row">
          <Mascot mood={mood} size={64} />
          {!silent && <p className="mascot-say rb-say" key={bubble}>{bubble}</p>}
        </div>
        <div className="card">
          <h2>Результат: {done.total} из {done.max} ({done.percent}%) — отметка {done.mark}</h2>
          <p>
            Верных ответов: <strong>{done.correct} из {done.questions}</strong> · ошибок: <strong>{wrong}</strong>
          </p>
          <p className="muted">
            Шкала: «5» — от 90%, «4» — от 75%, «3» — от 50%, иначе «2».
          </p>
          <p className="muted">
            {surname} {firstname}, {classNum}-{classLetter} · {mode === 'proverka' ? 'проверочная' : 'тренажер'} · {done.saveStatus}
          </p>
          {mode === 'proverka' && <p>Какие именно вопросы неверны — не показываем: работу посмотрит учитель и подтвердит отметку.</p>}
          {mode === 'trainer' && <p>Какие именно вопросы неверны — не показываем: найди ошибки сам и пройди ещё раз.</p>}
        </div>
        <button className="btn secondary" onClick={() => { setDone(null); setAnswers({}); setStep(0); }}>
          Пройти заново
        </button>
      </div>
    );
  }

  const isLast = step === pages.length;

  return (
    <div>
      <h1>{mode === 'proverka' ? `Проверочная: ${title}` : `Тренажер: ${title}`}</h1>
      <p className="muted">Страница {step + 1} из {totalPages}</p>
      {role === 'student' && (
        <p className="muted">Тихий режим ученика: отвечай на всё по порядку — «верно/неверно» скажет учитель.</p>
      )}

      {variantCount > 1 && (
        <p className="muted">
          Вариант {variantNumber} из {variantCount}.
          {requestedVariant === null
            ? ' Номер выбирается по фамилии — у одноклассников варианты разные. Учитель может раздать конкретный: ссылка вида «?v=7».'
            : ' Номер задан учителем.'}
        </p>
      )}

      {(() => {
        const emptyHint = /Ответьте|не отвечен|Заполните|Выберите|согласие/i.test(error);
        const m: MascotMood = emptyHint ? 'think' : 'happy';
        const b = emptyHint
          ? 'Сначала заполни всё на странице — пустые ответы я не проверяю.'
          : mode === 'proverka'
            ? 'Это проверка: отвечай внимательно, подсказок не будет.'
            : 'Отвечай на всё по порядку — в конце скажу, что верно.';
        return (
          <div className="mascot-row">
            <Mascot mood={m} size={56} />
            <p className="mascot-say rb-say" key={b}>{b}</p>
          </div>
        );
      })()}

      {step === 0 && (
        <div className="card">
          <label htmlFor="surname">ФИО ученика (Фамилия Имя): фамилия *</label>
          <input id="surname" type="text" value={surname} onChange={(e) => { setSurname(e.target.value); setSeedName(e.target.value); }} autoComplete="family-name" />
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

      {error && <p className="form-error" role="alert">{error}</p>}
      <div>
        {step > 0 && <button className="btn secondary" onClick={() => { setError(''); setStep(step - 1); }}>Назад</button>}
        <span> </span>
        {!isLast && <button className="btn" onClick={next}>Далее</button>}
        {isLast && <button className="btn" disabled={busySubmit} onClick={submit}>{busySubmit ? 'Отправляю…' : 'Отправить'}</button>}
      </div>
      <p className="muted">Нажимая «Отправить», вы сохраняете фамилию, вопросы, ответы, ключи, баллы и отметку в базу журнала.</p>
    </div>
  );
}
