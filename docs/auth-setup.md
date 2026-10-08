# Авторизация и роли: настройка (один раз, ~20 минут)

Сайт — статика на GitHub Pages, поэтому вся магия — в дашборде Supabase.
Без этих шагов кнопки входа показывают заглушку, а сайт работает как раньше
(гость: полный тренажёр; журнал — только локальная очередь).

## 1. Проект и ключи

1. Создай проект на supabase.com (пилот с ПДн — self-host по AGENTS.md, Cloud только с синтетикой!).
2. Примени миграции по порядку: `supabase/migrations/0001_results.sql`, `0002_profiles.sql`, `0003_roles_results.sql`, `0004_classes.sql`
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

## 4. Админ и назначение учителя (только SQL/функции, не клиентом!)

Прямой `update profiles set role` с клиента закрыт политикой `profiles_update_own`
(роль в `with check` обязана совпасть — поднять себе роль нельзя).

1. Первый админ — вручную SQL по id из Dashboard → Authentication → Users:

```sql
update profiles set role = 'admin' where id = '<uuid>';
```

2. Дальше админ назначает учителей из раздела «Мои классы» на `/teacher/`
   (поле «Админ» → почта учителя) — через функцию `approve_teacher_by_email()`.
   Остальные — ученики по умолчанию (триггер `handle_new_user`, роль всегда `student`).
   Себе для проверки заведи двух пользователей.

## 5. Проверка

- Гость (без входа): тренажёр как раньше, с ответами.
- Ученик: тихий режим — без «верно/неверно», без ключей и баллов; дальше не пускает,
  пока не отвечено всё; журнал — только свои итоги без ключей (функция `my_results()`).
- Учитель (`/teacher/`): полный журнал + ключи + подтверждение отметок.
- RLS-автотест: анонимный SELECT из `results` обязан вернуть 0 строк (политики deny-by-default).

## 6. Классы: коды и вступление учеников
1. Учитель жмёт «Создать класс» в «Моих классах» (`/teacher/`): **код генерирует сервер**
   (функция `create_class()`, случайные 8 символов без похожих 0/O/1/I/L) — не 1–100.
2. Ученик в шапке вводит код + «Фамилия Имя»: сервер (`join_class()`) нормализует ФИО
   (trim, ё→е, двойные пробелы, регистр — функция `norm_fio()`) и возвращает `student_id` (uuid).
3. Повторный вход с тем же ФИО+код — тот же `student_id` (привязка `user_id = auth.uid()`,
   как в `0003_roles_results.sql`). Другое устройство с тем же ФИО — спорная запись,
   её подтверждает учитель кнопкой «Оставить первое» (`resolve_duplicate()`).
4. Почта+пароль и телефон (OTP): панель «Почта / телефон» в шапке
   (`signUp`/`signInWithPassword` с `email.trim().toLowerCase()`, `signInWithOtp({phone})` + код).
5. Выдача варианта и проверка ответов — только сервер (раздел 7 ниже; банк — synced-копии в функции, не таблица).

## 7. Серверная проверка работ (Edge Function submit-attempt)

Страницы проверочных/контрольных грузят `*-public.json` БЕЗ ключей и считать сами не умеют.
Считает только сервер; ученику назад уходят итоги без ключей и без разбивки по вопросам.

1. Синхронизируй серверный бандл (чекеры + полные банки с ключами — только для сервера):
   `npm run edge:sync` (паритет проверяет `npm test` → `edge-sync.test.mjs`).
2. Задеплой функцию: `supabase functions deploy submit-attempt`
   (self-host: та же команда в свой проект; Cloud — аналогично).
3. Поведение:
   - бэкенд настроен → проверочная/контрольная уходит на сервер, баллы/ключи пишет он;
   - ученик видит «сохранено, отметку подтвердит учитель» (без баллов и ключей);
   - гость видит итог (баллы/отметка) без разбивки по вопросам;
   - бэкенда нет → ответы сохраняются локально без баллов, их выставит учитель;
   - тренажёры считают в клиенте как раньше (ключи тренажёра публичны by design).
