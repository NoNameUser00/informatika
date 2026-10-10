// Проверка файлов ответов (только учительская офлайн-сборка).
// Учитель загружает файлы учеников -> сверка хэша работы -> проверка
// теми же чекерами, что на сдаче -> таблица + аналитика + CSV.
// Ключи есть только в этой сборке; ученик их никогда не видит.
import { useMemo, useState } from 'react';
import { taskCorrect } from '../lib/analytics/aggregate.mjs';
import { percentToMark } from '../lib/scoring/check.mjs';
import { findVariant } from '../lib/variants/resolve.mjs';
import { ANSWER_FORMAT, type AnswerFile } from '../lib/offline';
import HASHES from '../data/offline-hashes.json';
import Analytics from './Analytics';

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
          <p><button className="btn secondary" onClick={csv}>Экспорт CSV</button></p>
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
  );
}
