import { useState } from 'react';

// ВРЕМЕННАЯ ЗАГЛУШКА входа учителя — только чтобы проверить страницу.
// Репозиторий с регистрацией/авторизацией подключат позже: тогда этот файл
// заменяется настоящим гейтом (проверка роли teacher на сервере).
// Доступ: страница /teacher/ видна только «вошедшему» через эту заглушку.
const KEY = 'teacher-stub-v1';

export function isStubTeacher(): boolean {
  try {
    return (localStorage.getItem(KEY) ?? '') !== '';
  } catch {
    return false;
  }
}

export default function TeacherGate({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState('');
  const [inStub, setInStub] = useState(isStubTeacher());

  function enter() {
    try {
      localStorage.setItem(KEY, name.trim() || 'учитель');
    } catch { /* приватный режим */ }
    setInStub(true);
  }

  function exit() {
    try {
      localStorage.removeItem(KEY);
    } catch { /* ignore */ }
    setInStub(false);
  }

  if (!inStub) {
    return (
      <div>
        <h1>Вход для учителя</h1>
        <div className="card">
          <p><strong>Страница только для учителя.</strong> Это временная заглушка для проверки (настоящая регистрация и авторизация подключаются отдельно).</p>
          <p>
            <label>Имя (любое):{' '}
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванова А.А." />
            </label>{' '}
            <button className="btn" onClick={enter}>Войти как учитель (заглушка)</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {children}
      <p><button className="btn secondary" onClick={exit}>Выйти (заглушка)</button></p>
    </div>
  );
}
