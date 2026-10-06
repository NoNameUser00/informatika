"""OpenRouter (OpenAI-совместимый HTTP API) для облачных ответов RAG.

Ключ — ТОЛЬКО из окружения OPENROUTER_API_KEY, в репозитории его нет.
Cloud — только синтетика, пилот с ПДн остаётся на локальной Ollama (см. AGENTS.md).
Зависимостей нет, только stdlib.
"""

from __future__ import annotations

import json
import urllib.request
from typing import Any

from .config import RagSettings


class OpenRouterError(RuntimeError):
    pass


def chat(settings: RagSettings, messages: list[dict[str, str]], timeout: float = 60.0) -> str:
    if not settings.openrouter_api_key:
        raise OpenRouterError("OPENROUTER_API_KEY не задан (только окружение, не репозиторий)")
    req = urllib.request.Request(
        f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
        data=json.dumps({"model": settings.openrouter_model, "messages": messages}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.openrouter_api_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        raise OpenRouterError(f"OpenRouter request failed: {e}") from e
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise OpenRouterError(f"unexpected OpenRouter response: {payload!r}") from e
    return content if isinstance(content, str) else str(content)


def answer_openrouter(index: Any, request: Any, settings: RagSettings) -> str:
    """RAG-ответ: retrieve из индекса + генерация через OpenRouter."""
    from .query import SYSTEM_PROMPT, retrieve

    chunks = retrieve(index, request)
    context = "\n\n".join(f"[{c.doc_id}]\n{c.text}" for c in chunks)
    return chat(
        settings,
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Материалы:\n{context}\n\nВопрос: {request.query}"},
        ],
    )
