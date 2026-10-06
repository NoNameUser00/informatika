-- Доступ к журналу по ролям. Принципы (см. AGENTS.md):
-- - ученик пишет свои работы, но НИКОГДА не читает keys (ни свои, ни чужие);
-- - свой итог (без ключей) ученик получает только через SECURITY DEFINER функцию;
-- - учитель читает всё и подтверждает отметки (final_mark).
-- Назначение учителя: UPDATE profiles SET role='teacher' WHERE id='<uuid>' (SQL, не клиент).

-- Привязываем работы к пользователю (старые анонимные строки остаются с user_id NULL).
alter table results add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists results_user_idx on results (user_id);

-- Вставка: anon как раньше (только с согласием); залогиненный — только за себя.
drop policy if exists results_insert_auth on results;
create policy results_insert_auth on results
  for insert to authenticated
  with check (consent = true and user_id = auth.uid());

-- Прямой SELECT с results закрыт для всех, кроме учителя (ученик идёт через функцию ниже).
drop policy if exists results_select_teacher on results;
create policy results_select_teacher on results
  for select to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'teacher'));

drop policy if exists results_update_teacher on results;
create policy results_update_teacher on results
  for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'teacher'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'teacher'));

-- Свой итог ученика БЕЗ ключей и чужих строк. Вызывается от своего имени,
-- выполняется с правами владельца (SECURITY DEFINER), фильтрует по auth.uid().
create or replace function public.my_results()
returns table (
  id uuid,
  created_at timestamptz,
  test_type text,
  test_code text,
  variant text,
  max_score numeric,
  percent numeric,
  proposed_mark int,
  final_mark int
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.created_at, r.test_type, r.test_code, r.variant,
         r.max_score, r.percent, r.proposed_mark, r.final_mark
  from public.results r
  where r.user_id = auth.uid()
  order by r.created_at desc
  limit 200;
$$;

revoke all on function public.my_results() from public;
grant execute on function public.my_results() to authenticated;
