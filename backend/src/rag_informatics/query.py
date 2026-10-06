"""Запросы к индексу: retrieve без LLM + ответ через Ollama (опционально)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, Field

SYSTEM_PROMPT = (
    "Ты — помощник тренажёра по информатике (8 класс, системы счисления). "
    "Объясняй теорию и шаги решения, опирайся на найденные материалы. "
    "Готовых ответов контрольной у тебя нет — не выдумывай их."
)


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    top_k: int = Field(default=3, ge=1, le=10)


@dataclass
class RetrievedChunk:
    doc_id: str
    score: float | None
    text: str


def retrieve(index: Any, request: QueryRequest) -> list[RetrievedChunk]:
    retriever = index.as_retriever(similarity_top_k=request.top_k)
    return [
        RetrievedChunk(doc_id=n.metadata.get("doc_id", "?"), score=n.score, text=n.get_content())
        for n in retriever.retrieve(request.query)
    ]


def answer(index: Any, request: QueryRequest, llm: Any = None) -> str:
    engine = index.as_query_engine(similarity_top_k=request.top_k, llm=llm)
    return str(engine.query(request.query))


def make_ollama_llm(settings: Any) -> Any:
    from llama_index.llms.ollama import Ollama

    return Ollama(
        model=settings.llm_model,
        base_url=settings.ollama_host,
        request_timeout=120.0,
        context_window=8000,
    )
