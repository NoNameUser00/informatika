"""Построение индекса: python backend/scripts/build_index.py [--embed hf|mock]."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from rag_informatics.config import load_settings
from rag_informatics.corpus import load_corpus
from rag_informatics.indexing import build_index


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--embed", choices=("hf", "mock"), default="hf",
                    help="mock — без скачивания моделей (CI/проверка)")
    ap.add_argument("--store", choices=("file", "qdrant"), default=None,
                    help="по умолчанию из VECTOR_STORE (.env)")
    args = ap.parse_args()
    settings = load_settings()
    items = load_corpus(settings.bank_path, settings.docs_paths)
    store = args.store or settings.vector_store
    build_index(items, settings, embed_kind=args.embed, store_kind=store)
    where = settings.qdrant_collection if store == "qdrant" else settings.persist_dir
    print(f"indexed {len(items)} docs [{store}] -> {where}")


if __name__ == "__main__":
    main()
