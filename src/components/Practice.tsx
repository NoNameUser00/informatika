import { useState } from 'react';
import { checkNumericBase, percentToMark } from '../lib/scoring/check.mjs';
import { saveResult } from '../lib/results';

// Практическая, урок 3: таблица переводов. Два способа сдачи:
// 1) заполнить таблицу онлайн; 2) скачать CSV-шаблон, заполнить, загрузить файл.
// .xlsx принимается как файл (проверяет учитель), .csv парсится и проверяется сразу.
const ROWS = [
  { n: '47', from: 10, to: 2, expected: 47, key: '101111' },
  { n: '101101', from: 2, to: 10, expected: 45, key: '45' },
  { n: '73', from: 8, to: 10, expected: 59, key: '59' },
  { n: '2F', from: 16, to: 2, expected: 47, key: '101111' },
  { n: '1101', from: 2, to: 8, expected: 13, key: '15' },
];
const MAX_FILE = 5 * 1024 * 1024;

export default function Practice() {
  const [surname, setSurname] = useState('');
  const [firstname, setFirstname] = useState('');
  const [classNum, setClassNum] = useState('');
  const [classLetter, setClassLetter] = useState('');
  const [consent, setConsent] = useState(false);
  const [cells, setCells] = useState<string[]>(Array(ROWS.length).fill(''));
  const [fileName, setFileName] = useState('');
  const [fileIsXlsx, setFileIsXlsx] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | { total: number; percent: number; mark: number; status: string }>(null);

  function template(): string {
    return 'number,from_base,to_base,answer\n' + ROWS.map((r) => `${r.n},${r.from},${r.to},`).join('\n') + '\n';
  }

  function download() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([template()], { type: 'text/csv;charset=utf-8' }));
    a.download = 'perevody_shablon.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onFile(f: File | undefined) {
    setError('');
    if (!f) return;
    if (f.size > MAX_FILE) {
      setError(`Файл больше 5 МБ (${Math.round(f.size / 1024)} КБ). Уменьшите или сдайте таблицу онлайн.`);
      return;
    }
    const low = f.name.toLowerCase();
    if (low.endsWith('.xlsx') || low.endsWith('.xls')) {
      setFileName(f.name);
      setFileIsXlsx(true);
      return;
    }
    if (!low.endsWith('.csv')) {
      setError('Нужен .csv или .xlsx. Шаблон — кнопкой выше.');
      return;
    }
    const text = await f.text();
    const lines = text.trim().split(/\r?\n/).slice(1, ROWS.length + 1);
    if (lines.length < ROWS.length) {
      setError(`В файле ${lines.length} строк, нужно ${ROWS.length}. Сравните с шаблоном.`);
      return;
    }
    const vals = lines.map((l) => (l.split(',')[3] ?? '').trim());
    setCells(vals);
    setFileName(f.name);
    setFileIsXlsx(false);
  }

  async function submit() {
    setError('');
    if (!surname.trim() || !firstname.trim()) {
      setError('Заполните фамилию и имя.');
      return;
    }
    if (!classNum || !classLetter) {
      setError('Выберите класс и букву класса.');
      return;
    }
    if (!consent) {
      setError('Нужно согласие на хранение работы в журнале.');
      return;
    }
    if (fileIsXlsx) {
      // Файл проверит учитель вручную
      let status = 'сохранено локально';
      try {
        status = await saveResult({
          surname: surname.trim(), firstname: firstname.trim(), class_name: `${classNum}-${classLetter}`,
          test_type: 'practical', test_code: 'numsys-practice-03', variant: 'table-v1',
          answers: { file: fileName }, keys: { note: 'проверка учителем' },
          auto_score: 0, max_score: ROWS.length, percent: 0, proposed_mark: 2,
          consent, needs_review: true, filename: fileName,
        });
      } catch { /* локальная копия уже сохранена */ }
      setDone({ total: 0, percent: 0, mark: 2, status: status + ' (ждет проверки учителем)' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (cells.some((c) => !c.trim())) {
      setError('Заполните все 5 строк таблицы (или загрузите CSV).');
      return;
    }
    let total = 0;
    const answers: Record<string, string> = {};
    const keys: Record<string, string> = {};
    ROWS.forEach((r, i) => {
      answers[`row${i + 1}`] = `${r.n}_${r.from} -> ${cells[i].trim()}`;
      keys[`row${i + 1}`] = r.key;
      if (checkNumericBase(r.expected, cells[i], r.to).isCorrect) total += 1;
    });
    const percent = Math.round((total / ROWS.length) * 1000) / 10;
    const mark = percentToMark(percent);
    let status = 'сохранено локально';
    try {
      status = await saveResult({
        surname: surname.trim(), firstname: firstname.trim(), class_name: `${classNum}-${classLetter}`,
        test_type: 'practical', test_code: 'numsys-practice-03', variant: 'table-v1',
        answers, keys, auto_score: total, max_score: ROWS.length, percent,
        proposed_mark: mark, consent, filename: fileName,
      });
    } catch { /* локальная копия уже сохранена */ }
    setDone({ total, percent, mark, status });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (done) {
    return (
      <div>
        <div className="card">
          <h2>Практика сдана: {done.total}/{ROWS.length} ({done.percent}%) — отметка {done.mark}</h2>
          <p className="muted">{surname} {firstname}, {classNum}-{classLetter} · {done.status}</p>
          {!fileIsXlsx && (
            <div>
              {ROWS.map((r, i) => {
                const ok = checkNumericBase(r.expected, cells[i], r.to).isCorrect;
                return (
                  <p key={i}><span className={ok ? 'ok' : 'bad'}>{ok ? 'верно' : 'неверно'}</span> {r.n}_{r.from} → {cells[i]} (правильно: {r.key})</p>
                );
              })}
            </div>
          )}
        </div>
        <button className="btn secondary" onClick={() => { setDone(null); setCells(Array(ROWS.length).fill('')); setFileName(''); setFileIsXlsx(false); }}>
          Сдать заново
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Практика: таблица переводов (урок 3)</h1>
      <p className="muted">Заполните таблицу онлайн или скачайте шаблон CSV, заполните и загрузите. Файл .xlsx тоже принимается — его проверит учитель.</p>
      <div className="card">
        <label htmlFor="surname">Фамилия *</label>
        <input id="surname" type="text" value={surname} onChange={(e) => setSurname(e.target.value)} />
        <label htmlFor="firstname">Имя *</label>
        <input id="firstname" type="text" value={firstname} onChange={(e) => setFirstname(e.target.value)} />
        <label htmlFor="klass">Класс *</label>
        <select id="klass" value={classNum} onChange={(e) => setClassNum(e.target.value)}>
          <option value="">— выбрать —</option>
          {['7', '8', '9', '10', '11'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label htmlFor="letter">Буква класса *</label>
        <select id="letter" value={classLetter} onChange={(e) => setClassLetter(e.target.value)}>
          <option value="">— выбрать —</option>
          {['Ю', 'Я', 'Ч', 'Ш', 'Э', 'У', 'Ф'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="radio-row">
          <input id="consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <label htmlFor="consent" style={{ margin: 0, fontWeight: 400 }}>Соглашаюсь на хранение работы в журнале</label>
        </div>
      </div>
      <div className="card">
        <button className="btn secondary" onClick={download}>Скачать шаблон CSV</button>
        <label htmlFor="file">Загрузить заполненный файл (.csv / .xlsx, до 5 МБ)</label>
        <input id="file" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => onFile(e.target.files?.[0])} />
        {fileName && <p className="muted">Файл: {fileName}{fileIsXlsx ? ' (проверит учитель)' : ' (разобран в таблицу)'}</p>}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Число</th><th>Из СС</th><th>В СС</th><th>Ответ</th></tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i}>
                <td>{r.n}</td><td>{r.from}</td><td>{r.to}</td>
                <td><input type="text" value={cells[i]} onChange={(e) => { const c = [...cells]; c[i] = e.target.value; setCells(c); }} aria-label={`Строка ${i + 1}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="bad" role="alert">{error}</p>}
      <button className="btn" onClick={submit}>Сдать работу</button>
    </div>
  );
}
