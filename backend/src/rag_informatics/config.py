"""Настройки RAG-бэкенда. Только сервер: секреты читаются из окружения."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class RagSettings:
    ollama_host: str = "http://localhost:11434"
    llm_model: str = "llama3.1"
    embed_model_name: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    persist_dir: Path = field(default_factory=lambda: repo_root() / "backend" / "storage")
    vector_store: str = "file"  # file | qdrant
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_path: Path = field(default_factory=lambda: repo_root() / "backend" / "qdrant_data")
    qdrant_collection: str = "informatics-8-numsys"
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    bank_path: Path = field(
        default_factory=lambda: repo_root() / "data" / "tasks" / "8" / "number-systems" / "bank.yaml"
    )
    docs_paths: tuple[Path, ...] = ()


def load_settings() -> RagSettings:
    root = repo_root()
    raw_docs = os.getenv("DOC_PATHS", str(root / "docs" / "spec-numbersystems.md"))
    docs = tuple(Path(p) for p in raw_docs.split(os.pathsep) if p.strip())
    return RagSettings(
        ollama_host=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
        llm_model=os.getenv("LLM_MODEL", "llama3.1"),
        embed_model_name=os.getenv(
            "EMBED_MODEL_NAME",
            "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        ),
        persist_dir=Path(os.getenv("INDEX_PERSIST_DIR", str(root / "backend" / "storage"))),
        vector_store=os.getenv("VECTOR_STORE", "file"),
        qdrant_url=os.getenv("QDRANT_URL", ""),
        qdrant_api_key=os.getenv("QDRANT_API_KEY", ""),
        qdrant_path=Path(os.getenv("QDRANT_PATH", str(root / "backend" / "qdrant_data"))),
        qdrant_collection=os.getenv("QDRANT_COLLECTION", "informatics-8-numsys"),
        openrouter_api_key=os.getenv("OPENROUTER_API_KEY", ""),
        openrouter_model=os.getenv("OPENROUTER_MODEL", "openai/gpt-4o"),
        openrouter_base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        bank_path=Path(
            os.getenv("BANK_PATH", str(root / "data" / "tasks" / "8" / "number-systems" / "bank.yaml"))
        ),
        docs_paths=docs,
    )
