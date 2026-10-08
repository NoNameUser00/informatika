// Панель входа: Google + Яндекс + почта/пароль + телефон (OTP). Без бэкенда — ничего не рисует.
import { useEffect, useState } from 'react';
import {
  getRole, isAuthConfigured, signInGoogle, signInYandex, signInPassword, signUpPassword,
  signInOtpPhone, signOut, verifyOtpPhone, type Role,
} from '../lib/auth/client';

export function roleLabel(role: Role): string {
  if (role === 'admin') return 'Админ';
  if (role === 'teacher') return 'Учитель';
  if (role === 'student') return 'Ученик';
  return 'Гость';
}

export default function AuthPanel() {
  const [role, setRole] = useState<Role>('guest');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [pass, setPass] = useState('');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  useEffect(() => {
    if (!isAuthConfigured()) return;
    getRole().then((r) => {
      setRole(r.role);
      setEmail(r.email);
    });
  }, []);

  if (!isAuthConfigured()) return null;

  async function go(fn: () => Promise<string | null>, reloadOnOk = false) {
    setError('');
    setBusy(true);
    const err = await fn();
    if (err) {
      setError(err);
      setBusy(false);
    } else if (reloadOnOk) {
      window.location.reload();
    }
    // OAuth-успех — редирект на провайдера, страница перезагрузится сама
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
      </button>{' '}
      <button type="button" className="auth-btn" disabled={busy} onClick={() => setShowMore(!showMore)}>
        {showMore ? 'Скрыть' : 'Почта / телефон'}
      </button>
      {error && <span className="auth-error" role="alert"> {error}</span>}
      {showMore && (
        <span>
          {' '}<input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Почта" aria-label="Почта" style={{ width: 150 }} />
          {' '}<input value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Пароль" type="password" aria-label="Пароль" style={{ width: 110 }} />
          {' '}<button type="button" className="auth-btn" disabled={busy} onClick={() => void go(() => signInPassword(email, pass), true)}>
            Войти
          </button>
          {' '}<button type="button" className="auth-btn" disabled={busy} onClick={() => void go(() => signUpPassword(email, pass), true)}>
            Регистрация
          </button>
          <br />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7…" aria-label="Телефон" style={{ width: 130 }} />
          {' '}<button type="button" className="auth-btn" disabled={busy} onClick={() => void go(async () => { const e = await signInOtpPhone(phone); if (!e) setOtpSent(true); return e; })}>
            Код по SMS
          </button>
          {otpSent && (
            <span>
              {' '}<input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Код" aria-label="Код из SMS" style={{ width: 80 }} />
              {' '}<button type="button" className="auth-btn" disabled={busy} onClick={() => void go(() => verifyOtpPhone(phone, otp), true)}>
                OK
              </button>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
