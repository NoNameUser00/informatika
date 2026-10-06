// Supabase Auth: Google (встроенный провайдер) + Яндекс (Custom OIDC, см. docs/auth-setup.md).
// Без настроенного бэкенда (нет PUBLIC_SUPABASE_URL) — все функции no-op, сайт работает как раньше.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Role = 'teacher' | 'student' | 'guest';

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

/** Роль текущего пользователя: teacher/student по profiles, иначе guest (гость или бэкенда нет). */
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
  const role = profile?.role === 'teacher' ? 'teacher' : 'student';
  return { role, email: user.email ?? '' };
}

/** Access-токен для авторизованных запросов к журналу (null — гость). */
export async function getToken(): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.access_token ?? null;
}
