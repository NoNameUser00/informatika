"""Сборка RAG-корпуса ТОЛЬКО из student_view.

teacher_only (ответы, разборы, ключи) никогда не попадает в индекс:
текст собирается из allowlist-полей, плюс assert_no_teacher_markers().
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

TEACHER_MARKERS = (
    "teacher_only",
    "accepted_values",
    "answer_text",
    "answer_map",
    "common_errors",
    "explanation",
    "rubric",
)

STUDENT_META_KEYS = (
    "class",
    "topic",
    "subtopic",
    "type",
    "difficulty",
    "cognitive_level",
    "points",
    "fgos",
)


@dataclass
class CorpusItem:
    doc_id: str
    text: str
    metadata: dict[str, Any]


def _fmt(value: Any) -> str:
    if isinstance(value, list):
        return "; ".join(_fmt(v) for v in value)
    if isinstance(value, dict):
        return ", ".join(f"{k}: {_fmt(v)}" for k, v in value.items())
    return str(value)


def task_to_item(task: dict[str, Any]) -> CorpusItem:
    lines = [f"Задание {task.get('id')}."]
    for key in STUDENT_META_KEYS:
        if task.get(key) is not None:
            lines.append(f"{key}: {_fmt(task[key])}")
    lines.append(f"prompt: {task.get('prompt', '')}")
    lines.append(f"student_view: {_fmt(task.get('student_view') or {})}")
    lines.append(f"auto_check: {_fmt(task.get('auto_check') or {})}")
    return CorpusItem(
        doc_id=str(task.get("id")),
        text="\n".join(lines),
        metadata={
            "kind": "task",
            "source": "bank.yaml",
            "class": task.get("class"),
            "topic": task.get("topic"),
            "type": task.get("type"),
            "difficulty": task.get("difficulty"),
        },
    )


def load_bank_items(bank_path: str | Path) -> list[CorpusItem]:
    with open(bank_path, encoding="utf-8") as f:
        tasks = yaml.safe_load(f)
    return [task_to_item(t) for t in tasks]


def load_markdown_item(path: str | Path, doc_id: str) -> CorpusItem:
    p = Path(path)
    return CorpusItem(doc_id=doc_id, text=p.read_text(encoding="utf-8"), metadata={"kind": "methodics", "source": p.name})


def load_corpus(bank_path: str | Path, doc_paths: tuple[str | Path, ...] = ()) -> list[CorpusItem]:
    items = load_bank_items(bank_path)
    for i, p in enumerate(doc_paths):
        items.append(load_markdown_item(p, doc_id=f"doc-{i}-{Path(p).stem}"))
    assert_no_teacher_markers(items)
    return items


def assert_no_teacher_markers(items: list[CorpusItem]) -> None:
    for item in items:
        lowered = item.text.lower()
        for marker in TEACHER_MARKERS:
            if marker in lowered:
                raise ValueError(f"teacher leak in {item.doc_id}: {marker}")
