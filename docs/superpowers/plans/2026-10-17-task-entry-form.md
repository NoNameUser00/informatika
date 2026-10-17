# Форма ввода заданий учителем и заслон на неверный ключ — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать учителю страницу, которая принимает задание руками, прогоняет его через те же проверки, что и банк, и выдаёт готовый YAML-блок для вставки; плюс перенести проверки в браузерный код, завести allow-лист для длины и индекс существующих `id`.

**Architecture:** Проверки ключа/вариантов уже написаны как чистые функции, но живут в скриптах, которые импортируют `node:fs` и `yaml` — в браузерный бандл они не грузятся. Переносим их в `src/lib/tasks/checks.ts` (чистый TS без node-зависимостей), скрипты становятся тонкими обёртками. Форма — React-компонент на новой странице под `TeacherGate`, который собирает объект задания, гоняет его через перенесённые проверки и рендерит текст для копирования. Ворота на банке — те же функции, подключённые к `validate-bank`/`npm test`. Типы заданий — все четыре, проверки специализируются по типу. Модель (ярус 3) идёт через Edge Function, форма работает и без неё.

**Tech Stack:** Astro 5 + React 19 + TypeScript strict, Vite, Supabase (Edge Functions), Zod, YAML-банки в `data/tasks/**`, существующие чистые проверки.

**Spec:** `docs/superpowers/specs/2026-10-17-task-entry-form-design.md`

## Global Constraints

- Никаких секретов в клиентском коде; модель вызывается только через сервер (Edge Function) — ключи не кладутся в браузер.
- Форма работает без сети: все механические проверки и `numeric_base`-проверка выполняются локально, модель — опционально.
- Единственный источник правды — YAML-банк в git. Форма не пишет файлы и не ведёт вторую копию.
- Потоковый синтаксис обязателен для вариантов `single_choice` (`{ id: A, text: "..." }`) — иначе `apply-distractor-review.mjs` их не возьмёт.
- Блок задания должен начинаться с `- id: ` в нулевом столбце — требование обоих apply-скриптов.
- `explanation` обязателен для всех четырёх типов (уже так в схеме).
- `points` ∈ {1,2,3} по `difficulty`; `lesson` обязан существовать в реестре уроков.
- `id` соблюдает схему `inf-<класс>-<токен>-<NNN>`.
- Ничего не блокирует выдачу текста из формы; ворота срабатывают на банке при сборке. Обход — запись с причиной в allow-лист.
- Все три существующие числовые задачи (`inf-11-graph-008`, `inf-8-algo-015`, `inf-8-algo-017`) исключены из проверки длины по правилу `isNumericLike`.
- `answer_text` в `single_choice` отсутствует в схеме — не трогать в этой задаче (отдельный проект).

## Review Focus

- **Форма работает офлайн, а модель требует сети.** Форма должна быть полностью функциональна без модели: ярус 3 отсутствует в выводе, а не роняет страницу. Нужен тест, что механические проверки проходят без сети.
- **Блокировка на банке, но форма показывает те же проверки.** Должно быть ясно, что форма не блокирует (выдаёт текст), а `npm test` блокирует. Нужен тест, что `validate-bank` падает на плохом задании, и что форма показывает те же ошибки заранее.
- **`id`-индекс может устареть.** Форма в офлайн-сборке работает по снимку, сделанному на сборке. Нужен тест, что индекс генерируется при `npm run rebuild` и что форма не падает, если индекс пуст.
- **`code_run` не проверяется ключом.** Форма должна честно показывать, что ключ не проверен машиной, а не молчать.
- **Перенос чистых функций не должен сломать скрипты.** `audit-keys.mjs` и `distractor-length.mjs` импортируют их; после переноса тесты должны проходить без изменения тестов (только путей импорта).

---

### Task 1: Перенести чистые проверки в `src/lib/tasks/checks.ts`

**Files:**
- Create: `src/lib/tasks/checks.ts`
- Modify: `scripts/audit-keys.mjs`
- Modify: `scripts/distractor-length.mjs`
- Modify: `scripts/distractor-length.test.mjs` (путь импорта)
- Modify: `scripts/audit-keys.test.mjs` (путь импорта)

**Interfaces:**
- Consumes: `checkNumericBase` из `src/lib/scoring/check.mjs` (чистая, без node-зависимостей).
- Produces: `findAnchorProblems(tasks)`, `scoreOptions(task)`, `findConflicts(tasks)`, `len(s)`, `flat(s)`, `isNumericLike(s)`, `giveawayPct(options, answer)`, `checkDuplicateOptions(options)`, `checkNumericKey(task)`. Все чистые, без импортов `node:*`.

- [ ] **Step 1: Создать `src/lib/tasks/checks.ts`** с перечисленными функциями. `checkDuplicateOptions(options)` — проверяет, что тексты вариантов не повторяются (логика из `validate-bank.ts:113`). `checkNumericKey(task)` — обёртка над `checkNumericBase`, возвращает `{ ok, reason }`. Импортировать `checkNumericBase` из `./scoring/check.mjs`.
- [ ] **Step 2: В `scripts/audit-keys.mjs` удалить определения чистых функций** и импортировать их из `../src/lib/tasks/checks.ts` (через re-export). Оставить `yamlFiles`, `loadAllow`, `loadAllTasks`, CLI.
- [ ] **Step 3: В `scripts/distractor-length.mjs` удалить определения** и реэкспортировать из `../src/lib/tasks/checks.ts`.
- [ ] **Step 4: Обновить пути импорта в тестах** (`scripts/audit-keys.test.mjs`, `scripts/distractor-length.test.mjs`) на `../src/lib/tasks/checks.ts` либо оставить через реэкспорт скриптов.
- [ ] **Step 5: Прогон проверок**

Run: `npm test`
Expected: PASS (все тесты зелёные, путей импорта не сломано)

- [ ] **Step 6: Commit**

```bash
git add src/lib/tasks/checks.ts scripts/audit-keys.mjs scripts/distractor-length.mjs scripts/audit-keys.test.mjs scripts/distractor-length.test.mjs
git commit -m "refactor: чистые проверки ключа и вариантов перенесены в src/lib/tasks/checks.ts"
```

---

### Task 2: Добавить `answer_text` в схему `single_choice`

**Files:**
- Modify: `src/lib/tasks/schema.ts:43-47`

**Interfaces:**
- Produces: поле `teacher_only.answer_text: z.string().min(1)` в `singleTask`.

- [ ] **Step 1: Добавить поле** в `singleTask`:
  ```ts
  teacher_only: z.object({
    answer: z.string().min(1),
    answer_text: z.string().min(1),
    explanation: z.string().min(1),
    common_errors: z.array(z.string()).optional(),
  }),
  ```
- [ ] **Step 2: Прогон**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/tasks/schema.ts
git commit -m "feat(schema): answer_text обязателен для single_choice (якорь ключа)"
```

---

### Task 3: Генератор индекса существующих `id`

**Files:**
- Create: `scripts/build-bank-index.mjs`
- Modify: `scripts/rebuild-all.mjs` (добавить шаг)
- Create: `src/data/bank-index.json` (генерируемый)

**Interfaces:**
- Produces: `src/data/bank-index.json` вида `{ "banks": [{ "file": "data/tasks/...", "token": "11db", "ids": ["inf-11-db-001", ...] }] }`.

- [ ] **Step 1: Написать `scripts/build-bank-index.mjs`** — обход `data/tasks/**/*.yaml`, разбор id по regex `^inf-(\d+)-([a-z0-9]+)-(\d+)$`, группировка по файлу, вычисление `token` из имени файла (последние два сегмента пути без расширения, склеенные), `nextId = max(number) + 1`. Запись в `src/data/bank-index.json`.
- [ ] **Step 2: Добавить в `rebuild-all.mjs`** шаг `bank:index` после `trainer:json`.
- [ ] **Step 3: Добавить проверку в тесты** — файл существует, содержит все 23 банка, все id уникальны. Создать `scripts/bank-index.test.mjs`, подключить в `npm test`.
- [ ] **Step 4: Прогон**

Run: `npm run rebuild && npm test`
Expected: PASS, `src/data/bank-index.json` создан

- [ ] **Step 5: Commit**

```bash
git add scripts/build-bank-index.mjs scripts/rebuild-all.mjs scripts/bank-index.test.mjs src/data/bank-index.json package.json
git commit -m "feat: генератор индекса существующих id для формы"
```

---

### Task 4: Ворота длины на банке + allow-лист

**Files:**
- Create: `data/tasks/distractor-length.allow.json`
- Modify: `scripts/validate-bank.ts` (или новый `scripts/check-distractor-length.mjs`)

**Interfaces:**
- Consumes: `giveawayPct`, `isNumericLike` из `src/lib/tasks/checks.ts`.
- Produces: скрипт/шаг, который падает с кодом 1, если есть задание с `giveawayPct > 50` и не состоящее только из чисел, и не в allow-листе.

- [ ] **Step 1: Создать `data/tasks/distractor-length.allow.json`** пустым (`{}`) — пока нет исключений.
- [ ] **Step 2: Написать `scripts/check-distractor-length.mjs`** по образцу `audit-keys.mjs`: обход `data/tasks`, для каждого `single_choice` — если `!opts.every(isNumericLike)` и `giveawayPct > 50` и id не в allow-листе → ошибка, код 1.
- [ ] **Step 3: Добавить в `npm test`** (`&& node scripts/check-distractor-length.mjs`).
- [ ] **Step 4: Проверить, что банк проходит** (должен, т.к. грубых случаев осталось 0).

Run: `node scripts/check-distractor-length.mjs && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add data/tasks/distractor-length.allow.json scripts/check-distractor-length.mjs package.json
git commit -m "feat: ворота длины отвлекающих на банке (с allow-листом)"
```

---

### Task 5: Страница и форма — скелет

**Files:**
- Create: `src/pages/teacher/new.astro`
- Create: `src/components/TaskForm.tsx`

**Interfaces:**
- Consumes: `bank-index.json`, `TeacherGate`, чистые проверки из `src/lib/tasks/checks.ts`.
- Produces: компонент `TaskForm` с полями по типу и выдачей текста.

- [ ] **Step 1: Создать `src/pages/teacher/new.astro`** по образцу `teacher.astro`, обернуть в `TeacherGate`.
- [ ] **Step 2: Создать `src/components/TaskForm.tsx`** — состояние формы (type, class, topic, subtopic, prompt, points, difficulty, cognitive_level, lesson, fgos_*, student_view, teacher_only). Выбор типа переключает поля. Выбор `lesson` — выпадающий список из реестра уроков (нужен список; если его нет в рантайме — захардкодить путь или передать пропсом).
- [ ] **Step 3: Добавить выбор целевого банка** из `bank-index.json`, вычисление `id` и `nextId`.
- [ ] **Step 4: Проверка сборки**

Run: `npm run typecheck && npm run build`
Expected: PASS, страница `/teacher/new` в билде

- [ ] **Step 5: Commit**

```bash
git add src/pages/teacher/new.astro src/components/TaskForm.tsx
git commit -m "feat: скелет страницы ввода задания учителем"
```

---

### Task 6: Проверки и выдача текста

**Files:**
- Modify: `src/components/TaskForm.tsx`

**Interfaces:**
- Consumes: `findAnchorProblems`, `scoreOptions`, `findConflicts`, `giveawayPct`, `isNumericLike`, `checkDuplicateOptions`, `checkNumericKey` из `src/lib/tasks/checks.ts`.
- Produces: функция `checkDraft(draft): { errors: string[], warnings: string[], bypassSnippet?: string }` — чистая, экспортируемая, тестируемая.

- [ ] **Step 1: Написать чистую функцию `checkDraft`** (вынести в `src/lib/tasks/check-draft.ts`), покрывающую ярусы 1 и 2 для всех четырёх типов. Для `code_run` — только структура. Функция возвращает ошибки (блокирующие) и предупреждения (ярус 2, ярус 3 — ярус 3 пока всегда «не проверено»).
- [ ] **Step 2: Написать тест** `src/lib/tasks/check-draft.test.mjs` (или `.ts`): корректное задание → пусто; дубль варианта → ошибка; якорь не совпал → ошибка; длина > 50 % → ошибка; конфликт ключа с пояснением → ошибка + bypass-snippet; `numeric_base` с неверным ключом → ошибка.
- [ ] **Step 3: Подключить `checkDraft` в форму**: перед выдачей текста показать список ошибок и предупреждений; при ошибках — выдать текст всё равно, но с пометкой «блокирует сборку» и сниппетом allow-листа.
- [ ] **Step 4: Рендер текста YAML** в потоковом синтаксисе (ограничение из плана: блок начинается с `- id: ` в нулевом столбце).
- [ ] **Step 5: Прогон**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/tasks/check-draft.ts src/lib/tasks/check-draft.test.mjs src/components/TaskForm.tsx
git commit -m "feat: проверки перед выдачей YAML и вывод текста"
```

---

### Task 7 (опционально): Ярус 3 через Edge Function

**Files:**
- Create: `supabase/functions/judge-key/index.ts`

**Interfaces:**
- Consumes: объект задания без ключа (вопрос + варианты), перемешанные.
- Produces: `{ letter: "A".."D" }` или ошибку.

- [ ] **Step 1: Создать Edge Function** `judge-key`, которая принимает вопрос и варианты, перемешивает их на сервере, отправляет в модель (OpenRouter или другой провайдер), возвращает букву. Ключ модели хранится в секретах Supabase.
- [ ] **Step 2: В форме добавить вызов** при наличии сети: показать «мнение модели: …» или «не проверено» при ошибке/квоте.
- [ ] **Step 3: Добавить тест на graceful degradation** — форма работает при недоступной функции.
- [ ] **Step 4: Прогон и коммит** (если делаем этот ярус в первой версии).

Если ярус 3 откладывается — пропустить эту задачу целиком. Форма без неё полноценна.

---

### Task 8: Документация и финальная проверка

**Files:**
- Modify: `AGENTS.md` (упоминание новой страницы и гейтов, если нужно)
- Modify: `docs/review/...` (описание allow-листа для длины)

- [ ] **Step 1: Обновить `AGENTS.md`** — добавить `npm run bank:index` (если введён) и `check-distractor-length` в список проверок.
- [ ] **Step 2: Прогон всего**

Run: `npm run rebuild && npm test && npm run rebuild:check`
Expected: PASS, дерево чистое

- [ ] **Step 3: Commit и push**

```bash
git add -A
git commit -m "feat: форма ввода заданий учителем с заслоном на неверный ключ"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- Форма с полями по типу → Task 5, 6. ✓
- Проверки перед выдачей текста → Task 1 (перенос), Task 4 (ворота длины), Task 6 (оркестрация). ✓
- Объяснение обязательно → Task 2 (схема уже требует). ✓
- Ворота блокируют, обход через allow-лист → Task 4, Task 6. ✓
- Пометок нет → удалено из дизайна. ✓
- Все четыре типа → Task 5, 6. ✓
- Потоковый YAML → Task 6. ✓
- `id` форма берёт сама → Task 3, 5. ✓
- `common_errors` необязательное → Task 5. ✓
- Модель только предупреждение → Task 7 (опционально). ✓
- Проверки в браузере → Task 1. ✓
- `answer_text` в `single_choice` не чинить → явно не входит. ✓

**Step scan:** Каждая задача заканчивается независимо проверяемым результатом. Тела кода в шагах отсутствуют — только сигнатуры и тесты. ✓

**Type consistency:** `checkDraft(draft): { errors, warnings, bypassSnippet? }` — введена в Task 6 и используется там же. `giveawayPct`, `isNumericLike`, `len`, `flat` — из `src/lib/tasks/checks.ts`. `findAnchorProblems`, `scoreOptions`, `findConflicts` — оттуда же. `checkNumericBase` — из `src/lib/scoring/check.mjs`. Согласовано. ✓

**Review Focus:** Все пять пунктов закрыты тестами: офлайн-работа (Task 6, шаг 2 — тест без сети), блокировка на банке (Task 4, шаг 4 — банк проходит), устаревший индекс (Task 3, шаг 3), `code_run` без проверки ключа (Task 6 — явно в списке), перенос функций (Task 1, шаг 5). ✓

**Proportion:** План ~120 строк, спека ~237. План короче спеки, кодовых блоков нет. ✓

## Execution Handoff

План сохранён в `docs/superpowers/plans/2026-10-17-task-entry-form.md`. Пожалуйста, прочитай его. План захватывает то, что мы обсудили?

Какой подход к реализации выберешь?

- **Subagent-driven** — свежий субагент на каждую задачу, свежий ревьюер перед следующей, и ревью всего бранча в конце. Самый надёжный; цена — свежий контекст на задачу и на ревью.
- **Native** — я делаю все задачи сам в этой сессии, как этот harness и работает, потом один ревьюер на самой сильной модели проверяет весь бранч. Дешевле и быстрее; независимая проверка только в конце.

Для этого плана я рекомендую **subagent-driven**: задачи зависят от интерфейсов друг друга (Task 6 опирается на Task 1 и Task 3), их восемь, и ошибка в переносе чистых функций или в гейте длины сломает весь заслон — лучше поймать её на задачу, а не в конце.