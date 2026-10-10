import { Component, useEffect, useState, type ReactNode } from 'react';
import Board from './Board';
import ErrorReview from './ErrorReview';
import Analytics from './Analytics';
import TeacherGate from './TeacherGate';
import ClassManager from './ClassManager';
import { getRole, getToken, isAuthConfigured, type Role } from '../lib/auth/client';
import { OFFLINE_TEACHER } from '../lib/offline';

// Учительская: журнал работ (фамилия + ответы + ключи + баллы + отметки).
// Источник: Supabase (когда настроен доступ teacher) + локальная очередь этого браузера.
// Подтверждение итога: proposed_mark -> final_mark + комментарий (в базу при её наличии, иначе локально).
interface Row {
  id?: string;
  created_at?: string;
  surname: string;
  firstname: string;
  class_name: string;
  test_type: string;
  test_code: string;
  variant: string;
  answers: Record<string, string>;
  keys: Record<string, string>;
  auto_score: number;
  max_score: number;
  percent: number;
  proposed_mark: number;
  final_mark?: number | null;
  teacher_comment?: string;
  needs_review?: boolean;
  filename?: string;
}

// Разбор ответов/ключей в читаемый вид: по вопросам, с верно/неверно.
// Значения бывают строками, а matching — JSON-объектом (иногда дважды
// закодированным). Строгое сравнение не годится: парсим и сравниваем глубоко.
function parseDeep(v: string): unknown {
  let cur: unknown = v;
  for (let i = 0; i < 3; i++) {
    if (typeof cur !== 'string') return cur;
    const t = cur.trim();
    if (!(t.startsWith('{') || t.startsWith('[') || t.startsWith('"'))) return cur;
    try {
      cur = JSON.parse(cur);
    } catch {
      return cur;
    }
  }
  return cur;
}

function prettyValue(v: string): string {
  const p = parseDeep(v);
  if (p !== null && typeof p === 'object') {
    if (Array.isArray(p)) return p.map((x) => String(x)).join(', ');
    return Object.entries(p as Record<string, unknown>)
      .map(([k, val]) => `${k} → ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`)
      .join('; ');
  }
  return String(p);
}

function sameAnswer(a: string, b: string): boolean {
  const pa = parseDeep(a);
  const pb = parseDeep(b);
  if (pa !== null && typeof pa === 'object' && pb !== null && typeof pb === 'object') {
    return JSON.stringify(pa) === JSON.stringify(pb);
  }
  return String(pa).trim().replace(/\s+/g, ' ') === String(pb).trim().replace(/\s+/g, ' ');
}

// Предохранитель: падение виджета (аналитика, доска) не должно гасить весь журнал.
class WidgetGuard extends Component<{ title: string; children: ReactNode }, { dead: boolean }> {
  state = { dead: false };
  static getDerivedStateFromError(): { dead: boolean } {
    return { dead: true };
  }
  render(): ReactNode {
    if (this.state.dead) {
      return (
        <div className="card">
          <p className="muted">{this.props.title} временно недоступен — журнал ниже работает. Сообщи учителю текст ошибки из консоли (F12).</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Teacher() {
  const [rows, setRows] = useState<Row[]>([]);
  const [remoteCount, setRemoteCount] = useState(0);
  const [note, setNote] = useState('Загрузка…');
  const [open, setOpen] = useState<number | null>(null);
  const [role, setRole] = useState<Role>('guest');
  // Фильтры журнала.
  const [classFilter, setClassFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  // Черновики подтверждения отметок: по индексу строки.
  const [draftMark, setDraftMark] = useState<Record<number, string>>({});
  const [draftComment, setDraftComment] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saveMsg, setSaveMsg] = useState<Record<number, string>>({});

  useEffect(() => {
    getRole().then((r) => setRole(r.role));
  }, []);

  useEffect(() => {
    (async () => {
      const local: Row[] = JSON.parse(localStorage.getItem('results-queue-v1') || '[]');
      const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
      const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
      // Журнал из базы — только учителю и только его токеном (RLS иначе не пустит).
      const r = await getRole().catch(() => ({ role: 'guest' as Role }));
      const token = r.role === 'teacher' ? await getToken() : null;
      if (url && key && token) {
        try {
          const res = await fetch(
            `${url.replace(/\/$/, '')}/rest/v1/results?select=*&order=created_at.desc&limit=200`,
            { headers: { apikey: key, Authorization: `Bearer ${token}` } },
          );
          if (res.ok) {
            const remote = (await res.json()) as Row[];
            setRows([...remote, ...local]);
            setRemoteCount(remote.length);
            setNote(`Строк: ${remote.length} из базы + ${local.length} локальных`);
            return;
          }
        } catch { /* fallback ниже */ }
      }
      setRows(local);
      setNote(
        local.length === 0
          ? 'Пока пусто: сдайте тренажер/практику в этом браузере или настройте Supabase (см. supabase/migrations/0001_results.sql).'
          : `Строк из локальной очереди: ${local.length}. Для общего журнала настройте Supabase + роль teacher.`,
      );
    })();
  }, []);

  function csv() {
    const head = 'surname,firstname,class,test_type,test_code,score,max,percent,proposed_mark,final_mark,teacher_comment,filename';
    const lines = rows.map((r) =>
      [r.surname, r.firstname, r.class_name, r.test_type, r.test_code, r.auto_score, r.max_score, r.percent, r.proposed_mark, r.final_mark ?? '', r.teacher_comment ?? '', r.filename ?? '']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'vedomost.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Подтверждение отметки: proposed_mark -> final_mark + комментарий.
  // Строка из базы (есть id) — UPDATE через REST (RLS пускает только teacher);
  // локальная строка — дописываем в очередь этого браузера.
  async function confirmMark(i: number) {
    const r = rows[i];
    const mark = Number(draftMark[i] ?? r.proposed_mark);
    if (![2, 3, 4, 5].includes(mark)) {
      setSaveMsg({ ...saveMsg, [i]: 'Отметка — число от 2 до 5.' });
      return;
    }
    const comment = (draftComment[i] ?? r.teacher_comment ?? '').slice(0, 500);
    setSaving({ ...saving, [i]: true });
    setSaveMsg({ ...saveMsg, [i]: '' });
    try {
      const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
      const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
      if (r.id && url && key && (role === 'teacher' || role === 'admin')) {
        const token = await getToken();
        if (!token) throw new Error('нет токена');
        const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/results?id=eq.${r.id}`, {
          method: 'PATCH',
          headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ final_mark: mark, teacher_comment: comment }),
        });
        if (!res.ok) throw new Error(`сервер: ${res.status}`);
        setRows(rows.map((x, j) => (j === i ? { ...x, final_mark: mark, teacher_comment: comment } : x)));
        setSaveMsg({ ...saveMsg, [i]: 'Подтверждено в базе.' });
      } else {
        // Локальная очередь: индекс внутри неё = общий индекс минус строки из базы.
        const raw = localStorage.getItem('results-queue-v1');
        const arr = raw ? (JSON.parse(raw) as Row[]) : [];
        const li = i - remoteCount;
        if (li < 0 || li >= arr.length) throw new Error('строка не найдена локально');
        arr[li] = { ...arr[li], final_mark: mark, teacher_comment: comment };
        localStorage.setItem('results-queue-v1', JSON.stringify(arr));
        setRows(rows.map((x, j) => (j === i ? { ...x, final_mark: mark, teacher_comment: comment } : x)));
        setSaveMsg({ ...saveMsg, [i]: 'Подтверждено локально.' });
      }
    } catch (e) {
      setSaveMsg({ ...saveMsg, [i]: `Не сохранено: ${e instanceof Error ? e.message : e}` });
    } finally {
      setSaving({ ...saving, [i]: false });
    }
  }

  const classNames = [...new Set(rows.map((r) => r.class_name))].sort();
  const testTypes = [...new Set(rows.map((r) => r.test_type))].sort();
  const pendingCount = rows.filter((r) => r.final_mark == null).length;
  const visible = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => (!classFilter || r.class_name === classFilter) && (!typeFilter || r.test_type === typeFilter) && (!onlyPending || r.final_mark == null));

  return (
    <TeacherGate>
    <div>
      <h1>Журнал работ</h1>
      {OFFLINE_TEACHER && (
        <div className="card">
          <p>
            <a className="btn" href={`${import.meta.env.BASE_URL}teacher/check-files/`}>Загрузить работы учеников →</a>
          </p>
          <p className="muted">Выбери файлы ответов с флешки, из почты или сетевой папки — ответы и отметки посчитаются на этом компьютере.</p>
        </div>
      )}
      <p className="muted">
        <a href={`${import.meta.env.BASE_URL}teacher/practices/`}>Методичка: практические работы — что проверять</a>
      </p>
      {role !== 'teacher' && role !== 'admin' && (
        <details className="card">
          <summary><strong>Справка: почему журнал ограничен</strong></summary>
          <p className="muted">
            Раздел учителя. Войди через Google/Яндекс и получи роль учителя —
            иначе видны только локальные строки этого браузера без отметок.
            Роль выдаёт администратор после первого входа.
          </p>
        </details>
      )}
      <WidgetGuard title="Аналитика">
        <Analytics rows={rows} />
      </WidgetGuard>
      {isAuthConfigured() && <ClassManager role={role} />}
      <div className="card">
        <h2>Фильтры</h2>
        <p className="muted">Всего строк: {rows.length} · ждут подтверждения: {pendingCount}</p>
        <div className="radio-row">
          <label htmlFor="f-class">Класс</label>
          <select id="f-class" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">все</option>
            {classNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label htmlFor="f-type">Тип</label>
          <select id="f-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">все</option>
            {testTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input id="f-pending" type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
          <label htmlFor="f-pending" style={{ margin: 0, fontWeight: 400 }}>только без итоговой отметки</label>
        </div>
      </div>
      <WidgetGuard title="Доска разборов">
        <div className="card">
          <h2>Доска разборов</h2>
          <p className="muted">Нарисуй столбик деления, лесенку разрядов или блок-схему — сохрани картинкой и приложи к работе над ошибками.</p>
          <Board id="teacher-board" />
        </div>
      </WidgetGuard>
      <ErrorReview />
      <p className="muted">{note}</p>
      {rows.length > 0 && <button className="btn secondary" onClick={csv}>Экспорт CSV</button>}
      {visible.map(({ r, i }) => {
        const confirmed = r.final_mark != null;
        return (
        <div className="card" key={r.id ?? `local-${i}`}>
          <p>
            <strong>{r.surname} {r.firstname}</strong>, {r.class_name} · {r.test_type} · {r.test_code}
            {' '}— <strong>{r.auto_score}/{r.max_score} ({r.percent}%) → {confirmed ? r.final_mark : r.proposed_mark}</strong>
            {confirmed
              ? <span className="ok"> · итог подтверждён{r.teacher_comment ? `: ${r.teacher_comment}` : ''}</span>
              : <span className="bad"> · ждёт подтверждения</span>}
            {r.needs_review && <span className="bad"> · ждет проверки{r.filename ? `: ${r.filename}` : ''}</span>}
          </p>
          <button className="btn secondary" onClick={() => setOpen(open === i ? null : i)}>
            {open === i ? 'Скрыть ответы/ключи' : 'Ответы и ключи'}
          </button>
          {open === i && (
            <div>
              {Object.keys(r.answers ?? {}).map((qid, qi) => {
                const given = String((r.answers as Record<string, string>)[qid] ?? '');
                const key = String((r.keys as Record<string, string>)?.[qid] ?? '');
                const ok = key !== '' && sameAnswer(given, key);
                return (
                  <p key={qid} className="muted">
                    <strong>Вопрос №{qi + 1}</strong>
                    {' '}— <span className={ok ? 'ok' : 'bad'}>{ok ? 'верно' : 'неверно'}</span>
                    <br />Ответ ученика: {prettyValue(given) || '—'}
                    {key !== '' && <><br />Ключ: {prettyValue(key)}</>}
                  </p>
                );
              })}
              {Object.keys(r.answers ?? {}).length === 0 && (
                <p className="muted">Ответов нет.</p>
              )}
            </div>
          )}
          <div className="radio-row">
            <label htmlFor={`fm-${i}`}>Итоговая отметка</label>
            <select
              id={`fm-${i}`}
              value={draftMark[i] ?? String(r.final_mark ?? r.proposed_mark)}
              onChange={(e) => setDraftMark({ ...draftMark, [i]: e.target.value })}
            >
              {[5, 4, 3, 2].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              type="text"
              placeholder="комментарий (необязательно)"
              maxLength={500}
              value={draftComment[i] ?? r.teacher_comment ?? ''}
              onChange={(e) => setDraftComment({ ...draftComment, [i]: e.target.value })}
              aria-label="Комментарий учителя"
            />
            <button className="btn secondary" disabled={!!saving[i]} onClick={() => confirmMark(i)}>
              {saving[i] ? 'Сохраняю…' : confirmed ? 'Изменить итог' : 'Подтвердить итог'}
            </button>
          </div>
          {saveMsg[i] && <p className="muted" role="status">{saveMsg[i]}</p>}
        </div>
        );
      })}
    </div>
    </TeacherGate>
  );
}
