import { useEffect, useState } from 'react';
import Board from './Board';
import { getRole, getToken, isAuthConfigured, type Role } from '../lib/auth/client';

// Учительская: журнал работ (фамилия + ответы + ключи + баллы + отметки).
// Источник: Supabase (когда настроен доступ teacher) + локальная очередь этого браузера.
// Выставление final_mark — следующий шаг (нужна авторизация учителя).
interface Row {
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
  needs_review?: boolean;
  filename?: string;
}

export default function Teacher() {
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState('Загрузка…');
  const [open, setOpen] = useState<number | null>(null);
  const [role, setRole] = useState<Role>('guest');

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
    const head = 'surname,firstname,class,test_type,test_code,score,max,percent,mark,filename';
    const lines = rows.map((r) =>
      [r.surname, r.firstname, r.class_name, r.test_type, r.test_code, r.auto_score, r.max_score, r.percent, r.proposed_mark, r.filename ?? '']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'vedomost.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <h1>Журнал работ</h1>
      {role !== 'teacher' && (
        <div className="card">
          <p><strong>Раздел учителя.</strong> Войди через Google/Яндекс и получи роль учителя (см. docs/auth-setup.md) — иначе видны только локальные строки этого браузера без отметок.</p>
        </div>
      )}
      <div className="card">
        <h2>Доска разборов</h2>
        <p className="muted">Нарисуй столбик деления, лесенку разрядов или блок-схему — сохрани картинкой и приложи к работе над ошибками.</p>
        <Board id="teacher-board" />
      </div>
      <p className="muted">{note}</p>
      {rows.length > 0 && <button className="btn secondary" onClick={csv}>Экспорт CSV</button>}
      {rows.map((r, i) => (
        <div className="card" key={i}>
          <p>
            <strong>{r.surname} {r.firstname}</strong>, {r.class_name} · {r.test_type} · {r.test_code}
            {' '}— <strong>{r.auto_score}/{r.max_score} ({r.percent}%) → {r.proposed_mark}</strong>
            {r.needs_review && <span className="bad"> · ждет проверки{r.filename ? `: ${r.filename}` : ''}</span>}
          </p>
          <button className="btn secondary" onClick={() => setOpen(open === i ? null : i)}>
            {open === i ? 'Скрыть ответы/ключи' : 'Ответы и ключи'}
          </button>
          {open === i && (
            <div>
              <p className="muted">Ответы: {JSON.stringify(r.answers)}</p>
              <p className="muted">Ключи: {JSON.stringify(r.keys)}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
