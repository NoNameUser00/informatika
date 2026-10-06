"""Индекс LlamaIndex: построение, persist, загрузка. Импорт llama_index — ленивый."""

from __future__ import annotations

from typing import Any

from .config import RagSettings
from .corpus import CorpusItem


def to_documents(items: list[CorpusItem]) -> list[Any]:
    from llama_index.core import Document

    return [Document(text=i.text, metadata={"doc_id": i.doc_id, **i.metadata}) for i in items]


def make_embed_model(settings: RagSettings, kind: str = "hf") -> Any:
    if kind == "mock":
        from llama_index.core.embeddings.mock_embed_model import MockEmbedding

        return MockEmbedding(embed_dim=384)
    from llama_index.embeddings.huggingface import HuggingFaceEmbedding

    return HuggingFaceEmbedding(model_name=settings.embed_model_name)


def build_index(
    items: list[CorpusItem], settings: RagSettings, embed_kind: str = "hf", store_kind: str = "file", client: Any = None
) -> Any:
    if store_kind == "qdrant":
        from .qdrant_store import build_qdrant_index

        return build_qdrant_index(items, settings, embed_kind, client=client)
    from llama_index.core import VectorStoreIndex
    from llama_index.core.node_parser import SentenceSplitter

    embed_model = make_embed_model(settings, embed_kind)
    nodes = SentenceSplitter(chunk_size=512, chunk_overlap=50).get_nodes_from_documents(to_documents(items))
    index = VectorStoreIndex(nodes, embed_model=embed_model, show_progress=False)
    index.storage_context.persist(persist_dir=str(settings.persist_dir))
    return index


def load_index(settings: RagSettings, embed_kind: str = "hf", store_kind: str = "file", client: Any = None) -> Any:
    if store_kind == "qdrant":
        from .qdrant_store import load_qdrant_index

        return load_qdrant_index(settings, embed_kind, client=client)
    from llama_index.core import StorageContext, load_index_from_storage

    sc = StorageContext.from_defaults(persist_dir=str(settings.persist_dir))
    return load_index_from_storage(sc, embed_model=make_embed_model(settings, embed_kind))
