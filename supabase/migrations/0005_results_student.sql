-- Привязка работ к участникам классов (student_id из join_class).
-- Проверка контрольных/проверочных — только сервер (Edge Function submit-attempt):
-- баллы/ключи в строку пишет сервер, клиент ключей не видит и не присылает.
alter table results add column if not exists student_id uuid;
create index if not exists results_student_idx on results (student_id);
