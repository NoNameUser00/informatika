"""Тесты RAG-корпуса: teacher_only не утекает в индекс. Запуск: pytest или python tests/test_corpus.py."""

from __future__ import annotations

import sys
from pathlib import Path

import yaml
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from rag_informatics.config import load_settings
from rag_informatics.corpus import TEACHER_MARKERS, load_corpus
from rag_informatics.query import QueryRequest


def test_bank_loads_all_tasks() -> None:
    settings = load_settings()
    with open(settings.bank_path, encoding="utf-8") as f:
        tasks = yaml.safe_load(f)
    items = load_corpus(settings.bank_path)
    loaded = [i for i in items if i.metadata.get("kind") == "task"]
    assert len(loaded) == len(tasks) >= 10, f"bank={len(tasks)}, loaded={len(loaded)}"
    ids = [i.doc_id for i in loaded]
    assert len(set(ids)) == len(ids), "duplicate task ids"


def test_no_teacher_markers_in_corpus() -> None:
    settings = load_settings()
    items = load_corpus(settings.bank_path, settings.docs_paths)
    for item in items:
        lowered = item.text.lower()
        for marker in TEACHER_MARKERS:
            assert marker not in lowered, f"{item.doc_id} leaks {marker}"


def test_explanations_not_indexed() -> None:
    settings = load_settings()
    with open(settings.bank_path, encoding="utf-8") as f:
        tasks = yaml.safe_load(f)
    explanations = [t["teacher_only"]["explanation"] for t in tasks if "explanation" in t.get("teacher_only", {})]
    assert len(explanations) >= 10, f"expected explanations for all tasks, got {len(explanations)}"
    items = load_corpus(settings.bank_path)
    blob = "\n".join(i.text for i in items)
    for exp in explanations:
        assert exp not in blob, f"explanation leaked: {exp[:40]}"


def test_query_validation() -> None:
    QueryRequest(query="перевод 10->2", top_k=3)
    for bad in ({"query": "", "top_k": 3}, {"query": "x", "top_k": 0}, {"query": "x", "top_k": 11}):
        try:
            QueryRequest(**bad)
        except ValidationError:
            continue
        raise AssertionError(f"accepted invalid request: {bad}")


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
            print(f"FAIL {t.__name__}: {e}")
    sys.exit(1 if failed else 0)
