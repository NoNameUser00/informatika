// Панель входа: Google + Яндекс, показ роли, выход. Без бэкенда — ничего не рисует.
import { useEffect, useState } from 'react';
import { getRole, isAuthConfigured, signInGoogle, signInYandex, signOut, type Role } from '../lib/auth/client';

export function roleLabel(role: Role): string {
  if (role === 'teacher') return 'Учитель';
  if (role === 'student') return 'Ученик';
  return 'Гость';
}

export default function AuthPanel() {
  const [role, setRole] = useState<Role>('guest');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthConfigured()) return;
    getRole().then((r) => {
      setRole(r.role);
      setEmail(r.email);
    });
  }, []);

  if (!isAuthConfigured()) return null;

  async function go(fn: () => Promise<string | null>) {
    setError('');
    setBusy(true);
    const err = await fn();
    if (err) {
      setError(err);
      setBusy(false);
    }
    // успех — редирект на провайдера, страница перезагрузится сама
  }

  if (role !== 'guest') {
    return (
      <span className="auth-panel">
        {roleLabel(role)}{email ? ` · ${email}` : ''}{' '}
        <button type="button" className="auth-btn" onClick={() => void signOut().then(() => window.location.reload())}>
          Выйти
        </button>
      </span>
    );
  }

  return (
    <span className="auth-panel">
      <button type="button" className="auth-btn" disabled={busy} onClick={() => void go(signInGoogle)}>
        Войти через Google
      </button>{' '}
      <button type="button" className="auth-btn" disabled={busy} onClick={() => void go(signInYandex)}>
        Войти через Яндекс
      </button>
      {error && <span className="auth-error" role="alert"> {error}</span>}
    </span>
  );
}
