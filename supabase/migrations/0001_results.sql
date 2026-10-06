-- Журнал результатов: тесты, проверочные, контрольные.
-- Хранит: фамилию/имя/класс + вопросы(через test_code/variant) + ответы + ключи + баллы + отметки.
-- ПДн (152-ФЗ): минимум полей, consent обязателен, SELECT для anon закрыт.
-- Teacher-only (ключи) лежат здесь, а НЕ во фронтенде: ученик пишет INSERT, читает только свой итог.

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  surname text not null check (char_length(surname) between 1 and 80),
  firstname text not null check (char_length(firstname) between 1 and 80),
  class_name text not null check (char_length(class_name) between 1 and 20),
  test_type text not null check (test_type in ('trainer', 'proverka', 'practical', 'control')),
  test_code text not null,
  variant text not null,
  answers jsonb not null,
  keys jsonb not null,
  auto_score numeric not null,
  max_score numeric not null,
  percent numeric not null,
  proposed_mark int not null check (proposed_mark between 2 and 5),
  final_mark int null check (final_mark between 2 and 5),
  teacher_comment text not null default '',
  consent boolean not null default false,
  needs_review boolean not null default false,
  filename text not null default ''
);

create index if not exists results_class_idx on results (class_name, test_type, created_at);
create index if not exists results_test_idx on results (test_code, variant);

alter table results enable row level security;

-- Ученик (anon): только INSERT своих работ и только с согласием.
drop policy if exists results_insert_anon on results;
create policy results_insert_anon on results
  for insert to anon
  with check (consent = true);

-- Ученик не читает чужие работы и не видит ключи через этот контур.
-- Итог ученику отдает Edge Function (только его баллы/отметка, без чужих строк и без keys).

-- Учитель: чтение/подтверждение отметок — после настройки Supabase Auth.
-- Пример (адаптировать под реальные роли):
-- create policy results_select_teacher on results
--   for select to authenticated
--   using (auth.jwt() ->> 'role' = 'teacher');
-- create policy results_update_teacher on results
--   for update to authenticated
--   using (auth.jwt() ->> 'role' = 'teacher')
--   with check (auth.jwt() ->> 'role' = 'teacher');
