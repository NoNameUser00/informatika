-- Классы и вступление учеников: один многоразовый код на класс + привязка user_id.
-- Схема (см. ТЗ): учитель создаёт класс -> сервер выдаёт случайный код 6-8 символов;
-- ученик вводит код + ФИО -> сервер нормализует ФИО и возвращает student_id (uuid);
-- повторный вход с тем же ФИО+код -> тот же student_id; дубли подтверждает учитель.
-- Админ: роль 'admin', назначение учителя только через approve_teacher*().

-- 1. Роль admin (ограничение было только teacher/student).
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('teacher', 'student', 'admin'));

-- 2. Дефолт новичка — всегда student, явно (раньше — молча через default колонки).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'student');
  return new;
end;
$$;

-- 3. Нормализация ФИО: trim, ё->е, схлопывание пробелов, нижний регистр.
-- Единственное место нормализации (single source): клиент её НЕ делает.
create or replace function public.norm_fio(p_fio text)
returns text
language sql
stable
as $$
  select trim(regexp_replace(replace(lower(coalesce(p_fio, '')), 'ё', 'е'), '\s+', ' ', 'g'));
$$;

-- 4. Классы: один уникальный код на класс.
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 6 and 8),
  name text not null check (char_length(name) between 1 and 20),
  teacher_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists classes_teacher_idx on classes (teacher_id);

-- 5. Участники: внутренний student_id + нормализованное ФИО + привязка к auth.
-- Активных с одним norm_fio в классе может быть только один (частичный unique);
-- спорные вторые входы копятся со status='duplicate' — их разбирает учитель.
create table if not exists class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  student_id uuid not null default gen_random_uuid(),
  norm_fio text not null check (char_length(norm_fio) between 1 and 80),
  display_fio text not null check (char_length(display_fio) between 1 and 80),
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'duplicate')),
  created_at timestamptz not null default now()
);
create unique index if not exists class_members_active_uq
  on class_members (class_id, norm_fio) where status = 'active';
create index if not exists class_members_class_idx on class_members (class_id, status);
create index if not exists class_members_user_idx on class_members (user_id);

alter table classes enable row level security;
alter table class_members enable row level security;

-- 6. Хелперы ролей (вызываются внутри DEFINER-функций, RLS их не касается).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and (role = 'teacher' or role = 'admin')) $$;

-- 7. Создание класса учителем: код генерирует СЕРВЕР (безопасный алфавит без 0/O/1/I/L).
create or replace function public.create_class(p_name text)
returns table (id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_code text;
  v_id uuid;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if not public.is_teacher() then
    raise exception 'only teacher';
  end if;
  if char_length(v_name) not between 1 and 20 then
    raise exception 'bad name';
  end if;
  loop
    select string_agg(substr(alphabet, (floor(random() * char_length(alphabet)) + 1)::int, 1), '')
      into v_code from generate_series(1, 8);
    exit when not exists (select 1 from public.classes where classes.code = v_code);
  end loop;
  insert into public.classes (code, name, teacher_id)
  values (v_code, v_name, auth.uid())
  returning classes.id, classes.code into v_id, v_code;
  return query select v_id, v_code;
end;
$$;

-- 8. Вступление ученика по коду + ФИО. Работает и для anon (user_id останется NULL).
create or replace function public.join_class(p_code text, p_fio text)
returns table (student_id uuid, is_duplicate boolean, display_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_display text := trim(regexp_replace(coalesce(p_fio, ''), '\s+', ' ', 'g'));
  v_norm text := public.norm_fio(p_fio);
  v_class uuid;
  v_row public.class_members%rowtype;
  v_uid uuid := auth.uid();
begin
  if char_length(v_code) not between 6 and 8 then
    raise exception 'bad code';
  end if;
  if char_length(v_display) not between 1 and 80 or char_length(v_norm) < 1 then
    raise exception 'bad fio';
  end if;
  select c.id into v_class from public.classes c where c.code = v_code;
  if v_class is null then
    raise exception 'bad code';
  end if;
  select * into v_row from public.class_members m
   where m.class_id = v_class and m.norm_fio = v_norm and m.status = 'active';
  if v_row.id is not null then
    if v_row.user_id is null or v_row.user_id = v_uid or v_uid is null then
      -- Тот же ученик (или аноним): привязать uid, если появился, вернуть тот же student_id.
      if v_row.user_id is null and v_uid is not null then
        update public.class_members set user_id = v_uid where id = v_row.id;
      end if;
      return query select v_row.student_id, false, v_row.display_fio;
      return;
    end if;
    -- Другое устройство/аккаунт с тем же ФИО: спорная запись учителю.
    insert into public.class_members (class_id, norm_fio, display_fio, user_id, status)
    values (v_class, v_norm, v_display, v_uid, 'duplicate')
    returning class_members.student_id into v_row.student_id;
    return query select v_row.student_id, true, v_display;
    return;
  end if;
  insert into public.class_members (class_id, norm_fio, display_fio, user_id, status)
  values (v_class, v_norm, v_display, v_uid, 'active')
  returning class_members.student_id into v_row.student_id;
  return query select v_row.student_id, false, v_display;
end;
$$;

-- 9. Назначение учителя — только админ, только через функцию (клиентский UPDATE роли закрыт).
create or replace function public.approve_teacher(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only admin';
  end if;
  update public.profiles set role = 'teacher' where id = p_user_id;
  return found;
end;
$$;

create or replace function public.approve_teacher_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_uid uuid;
begin
  if not public.is_admin() then
    raise exception 'only admin';
  end if;
  select u.id into v_uid from auth.users u where lower(u.email) = v_email;
  if v_uid is null then
    raise exception 'unknown email';
  end if;
  update public.profiles set role = 'teacher' where id = v_uid;
  return v_uid;
end;
$$;

-- 10. Разбор дубля учителем своего класса (или админом): оставить keep, удалить drop.
create or replace function public.resolve_duplicate(p_keep uuid, p_drop uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class uuid;
begin
  select m.class_id into v_class from public.class_members m where m.student_id = p_drop and m.status = 'duplicate';
  if v_class is null then
    raise exception 'no such duplicate';
  end if;
  if not public.is_admin() and not exists (
    select 1 from public.classes c where c.id = v_class and c.teacher_id = auth.uid()
  ) then
    raise exception 'only class teacher';
  end if;
  if not exists (select 1 from public.class_members m where m.student_id = p_keep and m.class_id = v_class) then
    raise exception 'keep not in class';
  end if;
  delete from public.class_members where student_id = p_drop;
  return true;
end;
$$;

-- 11. RLS: прямых записей с клиента нет — только через функции выше.
-- Чтение: учитель — свои классы и их участники; админ — всё; ученик — свои строки.
drop policy if exists classes_select_own on classes;
create policy classes_select_own on classes
  for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin());

drop policy if exists class_members_select on class_members;
create policy class_members_select on class_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.classes c where c.id = class_members.class_id and c.teacher_id = auth.uid())
  );

revoke all on function public.norm_fio(text) from public;
grant execute on function public.norm_fio(text) to anon, authenticated;
revoke all on function public.create_class(text) from public;
grant execute on function public.create_class(text) to authenticated;
revoke all on function public.join_class(text, text) from public;
grant execute on function public.join_class(text, text) to anon, authenticated;
revoke all on function public.approve_teacher(uuid) from public;
grant execute on function public.approve_teacher(uuid) to authenticated;
revoke all on function public.approve_teacher_by_email(text) from public;
grant execute on function public.approve_teacher_by_email(text) to authenticated;
revoke all on function public.resolve_duplicate(uuid, uuid) from public;
grant execute on function public.resolve_duplicate(uuid, uuid) to authenticated;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.is_teacher() from public;
grant execute on function public.is_teacher() to authenticated;
