# RAG на run-llama/llama_index (Python-контур)

## Почему Python, а не TS

`run-llama/llama_index` — Python-репо. TS-фреймворк `LlamaIndexTS` заархивирован 30.04.2026,
поэтому RAG живёт в отдельном Python-контуре `backend/`, а фронт (Astro, GitHub Pages) остаётся статикой
и ходит к бэкенду по API. Это же соответствует правилу AGENTS.md «бэкенд — отдельный контур».

## Что индексируется

- `data/tasks/8/number-systems/bank.yaml` — только `student_view` (prompt, base, options...).
- `docs/spec-numbersystems.md` — методика и правила нормализации.

Никогда: `teacher_only` (ответы, разборы, ключи), ПДн/ФИО.

## Стек по умолчанию (self-host для пилота)

- Эмбеддинги: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (CPU, русский язык).
- LLM: Ollama (`LLM_MODEL=llama3.1`) — ответы генерируются локально.
- Персист: `backend/storage/` (file-режим) или Qdrant (см. ниже), gitignored.

Cloud (OpenAI / LlamaCloud / Qdrant Cloud / OpenRouter) — только для синтетических экспериментов, не для пилота с ПДн.

## Векторное хранилище: file vs Qdrant

- `VECTOR_STORE=file` — SimpleVectorStore в `backend/storage/`. Хватает на пилот (10 заданий + методика).
- `VECTOR_STORE=qdrant` — коллекция `QDRANT_COLLECTION` через `llama-index-vector-stores-qdrant`:
  - без `QDRANT_URL` — локальный файл `QDRANT_PATH`, сервер/docker не нужны;
  - с `QDRANT_URL` — self-host (`docker compose -f backend/docker-compose.yml up -d`, порты 6333/6334).
- Пересборка коллекции — `build_index.py --store qdrant` (старая коллекция удаляется).
- Что в векторах, те же гарантии: только `student_view`, тесты `test_qdrant_store.py` проверяют отсутствие teacher-маркеров в выдаче.

## Системный промпт помощника

Помощник объясняет теорию и шаги, опирается на найденное. Готовых ответов контрольной у него нет
(их нет и в индексе), выдумывать их запрещено — см. `SYSTEM_PROMPT` в `backend/src/rag_informatics/query.py`.

## Команды

См. `backend/README.md`. Проверка утечек: `python backend/tests/test_corpus.py`.
