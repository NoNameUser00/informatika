import { useState } from 'react';
import { joinClass, isBackend } from '../lib/auth/classes';

// Вступление ученика: код класса + ФИО. Без бэкенда — ничего не рисует.
// student_id сохраняется локально (student-id-v1) для привязки работ.
export default function ClassJoin() {
  const [code, setCode] = useState('');
  const [fio, setFio] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isBackend()) return null;

  async function go() {
    setMsg('');
    setBusy(true);
    try {
      const r = await joinClass(code, fio);
      setMsg(
        r.is_duplicate
          ? `Такое ФИО уже есть в классе. Записано как спорное (id ${r.student_id.slice(0, 8)}…) — покажи учителю.`
          : `Готово, ${r.display_name}! Твой id ${r.student_id.slice(0, 8)}… — с него сдавай работы.`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Не получилось вступить.');
    }
    setBusy(false);
  }

  return (
    <span className="auth-panel">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Код класса"
        aria-label="Код класса"
        style={{ width: 110 }}
      />{' '}
      <input
        value={fio}
        onChange={(e) => setFio(e.target.value)}
        placeholder="Фамилия Имя"
        aria-label="Фамилия Имя"
        style={{ width: 150 }}
      />{' '}
      <button type="button" className="auth-btn" disabled={busy} onClick={() => void go()}>
        Войти в класс
      </button>
      {msg && <span className="auth-error" role="status"> {msg}</span>}
    </span>
  );
}
