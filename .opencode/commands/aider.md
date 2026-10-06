---
description: Делегировать правки aider (AI pair-programming CLI)
---

Выполни задачу через aider CLI в неинтерактивном режиме:

1. Сформулируй конкретное задание из: $ARGUMENTS (укажи файлы, которые можно править).
2. Запусти в shell: `aider --message "<задание>" --yes-always --no-auto-commits` (модель/ключ — из окружения: `AIDER_MODEL`, `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`).
3. Проверь diff, запусти проверки проекта (`pnpm typecheck/test`, `python backend/tests/test_corpus.py`, `python backend/tests/test_qdrant_store.py` — что применимо), доложи результат.

Ограничения проекта (см. AGENTS.md):
- Не передавай в aider содержимое `teacher_only` (ответы/разборы контрольных) и ПДн — только тренажёр, методика и синтетика.
- Ключи API — только в окружении, никогда в репозиторий.
