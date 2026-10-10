import { useEffect, useState } from 'react';
import { getRole, isAuthConfigured, type Role } from '../lib/auth/client';
import { OFFLINE_TEACHER } from '../lib/offline';

// Гейт страницы учителя: пускает только teacher/admin по роли из profiles.
// Без настроенного бэкенда — демо-режим для проверки вёрстки (как раньше была заглушка).
// Исключение: локальная учительская сборка — это и есть инструмент учителя
// (ключи зашиты, чужих глаз нет), гейт не нужен.
const DEMO_KEY = 'teacher-demo-v1';

export default function TeacherGate({ children }: { children: React.ReactNode }) {
  const [configured] = useState(isAuthConfigured());
  const [role, setRole] = useState<Role | null>(null);
  const [demo, setDemo] = useState(false);

  if (OFFLINE_TEACHER) {
    return (
      <div>
        <p className="muted">Локальная учительская сборка: вход не нужен, данные — из загруженных файлов и этого компьютера.</p>
        {children}
      </div>
    );
  }

  useEffect(() => {
    if (!configured) return;
    try {
      if (localStorage.getItem(DEMO_KEY) === '1') {
        setDemo(true);
        return;
      }
    } catch { /* ignore */ }
    getRole().then((r) => setRole(r.role));
  }, [configured]);

  function enterDemo() {
    try {
      localStorage.setItem(DEMO_KEY, '1');
    } catch { /* приватный режим */ }
    setDemo(true);
  }

  function exitDemo() {
    try {
      localStorage.removeItem(DEMO_KEY);
    } catch { /* ignore */ }
    setDemo(false);
    setRole(null);
    getRole().then((r) => setRole(r.role));
  }

  if (!configured) {
    // Бэкенда нет: роль проверить нельзя. Для проверки вёрстки — демо-режим.
    if (!demo) {
      return (
        <div>
          <h1>Вход для учителя</h1>
          <div className="card">
            <p><strong>Страница только для учителя.</strong> Бэкенд не настроен, проверить роль нельзя.</p>
            <p><button className="btn" onClick={enterDemo}>Войти в демо-режим (проверка вёрстки)</button></p>
          </div>
        </div>
      );
    }
    return (
      <div>
        <p className="muted">Демо-режим: бэкенд не настроен, данные только локальные.</p>
        {children}
        <p><button className="btn secondary" onClick={exitDemo}>Выйти из демо-режима</button></p>
      </div>
    );
  }

  if (demo) {
    return (
      <div>
        <p className="muted">Демо-режим (проверка вёрстки).</p>
        {children}
        <p><button className="btn secondary" onClick={exitDemo}>Выйти из демо-режима</button></p>
      </div>
    );
  }

  if (role === null) {
    return (
      <div>
        <h1>Вход для учителя</h1>
        <div className="card"><p className="muted">Проверяю роль…</p></div>
      </div>
    );
  }

  if (role !== 'teacher' && role !== 'admin') {
    return (
      <div>
        <h1>Вход для учителя</h1>
        <div className="card">
          <p><strong>Страница только для учителя.</strong> Твоя роль: {role === 'student' ? 'ученик' : 'гость'}.</p>
          <p className="muted">Войди через Google/Яндекс (панель входа в шапке), получи роль учителя у админа — и возвращайся.</p>
        </div>
      </div>
    );
  }

  return <div>{children}</div>;
}
