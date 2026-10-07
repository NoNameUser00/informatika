"""Безопасный дайджест проекта для LLM: без ответов, учебников и мусора.

Что исключено и почему:
- data/tasks/* — teacher_only тренажёрного банка (не тащить в чужие LLM);
- material/* — копирайт учебников;
- окружения/сборки/бинарники/musor (node_modules, .venv, dist, tmp_*, медиа).
Что ОСТАЁТСЯ сознательно: src/data/*.json с ответами ТРЕНАЖЕРА — они public-by-design
(проверка тренажера клиентская, сайт публичный). Ответов КОНТРОЛЬНОЙ в репо нет вообще.

Запуск (без shell-glob в команде — паттерны только внутри файла):
  uv tool run --from gitingest python scripts/make-llm-digest.py [output.txt]
"""

import sys
from pathlib import Path

from gitingest import ingest

ROOT = Path(__file__).resolve().parents[1]

EXCLUDE = [
    "data/tasks/*",
    "material/*",
    "node_modules/*",
    "backend/.venv/*",
    "backend/storage/*",
    "backend/qdrant_data/*",
    "dist/*",
    ".astro/*",
    "tmp_*/*",
    "*.pdf",
    "*.png",
    "*.jpg",
    "*.mp4",
    "*.onnx",
    "*.wav",
    "*.xlsx",
    "*.lock",
]

out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / ".cache" / "informatika-digest.txt"
summary, tree, content = ingest(str(ROOT), exclude_patterns=EXCLUDE)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(summary + "\n\n" + tree + "\n\n" + content, encoding="utf-8")
print("files analyzed + digest:", out)
print(summary.split("\n")[0])
