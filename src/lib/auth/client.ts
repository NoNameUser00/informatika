// Supabase Auth: Google (встроенный провайдер) + Яндекс (Custom OIDC, см. docs/auth-setup.md).
// Без настроенного бэкенда (нет PUBLIC_SUPABASE_URL) — все функции no-op, сайт работает как раньше.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Role = 'admin' | 'teacher' | 'student' | 'guest';

const URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const YANDEX_PROVIDER =
  (import.meta.env.PUBLIC_YANDEX_PROVIDER as string | undefined) || 'custom:yandex';

let client: SupabaseClient | null = null;

export function isAuthConfigured(): boolean {
  return Boolean(URL && KEY);
}

export function getClient(): SupabaseClient | null {
  if (!isAuthConfigured()) return null;
  if (!client) client = createClient(URL as string, KEY as string);
  return client;
}

export async function signInGoogle(): Promise<string | null> {
  const c = getClient();
  if (!c) return 'Бэкенд не настроен: вход отключён (см. docs/auth-setup.md).';
  const { error } = await c.auth.signInWithOAuth({ provider: 'google' });
  return error ? error.message : null;
}

export async function signInYandex(): Promise<string | null> {
  const c = getClient();
  if (!c) return 'Бэкенд не настроен: вход отключён (см. docs/auth-setup.md).';
  const { error } = await c.auth.signInWithOAuth({ provider: YANDEX_PROVIDER as 'google' });
  return error ? `Яндекс-вход недоступен: ${error.message} (проверь Custom OIDC в дашборде)`.slice(0, 200) : null;
}

export async function signOut(): Promise<void> {
  await getClient()?.auth.signOut();
}

/** Нормализация почты: trim + нижний регистр (как в prod-примерах GoTrue). */
export function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function signUpPassword(email: string, password: string): Promise<string | null> {
  const c = getClient();
  if (!c) return 'Бэкенд не настроен: вход отключён (см. docs/auth-setup.md).';
  const { error } = await c.auth.signUp({ email: normEmail(email), password });
  return error ? error.message : null;
}

export async function signInPassword(email: string, password: string): Promise<string | null> {
  const c = getClient();
  if (!c) return 'Бэкенд не настроен: вход отключён (см. docs/auth-setup.md).';
  const { error } = await c.auth.signInWithPassword({ email: normEmail(email), password });
  return error ? error.message : null;
}

/** Телефон в Supabase — не пароль, а OTP: сначала запросить код, потом проверить. */
export async function signInOtpPhone(phone: string): Promise<string | null> {
  const c = getClient();
  if (!c) return 'Бэкенд не настроен: вход отключён (см. docs/auth-setup.md).';
  const { error } = await c.auth.signInWithOtp({ phone: phone.trim() });
  return error ? error.message : null;
}

export async function verifyOtpPhone(phone: string, token: string): Promise<string | null> {
  const c = getClient();
  if (!c) return 'Бэкенд не настроен: вход отключён (см. docs/auth-setup.md).';
  const { error } = await c.auth.verifyOtp({ phone: phone.trim(), token: token.trim(), type: 'sms' });
  return error ? error.message : null;
}

/** Роль текущего пользователя по profiles (admin/teacher/student), иначе guest. */
export async function getRole(): Promise<{ role: Role; email: string }> {
  const c = getClient();
  if (!c) return { role: 'guest', email: '' };
  const { data } = await c.auth.getSession();
  const user = data.session?.user;
  if (!user) return { role: 'guest', email: '' };
  const { data: profile } = await c
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const r = profile?.role;
  const role: Role = r === 'admin' || r === 'teacher' || r === 'student' ? r : 'student';
  return { role, email: user.email ?? user.phone ?? '' };
}

/** Access-токен для авторизованных запросов к журналу (null — гость). */
export async function getToken(): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.access_token ?? null;
}
