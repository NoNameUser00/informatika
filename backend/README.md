# RAG-бэкенд (Python, llama-index)

Серверный контур для RAG-помощника тренажёра. Фронтенд (Astro, GitHub Pages) сюда не ходит напрямую.

## Безопасность

- В индекс попадает только `student_view` + `docs/*.md`. `teacher_only` отрезается в `src/rag_informatics/corpus.py` (allowlist + `assert_no_teacher_markers`, тесты `tests/test_corpus.py`).
- Cloud-LLM — только с синтетикой. Пилот с ПДн — self-host (Ollama), см. `AGENTS.md`.
- Секреты — только в `.env` (не коммитится). Пример: `.env.example`.

## Запуск

```sh
# Python 3.12: qdrant-интеграция требует <3.14. Окружение: backend/.venv
# uv venv --python 3.12 backend/.venv && uv pip install --python backend/.venv/Scripts/python.exe -r backend/requirements.txt
cp backend/.env.example .env

python backend/scripts/build_index.py            # HF-эмбеддинги (скачаются один раз)
python backend/scripts/build_index.py --store qdrant   # Qdrant local-файл (backend/qdrant_data)
python backend/scripts/query_demo.py --query "Как переводить из десятичной в двоичную?"
python backend/scripts/query_demo.py --store qdrant --query "сложение в двоичной системе"
python backend/scripts/query_demo.py --with-llm  # требует запущенный Ollama + LLM_MODEL
```

Проверка без скачивания моделей:

```sh
python backend/scripts/build_index.py --embed mock
python backend/scripts/query_demo.py --embed mock
python backend/tests/test_corpus.py
python backend/tests/test_qdrant_store.py   # требует qdrant-client + llama-index-vector-stores-qdrant
```

## Qdrant: режимы

| Режим | Настройка | Когда |
|---|---|---|
| Qdrant local | `VECTOR_STORE=qdrant`, `QDRANT_URL` пусто | рост корпуса, без сервера/docker |
| Qdrant server | `QDRANT_URL=http://localhost:6333` (+`QDRANT_API_KEY`) | self-host: `docker compose -f backend/docker-compose.yml up -d` |
| Qdrant Cloud | `QDRANT_URL=https://...` | только синтетика, не пилот с ПДн |

## OpenRouter (cloud LLM, только синтетика)

```sh
$env:OPENROUTER_API_KEY="sk-or-..."   # в сессии; в репозиторий не писать
backend/.venv/Scripts/python.exe -c "
import os, sys; sys.path.insert(0, 'backend/src')
from rag_informatics.config import load_settings
from rag_informatics.openrouter import chat
print(chat(load_settings(), [{'role': 'user', 'content': 'Что такое двоичная система?'}]))"
```
