# Авторизация и роли: настройка (один раз, ~20 минут)

Сайт — статика на GitHub Pages, поэтому вся магия — в дашборде Supabase.
Без этих шагов кнопки входа показывают заглушку, а сайт работает как раньше
(гость: полный тренажёр; журнал — только локальная очередь).

## 1. Проект и ключи

1. Создай проект на supabase.com (пилот с ПДн — self-host по AGENTS.md, Cloud только с синтетикой!).
2. Примени миграции по порядку: `supabase/migrations/0001_results.sql`, `0002_profiles.sql`, `0003_roles_results.sql`
   (SQL Editor → New query → вставить → Run, или `supabase db push`).
3. Скопируй `anon public` ключ и URL проекта в переменные окружения сборки:
   - локально: файл `.env` (НЕ коммитить!) — см. `.env.example`;
   - GitHub Pages: Settings → Secrets/Variables → Actions: переменная `PUBLIC_SUPABASE_URL`,
     секрет `PUBLIC_SUPABASE_ANON_KEY` (deploy.yml их уже подхватывает).

## 2. Google-вход (встроенный провайдер)

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web).
2. Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`.
3. Supabase Dashboard → Authentication → Sign In / Providers → Google → Enable,
   вставь Client ID + Client Secret.
4. Site URL: Authentication → URL Configuration → `https://NoNameUser00.github.io/informatika/`
   (+ `http://localhost:4321/informatika/` в Redirect URLs для локалки).

## 3. Яндекс-вход (Custom OIDC — Яндекс ID не входит в built-in список)

1. Создай приложение: https://oauth.yandex.ru → «Подключить API» → права `login:info`, `login:email`.
   Callback URL: `https://<project>.supabase.co/auth/v1/callback`.
2. Supabase Dashboard → Authentication → Sign In / Providers → пролистай вниз
   до Custom Providers → New Provider → OIDC.
3. Issuer URL — из `https://login.yandex.ru/.well-known/openid-configuration`
   (если discovery не подхватится — выбери OAuth2 и вбей endpoints вручную:
   authorize `https://oauth.yandex.ru/authorize`, token `https://oauth.yandex.ru/token`,
   userinfo `https://login.yandex.ru/info`). Client ID/Secret — из п.1.
4. Имя провайдера задай `yandex` → полный id получится `custom:yandex`
   (или своё — тогда положи его в `PUBLIC_YANDEX_PROVIDER`).
5. СНИЛС/почта: у части аккаунтов нет email — при создании провайдера включи
   `email_optional`, иначе такие входы будут отклоняться.

## 4. Назначение учителя (только SQL, не клиентом!)

```sql
update profiles set role = 'teacher' where id = '<uuid пользователя>';
```

UUID виден в Dashboard → Authentication → Users. Остальные — ученики по умолчанию
(триггер `handle_new_user`). Себе для проверки заведи двух пользователей.

## 5. Проверка

- Гость (без входа): тренажёр как раньше, с ответами.
- Ученик: тихий режим — без «верно/неверно», без ключей и баллов; дальше не пускает,
  пока не отвечено всё; журнал — только свои итоги без ключей (функция `my_results()`).
- Учитель (`/teacher/`): полный журнал + ключи + подтверждение отметок.
- RLS-автотест: анонимный SELECT из `results` обязан вернуть 0 строк (политики deny-by-default).
