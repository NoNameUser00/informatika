"""Qdrant store: сборка и перезагрузка без сервера (in-memory / local path).
Запуск: pytest или python tests/test_qdrant_store.py. Требует qdrant-client
и llama-index-vector-stores-qdrant (см. backend/requirements.txt).
"""

from __future__ import annotations

import dataclasses
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from rag_informatics.config import load_settings
from rag_informatics.corpus import TEACHER_MARKERS, load_corpus
from rag_informatics.indexing import build_index
from rag_informatics.qdrant_store import load_qdrant_index, make_qdrant_client
from rag_informatics.query import QueryRequest, retrieve


def _mem_settings():
    return dataclasses.replace(load_settings(), qdrant_collection="test-numsys-mem")


def test_qdrant_build_and_retrieve_in_memory() -> None:
    settings = _mem_settings()
    items = load_corpus(settings.bank_path)
    index = build_index(items, settings, embed_kind="mock", store_kind="qdrant",
                        client=make_qdrant_client(settings, in_memory=True))
    chunks = retrieve(index, QueryRequest(query="перевод шестнадцатеричной в двоичную", top_k=5))
    assert chunks, "empty retrieval"
    assert any(c.doc_id.startswith("inf-8-numsys") for c in chunks)
    for c in chunks:
        assert "teacher_only" not in c.text.lower()
        for marker in TEACHER_MARKERS:
            assert marker not in c.text.lower(), f"{c.doc_id} leaks {marker}"


def test_qdrant_path_persist_and_reload() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        settings = dataclasses.replace(
            load_settings(), qdrant_path=Path(tmp) / "qdrant", qdrant_collection="test-numsys-path"
        )
        items = load_corpus(settings.bank_path)
        client = make_qdrant_client(settings)
        try:
            build_index(items, settings, embed_kind="mock", store_kind="qdrant", client=client)
        finally:
            client.close()
        loader = make_qdrant_client(settings)
        try:
            reloaded = load_qdrant_index(settings, embed_kind="mock", client=loader)
            chunks = retrieve(reloaded, QueryRequest(query="сложение в двоичной системе", top_k=5))
        finally:
            loader.close()
        assert any(c.doc_id.startswith("inf-8-numsys") for c in chunks), "reload lost the index"


if __name__ == "__main__":
    tests = sorted(
        (v for k, v in globals().items() if k.startswith("test_") and callable(v)),
        key=lambda f: f.__name__,
    )
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL {t.__name__}: {type(e).__name__}: {e}")
    sys.exit(1 if failed else 0)
