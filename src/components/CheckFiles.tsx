// Проверка файлов ответов (только учительская офлайн-сборка).
// Учитель загружает файлы учеников -> сверка хэша работы -> проверка
// теми же чекерами, что на сдаче -> таблица + аналитика + CSV.
// Ключи есть только в этой сборке; ученик их никогда не видит.
import { useEffect, useMemo, useState } from 'react';
import { statsForWork, taskCorrect } from '../lib/analytics/aggregate.mjs';
import { percentToMark } from '../lib/scoring/check.mjs';
import { findVariant } from '../lib/variants/resolve.mjs';
import { ANSWER_FORMAT, type AnswerFile } from '../lib/offline';
import HASHES from '../data/offline-hashes.json';
import Analytics from './Analytics';
import './check-files.css';

interface Graded {
  file: string;
  surname: string;
  firstname: string;
  class_name: string;
  test_code: string;
  variant: string;
  correct: number;
  questions: number;
  total: number;
  max: number;
  percent: number;
  mark: number;
  answers: Record<string, string>;
  keys: Record<string, string>;
  flags: Record<string, boolean>;
  /** code_run: Python в браузере тянется с CDN — офлайн не выполнить, вердикт ставит учитель вручную. */
  manual: Record<string, boolean>;
}

interface Rejected {
  file: string;
  reason: string;
}

function grade(bank: any, file: AnswerFile): Graded {
  const tasks: any[] = Array.isArray(bank.pool) ? bank.pool : (bank.tasks ?? []);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  // Вариант из файла должен существовать (для пуловых работ).
  if (Array.isArray(bank.variants)) {
    findVariant(bank, Number(file.variant));
  }
  let total = 0;
  let correct = 0;
  let max = 0;
  const keys: Record<string, string> = {};
  const flags: Record<string, boolean> = {};
  const manual: Record<string, boolean> = {};
  const ids = Object.keys(file.answers);
  for (const id of ids) {
    const t = byId.get(id);
    if (!t) continue;
    max += t.points;
    keys[id] = String(t.key ?? t.correct ?? t.expected ?? '');
    if (t.type === 'code_run') {
      manual[id] = true;
      flags[id] = false;
      continue;
    }
    const ok = !!taskCorrect(t, file.answers[id]);
    flags[id] = ok;
    if (ok) {
      total += t.points;
      correct++;
    }
  }
  total = Math.round(total * 100) / 100;
  const percent = max > 0 ? Math.round((total / max) * 1000) / 10 : 0;
  return {
    file: '', surname: file.surname, firstname: file.firstname, class_name: file.class_name,
    test_code: file.test_code, variant: file.variant,
    correct, questions: ids.filter((id) => byId.has(id)).length,
    total, max, percent, mark: percentToMark(percent),
    answers: file.answers, keys, flags, manual,
  };
}

export default function CheckFiles({ banks }: { banks: Record<string, any> }) {
  const [graded, setGraded] = useState<Graded[]>([]);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  // Ручные вердикты по code_run: индекс работы -> id задания -> верно?
  const [manualOk, setManualOk] = useState<Record<number, Record<string, boolean>>>({});
  // Печать ведомостей в PDF (через диалог печати).
  const [printJob, setPrintJob] = useState<null | { kind: 'students' | 'classes' | 'analytics' }>(null);

  useEffect(() => {
    if (!printJob) return;
    document.body.classList.add('cf-printing');
    const t = setTimeout(() => window.print(), 150);
    const done = () => {
      document.body.classList.remove('cf-printing');
      setPrintJob(null);
    };
    window.addEventListener('afterprint', done, { once: true });
    // Страховка, если afterprint не выстрелит (отмена диалога в некоторых WebView).
    const fallback = setTimeout(done, 30000);
    return () => {
      clearTimeout(t);
      clearTimeout(fallback);
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('cf-printing');
    };
  }, [printJob]);

  // Итоги с учётом ручных вердиктов.
  function eff(g: Graded, i: number): { correct: number; total: number; percent: number; mark: number; pending: number } {
    const ov = manualOk[i] ?? {};
    let correct = g.correct;
    let total = g.total;
    let pending = 0;
    for (const id of Object.keys(g.manual)) {
      if (ov[id] === undefined) {
        pending++;
        continue;
      }
      if (ov[id]) {
        correct++;
        const t = taskPoints(g.test_code, id);
        total += t;
      }
    }
    total = Math.round(total * 100) / 100;
    const percent = g.max > 0 ? Math.round((total / g.max) * 1000) / 10 : 0;
    return { correct, total, percent, mark: percentToMark(percent), pending };
  }

  // Баллы задания (нужны ручному вердикту).
  function taskPoints(testCode: string, id: string): number {
    const bank = banks[testCode];
    const tasks: any[] = Array.isArray(bank?.pool) ? bank.pool : (bank?.tasks ?? []);
    return tasks.find((t) => t.id === id)?.points ?? 0;
  }

  function bankTasks(testCode: string): any[] {
    const bank = banks[testCode];
    return Array.isArray(bank?.pool) ? bank.pool : (bank?.tasks ?? []);
  }

  function promptOf(testCode: string, id: string): string {
    return bankTasks(testCode).find((t) => t.id === id)?.prompt ?? id;
  }

  function flagOf(g: Graded, i: number, qid: string): boolean | null {
    if (g.manual[qid]) {
      const ov = (manualOk[i] ?? {})[qid];
      return ov === undefined ? null : ov === true;
    }
    return g.flags[qid] === true;
  }

  function workTitle(testCode: string): string {
    const b = banks[testCode];
    return b?.title ? `${b.title} (${testCode})` : testCode;
  }

  // Группы для печати: по работам, внутри — по классам, ученики по алфавиту.
  const printGroups = useMemo(() => {
    const byWork = new Map<string, number[]>();
    graded.forEach((g, i) => {
      const arr = byWork.get(g.test_code) ?? [];
      arr.push(i);
      byWork.set(g.test_code, arr);
    });
    return [...byWork.entries()].map(([testCode, idxs]) => {
      const byClass = new Map<string, number[]>();
      for (const i of idxs) {
        const arr = byClass.get(graded[i].class_name) ?? [];
        arr.push(i);
        byClass.set(graded[i].class_name, arr);
      }
      for (const arr of byClass.values()) {
        arr.sort((a, b) =>
          `${graded[a].surname} ${graded[a].firstname}`.localeCompare(`${graded[b].surname} ${graded[b].firstname}`, 'ru'),
        );
      }
      return { testCode, idxs, byClass: [...byClass.entries()] };
    });
  }, [graded]);

  async function onFiles(list: FileList | null) {
    if (!list) return;
    const ok: Graded[] = [...graded];
    const bad: Rejected[] = [];
    for (const f of [...list]) {
      try {
        const file = JSON.parse(await f.text()) as AnswerFile;
        if (file.format !== ANSWER_FORMAT) throw new Error('не файл ответов (нет метки формата)');
        const bank = banks[file.test_code];
        if (!bank) throw new Error(`неизвестная работа: ${file.test_code}`);
        const want = (HASHES as Record<string, string>)[file.test_code] ?? '';
        if (!file.bank_hash || (want && file.bank_hash !== want)) {
          throw new Error('хэш работы не сошёлся — файл от другой версии, проверять нельзя');
        }
        ok.push({ ...grade(bank, file), file: f.name });
      } catch (e) {
        bad.push({ file: f.name, reason: e instanceof Error ? e.message : String(e) });
      }
    }
    setGraded(ok);
    setRejected(bad);
  }

  const rows = useMemo(
    () =>
      graded.map((g, i) => {
        const e = eff(g, i);
        return {
          surname: g.surname, firstname: g.firstname, class_name: g.class_name,
          test_code: g.test_code, variant: g.variant,
          answers: g.answers, percent: e.percent, proposed_mark: e.mark,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graded, manualOk],
  );

  function csv() {
    const head = 'surname,firstname,class,test_code,variant,correct,questions,score,max,percent,mark,file';
    const lines = graded.map((g, i) => {
      const e = eff(g, i);
      return [g.surname, g.firstname, g.class_name, g.test_code, g.variant, e.correct, g.questions, e.total, g.max, e.percent, e.mark, g.file]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'offline-vedomost.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  return (
    <div>
      <div className="no-print">
      <div className="card">
        <h2>Файлы учеников</h2>
        <p className="muted">
          Загрузи файлы ответов (можно несколько сразу — с флешки, из почты, из сетевой папки).
          Каждый файл проверяется: формат, известная работа, хэш версии. Чужие файлы отклоняются с причиной.
        </p>
        <p>
          <input
            type="file"
            accept="application/json,.json"
            multiple
            onChange={(e) => void onFiles(e.target.files)}
            aria-label="Файлы ответов учеников"
          />
        </p>
        {graded.length > 0 && (
          <p>
            <button className="btn secondary" onClick={csv}>Экспорт CSV</button>{' '}
            <button className="btn secondary" onClick={() => setPrintJob({ kind: 'students' })}>PDF: по ученикам</button>{' '}
            <button className="btn secondary" onClick={() => setPrintJob({ kind: 'classes' })}>PDF: по классу</button>{' '}
            <button className="btn secondary" onClick={() => setPrintJob({ kind: 'analytics' })}>PDF: аналитика</button>
          </p>
        )}
      </div>
      {rejected.length > 0 && (
        <div className="card">
          <h2>Отклонено: {rejected.length}</h2>
          {rejected.map((r, i) => (
            <p key={i} className="muted"><strong>{r.file}</strong> — <span className="bad">{r.reason}</span></p>
          ))}
        </div>
      )}
      {graded.length > 0 && (
        <div className="card">
          <h2>Проверено: {graded.length}</h2>
          {graded.map((g, i) => {
            const e = eff(g, i);
            return (
            <div key={`${g.file}-${i}`}>
              <p>
                <strong>{g.surname} {g.firstname}</strong>, {g.class_name} · {g.test_code} · вариант {g.variant}
                {' '}— верно <strong>{e.correct} из {g.questions}</strong> · {e.total}/{g.max} ({e.percent}%) → <strong>{e.mark}</strong>
                {e.pending > 0 && <span className="bad"> · код вручную: {e.pending}</span>}{' '}
                <button className="btn secondary" onClick={() => setOpen(open === i ? null : i)}>
                  {open === i ? 'Скрыть разбор' : 'Разбор'}
                </button>
              </p>
              {open === i && (
                <div>
                  {Object.keys(g.answers).map((qid, qi) => {
                    const given = String(g.answers[qid] ?? '');
                    const key = g.keys[qid] ?? '';
                    const isManual = !!g.manual[qid];
                    const ov = (manualOk[i] ?? {})[qid];
                    const ok = isManual ? ov === true : g.flags[qid] === true;
                    return (
                      <p key={qid} className="muted">
                        <strong>Вопрос №{qi + 1}</strong> ({qid}) —{' '}
                        {isManual && ov === undefined ? (
                          <span className="bad">нужна проверка вручную</span>
                        ) : (
                          <span className={ok ? 'ok' : 'bad'}>{ok ? 'верно' : 'неверно'}</span>
                        )}
                        <br />Ответ: {given || '—'}
                        <br />Ключ: {key || '—'}
                        {isManual && (
                          <>
                            <br />
                            <button className="btn secondary" onClick={() => setManualOk({ ...manualOk, [i]: { ...(manualOk[i] ?? {}), [qid]: true } })}>
                              Засчитать
                            </button>{' '}
                            <button className="btn secondary" onClick={() => setManualOk({ ...manualOk, [i]: { ...(manualOk[i] ?? {}), [qid]: false } })}>
                              Не засчитать
                            </button>
                          </>
                        )}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
      {rows.length > 0 && <Analytics rows={rows} banks={banks} />}
      </div>
      {printJob && (
        <div className="cf-print">
          {printJob.kind === 'students' && printGroups.map((wg) => (
            <div key={wg.testCode}>
              {wg.idxs.map((i) => {
                const g = graded[i];
                const e = eff(g, i);
                return (
                  <div key={i} className="cf-sheet cf-page-break">
                    <h2>{workTitle(wg.testCode)} — лист ученика</h2>
                    <p>Ученик: <strong>{g.surname} {g.firstname}</strong> · Класс: <strong>{g.class_name}</strong> · Вариант: {g.variant}</p>
                    <table>
                      <thead>
                        <tr><th>№</th><th>Вопрос</th><th>Ответ ученика</th><th>Верно</th></tr>
                      </thead>
                      <tbody>
                        {Object.keys(g.answers).map((qid, qi) => {
                          const f = flagOf(g, i, qid);
                          return (
                            <tr key={qid}>
                              <td>{qi + 1}</td>
                              <td>{promptOf(wg.testCode, qid)}</td>
                              <td>{String(g.answers[qid] ?? '') || '—'}</td>
                              <td>{f === null ? 'на проверке' : f ? '+' : '−'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p>Верных ответов: <strong>{e.correct} из {g.questions}</strong> · Баллы: <strong>{e.total} из {g.max} ({e.percent}%)</strong> · Отметка: <strong>{e.mark}</strong></p>
                  </div>
                );
              })}
            </div>
          ))}
          {printJob.kind === 'classes' && printGroups.map((wg) => (
            <div key={wg.testCode}>
              {wg.byClass.map(([cls, idxs]) => (
                <div key={cls} className="cf-sheet cf-page-break">
                  <h2>{workTitle(wg.testCode)} — ведомость класса {cls}</h2>
                  <table>
                    <thead>
                      <tr><th>№</th><th>ФИО ученика</th><th>Баллы</th><th>Отметка</th></tr>
                    </thead>
                    <tbody>
                      {idxs.map((i, k) => {
                        const g = graded[i];
                        const e = eff(g, i);
                        return (
                          <tr key={i}>
                            <td>{k + 1}</td>
                            <td>{g.surname} {g.firstname}</td>
                            <td>{e.total} из {g.max} ({e.percent}%)</td>
                            <td>{e.mark}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))}
          {printJob.kind === 'analytics' && printGroups.map((wg) => {
            const st = statsForWork(
              wg.idxs.map((i) => ({ answers: graded[i].answers })),
              bankTasks(wg.testCode),
            );
            return (
              <div key={wg.testCode} className="cf-sheet cf-page-break">
                <h2>{workTitle(wg.testCode)} — аналитика для учителя</h2>
                <p>Работ проверено: {wg.idxs.length}</p>
                <h3>По вопросам</h3>
                <table>
                  <thead>
                    <tr><th>№</th><th>Вопрос</th><th>Верно</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    {st.perTask.map((q: any, qi: number) => (
                      <tr key={q.id}>
                        <td>{qi + 1}</td>
                        <td>{q.prompt.length > 120 ? q.prompt.slice(0, 120) + '…' : q.prompt}</td>
                        <td>{q.correct}/{q.n}</td>
                        <td>{q.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3>По темам</h3>
                <table>
                  <thead>
                    <tr><th>Тема (урок)</th><th>Верно</th><th>%</th><th>Уровень</th></tr>
                  </thead>
                  <tbody>
                    {st.perLesson.map((L: any) => (
                      <tr key={L.lesson}>
                        <td>{L.lesson}</td>
                        <td>{L.correct}/{L.n}</td>
                        <td>{L.pct}%</td>
                        <td>{L.level === 'ok' ? 'освоено' : L.level === 'shaky' ? 'шатко' : 'не освоено'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
