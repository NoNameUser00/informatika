# Информатика — школьный сайт (пилот: 8 класс, Системы счисления)

Два контура: учебный (тренажер, статика) + экзаменационный (Supabase, серверная проверка).

## Пилот
- Класс: 8
- Тема: Системы счисления — переводы 10↔2/8/16, арифметика, соответствие
- 10 заданий: 5 базовых x1б, 3 повышенных x2б, 2 высоких x3б = 17б макс.

Шкала по умолчанию (настраивается под локальный акт):
- 5: >=90% (>=16б), 4: >=75% (>=13б), 3: >=50% (>=9б), 2: <50%

## Структура
```text
AGENTS.md
README.md
data/tasks/8/number-systems/ — банк (YAML, teacher_only отделен)
src/lib/scoring/ — чистые функции проверки
src/lib/variants/ — генератор 30 вариантов (следующий этап)
docs/ — методика, приватность, ADR
supabase/ — миграции, функции, seed (следующий этап)
```

## Безопасность
- Ответы тренажера — в клиенте допустимо. Ответы контрольной — только сервер.
- Нет реальных ПДн. Только синтетика.
- См. AGENTS.md

## Ревью кода (OpenCodeReview)

- CLI `ocr` установлен глобально (`npm i -g @alibaba-group/open-code-review`); плагин OpenCode — `.opencode/plugins/open-code-review.ts` (команды `/ocr-review`, `/ocr-health`, грузятся автоматически).
- Безопасная команда (банк ответов и материалы учебников исключены):
  `ocr scan --preview --path src,backend/src,supabase --exclude '**/node_modules/*,data/tasks/*,material/*,dist/*,.astro/*'`
- Запрет: никогда не сканировать `data/tasks/**` (там `teacher_only`) и `material/**` — ответы и копирайт не уходят в LLM.
- Полноценный `ocr scan`/`review` требует git-репо и настроенного провайдера (`ocr config provider`); без ключей работает только `delegation` через свой агент.

## Дайджест для LLM (gitingest)

- `gitingest` стоит изолированно (`uv tool install gitingest`). Рецепт без утечек — только скриптом
  (в shell-команде glob-паттерны раскрываются и ломают вызов):
  `uv tool run --from gitingest python scripts/make-llm-digest.py`
- Исключены: `data/tasks/*` (teacher_only), `material/*` (копирайт), окружения/сборки/бинарники.
  Остаются ответы ТРЕНАЖЕРА (`src/data/*.json`) — они public-by-design; ответов контрольной в репо нет.

## Запуск тренажера (после `pnpm create astro`)

- `pnpm install`
- `pnpm dev`
- `pnpm test` — юнит-тесты скоринга
