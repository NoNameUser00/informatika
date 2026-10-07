# Правила проекта — informatics-site

## Стек
- Astro + React + TypeScript strict
- Tailwind CSS
- Supabase: Postgres, Auth, Storage, Edge Functions (self-host в РФ для пилота с ПДн, Cloud — только с синтетикой)
- Фронтенд: GitHub Pages. Бэкенд: отдельный контур.
- Пакетный менеджер: pnpm, Node 20+

## Безопасность (критично)
- НИКОГДА не хранить ответы контрольных в клиентском коде / публичном репо / `src/content/tasks` для экзаменов.
- `teacher_only` (answer, explanation, rubric, keys) — только через серверные VIEW + SECURITY DEFINER FUNCTION, никогда прямым `select tasks`.
- RLS — построчный, колонки скрывать через VIEW для роли `student`.
- Никогда не коммитить `.env`, `service_role`, токены. Только `PUBLIC_*` + RLS.
- Нет реальных ФИО/ПДн в репо, чатах, seed. Только `student_001`, `class_8A`.
- Проверка ответов — только на сервере. Клиентская проверка — только для тренажера.
- `started_at/submitted_at`, подсчет баллов, выдача варианта — серверное время.
- Загрузка файлов: проверка MIME/расширения/размера, переименование, приватный бакет, signed URL.
- Код учеников — только в песочнице.

## Качество
- Перед коммитом: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- Каждый checker — чистые функции + unit-тесты (включая ё/е, пробелы, A-F латиница/кириллица, префиксы 0x/0b).
- Генератор вариантов — детерминированный seed (mulberry32/xoshiro + hash), property-тесты.
- Все API валидируют вход через Zod. Все миграции — через `supabase/migrations`.

## Методика (пилот: 8 класс, Системы счисления)
- Каждое задание: `id, class, topic, type, prompt, points, difficulty, cognitive_level, fgos_indicators, auto_check_config`.
- Разделение `student_view` / `teacher_view`.
- Шкала отметок — настраиваемая, итог подтверждает учитель (proposed_mark -> final_mark + audit).
- Типы пилота: `single_choice`, `numeric_base`, `matching`. Без субъективных текстов в контрольной.

## PDF-парсеры (запрет неработающего)
- НЕ использовать `firecrawl_parse` для PDF: нет API-ключа, hosted FaaS падает
  (`PDF parser FaaS call failed`). Считается отключенным для проекта.
- `read` — только текстовые PDF < 20 МБ (демо-главы, ФРП).
- Полные учебники 7–9 кл. — сканы без текстового слоя: только локально
  `pypdf`/`pdfplumber` (проверка слоя) + извлечение картинок страниц + чтение глазами.
- Уже разбито: `material/uchebniki/split/` + индекс `split/README.md`. Повторно не парсить.

## Доступность
- Клавиатура, labels, контраст WCAG AA, alt, понятные ошибки, автосохранение попытки.

## Языки программирования (строго)
- Паскаль НЕ используем нигде: ни в программировании, ни в алгоритмах, ни в примерах.
- Только Python и КуМир (исполнители: Черепаха, Робот, Чертёжник — как в учебнике).
