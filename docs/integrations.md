# Реестр внешних репозиториев (все сессии, включая закрытые)

Статус на 2026-10-07. Легенда: ✅ подключён · 🔍 только паттерны/референс · ⏸ отложен · ❌ отклонён.

## Подключены

| Репозиторий | Что делает | Как используем |
|---|---|---|
| https://github.com/run-llama/llama_index ✅ | Python RAG-фреймворк (индексация, retrieval, агенты) | Ядро `backend/` (core 0.14.25 в `backend/.venv`) |
| https://github.com/qdrant/qdrant ✅ | Векторная СУБД и поиск (Rust) | Хранилище индекса (`qdrant_store.py`: local-файл / server) |
| https://github.com/Aider-AI/aider ✅ | AI pair-programming CLI | Установлен (uv, 0.86.2); команда `/aider` (`.opencode/commands/aider.md`) |
| https://github.com/alibaba/open-code-review ✅ | AI-ревью кода (diff/scan, deterministic+LLM) | CLI `ocr` + плагин (`.opencode/plugins/`); только `scan`, без `data/tasks` |
| https://github.com/coderamp-labs/gitingest ✅ | Упаковка репо в дайджест для LLM | Установлен (uv); рецепт `scripts/make-llm-digest.py` с исключениями |
| https://github.com/calesthio/OpenMontage ✅ | Агентный видеопродакшн (12 пайплайнов) | Клон `D:\openmontage`; контур роликов, бриф `docs/video-numbersystems.md` |
| https://github.com/ManimCommunity/manim ✅ | Движок матанимаций (3Blue1Brown-стиль), MIT | Клон `D:\manim` + venv; сцены `dec_episode.py`, критерии приёмки в брифе |
| https://github.com/heygen-com/hyperframes ✅ | HTML→MP4 титры/моушн (Apache-2.0) | Проект `hf-title`, титр эпизода отрендерен |
| https://github.com/rhasspy/piper-voices ✅ | Голоса TTS (ONNX), MIT | `ru_RU-dmitri-medium` скачан; озвучка эпизода (46 с) |
| https://github.com/pyodide/pyodide ✅ | Python в браузере (WASM), MPL-2.0 | Рантайм `PyRunner`/`BlocklyRunner` с CDN (немодифицированный) |
| https://github.com/clauderic/dnd-kit ✅ | Drag-and-drop для React (a11y), MIT | npm-пакет; `DragMatch` для всех `type: matching` |
| https://github.com/google/blockly ✅ | Блочное программирование, Apache-2.0 | npm-пакет 13.3.0 (RU-тулбокс); `BlocklyRunner` → Python → Pyodide |
| https://github.com/excalidraw/excalidraw ✅ | Встраиваемая доска, MIT | npm-пакет 0.18.1; `Board` на странице учителя (динамический импорт!) |
| https://github.com/phetsims 🔍 | Эталонные HTML5-симуляции | Паттерны + MIT-библиотеки; код симов GPL-3.0 — не копировать |
| https://github.com/THU-MAIC/OpenMAIC 🔍 | AI-класс: слайды/квизы/симуляции | Паттерны сцен (`docs/interactive-sims.md`); клон `D:\openmaic` |

## Оценены, не подключены

| Репозиторий | Причина |
|---|---|
| https://github.com/run-llama/LlamaIndexTS ❌ | TS-фреймворк заархивирован 30.04.2026 — взят Python вместо него |
| https://github.com/deepset-ai/haystack ❌ | Прямой дубль llama-index |
| https://github.com/microsoft/autogen ❌ | Не нужна мультиагентность + репо в maintenance |
| https://github.com/MakazhanAlpamys/Soup ❌ | Файнтюн: нет датасета и GPU |
| https://github.com/littledivy/mimic ❌ | Реверс чужих API — комплаенс пилота |
| https://github.com/Comfy-Org/ComfyUI ⏸ | Нет дискретного GPU; wiring (`.env`) готов, триггер в брифе |
| https://github.com/diegosouzapw/OmniRoute ⏸ | Только личные dev-задачи (не в контур); правило: без teacher_only/ПДн |
| https://github.com/decolua/9router ⏸ | То же, что OmniRoute |
| https://github.com/plandex-ai/plandex ❌ | Дубль aider + только через WSL |
| https://github.com/mcp-use/mcp-use ⏸ | Свой MCP-сервер — когда появится внешний потребитель |
| https://github.com/hajimehoshi/ebiten ⏸ | Кандидат для темы «Алгоритмы» (`docs/future-algorithms.md`) |
| https://github.com/virgiliojr94/book-to-skill 🔍 | Сам инструмент не ставился; по его идее собран наш скилл методики (файлы на месте) |

Сервисы (не репозитории, для полноты): OpenRouter (cloud-LLM для синтетики, `backend/.../openrouter.py`; ключ из чата отозвать),
Duck.ai (отклонён — нет API).
