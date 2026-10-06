-- Роли и профили: учитель / ученик. Ученик по умолчанию.
-- Учитель назначается вручную SQL (см. docs/auth-setup.md) — никакого самоназначения через клиент.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('teacher', 'student')),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Каждый читает/правит только свой профиль (роль через клиент не поднять:
-- update разрешён, но role менять запрещено политикой with check).
drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id AND role = (select role from profiles where id = auth.uid()));

-- Учитель читает все профили (списки класса).
drop policy if exists profiles_select_teacher on profiles;
create policy profiles_select_teacher on profiles
  for select to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'teacher'));

-- Автопрофиль при регистрации: роль всегда student.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
