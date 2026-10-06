"""Демо запроса: retrieve всегда работает, --with-llm требует запущенный Ollama."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from rag_informatics.config import load_settings
from rag_informatics.indexing import load_index
from rag_informatics.query import QueryRequest, answer, make_ollama_llm, retrieve


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", default="Как переводить из десятичной в двоичную?")
    ap.add_argument("--top-k", type=int, default=3)
    ap.add_argument("--embed", choices=("hf", "mock"), default="hf")
    ap.add_argument("--store", choices=("file", "qdrant"), default=None)
    ap.add_argument("--with-llm", action="store_true")
    args = ap.parse_args()

    settings = load_settings()
    request = QueryRequest(query=args.query, top_k=args.top_k)
    index = load_index(settings, embed_kind=args.embed, store_kind=args.store or settings.vector_store)

    print("--- retrieve ---")
    for ch in retrieve(index, request):
        print(f"[{ch.doc_id}] score={ch.score}\n{ch.text[:400]}\n")

    if args.with_llm:
        print("--- answer (ollama) ---")
        print(answer(index, request, llm=make_ollama_llm(settings)))


if __name__ == "__main__":
    main()
