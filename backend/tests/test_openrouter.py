"""Тесты OpenRouter-клиента: без сети (фейковый urlopen) + проверка отказа без ключа."""

from __future__ import annotations

import dataclasses
import io
import json
import sys
import urllib.request
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from rag_informatics.config import load_settings
from rag_informatics.openrouter import OpenRouterError, chat


class FakeResp:
    def __init__(self, payload: Any):
        self._buf = io.BytesIO(json.dumps(payload).encode())

    def read(self) -> bytes:
        return self._buf.read()

    def __enter__(self) -> "FakeResp":
        return self

    def __exit__(self, *args: Any) -> None:
        pass


def test_no_key_raises() -> None:
    settings = dataclasses.replace(load_settings(), openrouter_api_key="")
    try:
        chat(settings, [{"role": "user", "content": "hi"}])
    except OpenRouterError:
        return
    raise AssertionError("chat accepted empty key")


def test_chat_parses_response() -> None:
    settings = dataclasses.replace(load_settings(), openrouter_api_key="test-key")
    seen: dict[str, Any] = {}
    real = urllib.request.urlopen

    def fake(req: Any, timeout: Any = None) -> FakeResp:
        seen["url"] = req.full_url
        seen["auth"] = req.get_header("Authorization")
        seen["body"] = json.loads(req.data.decode())
        return FakeResp({"choices": [{"message": {"content": "42"}}]})

    urllib.request.urlopen = fake  # type: ignore[assignment]
    try:
        out = chat(settings, [{"role": "user", "content": "hi"}])
    finally:
        urllib.request.urlopen = real  # type: ignore[assignment]
    assert out == "42", out
    assert seen["url"].endswith("/chat/completions"), seen["url"]
    assert seen["auth"] == "Bearer test-key", seen["auth"]
    assert seen["body"]["model"], "model missing"


def test_bad_payload_raises() -> None:
    settings = dataclasses.replace(load_settings(), openrouter_api_key="test-key")
    real = urllib.request.urlopen
    urllib.request.urlopen = lambda req, timeout=None: FakeResp({"error": "nope"})  # type: ignore[assignment]
    try:
        chat(settings, [{"role": "user", "content": "hi"}])
    except OpenRouterError:
        return
    finally:
        urllib.request.urlopen = real  # type: ignore[assignment]
    raise AssertionError("chat accepted bad payload")


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
