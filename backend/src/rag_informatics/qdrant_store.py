"""Qdrant как векторное хранилище индекса. Два режима:
- local (по умолчанию): QdrantClient(path=...) — без сервера и docker;
- server: QDRANT_URL (+QDRANT_API_KEY) — self-host/docker или Cloud (только синтетика).
Импорты qdrant/llama-index — ленивые.
"""

from __future__ import annotations

from typing import Any

from .config import RagSettings
from .corpus import CorpusItem


def make_qdrant_client(settings: RagSettings, in_memory: bool = False) -> Any:
    from qdrant_client import QdrantClient

    if in_memory:
        return QdrantClient(location=":memory:")
    if settings.qdrant_url:
        kwargs: dict[str, Any] = {"url": settings.qdrant_url}
        if settings.qdrant_api_key:
            kwargs["api_key"] = settings.qdrant_api_key
        return QdrantClient(**kwargs)
    settings.qdrant_path.mkdir(parents=True, exist_ok=True)
    return QdrantClient(path=str(settings.qdrant_path))


def build_qdrant_index(
    items: list[CorpusItem], settings: RagSettings, embed_kind: str = "hf", client: Any = None
) -> Any:
    from llama_index.core import StorageContext, VectorStoreIndex
    from llama_index.core.node_parser import SentenceSplitter
    from llama_index.vector_stores.qdrant import QdrantVectorStore

    from .indexing import make_embed_model, to_documents

    qclient = client or make_qdrant_client(settings)
    if qclient.collection_exists(settings.qdrant_collection):
        qclient.delete_collection(settings.qdrant_collection)
    store = QdrantVectorStore(client=qclient, collection_name=settings.qdrant_collection)
    nodes = SentenceSplitter(chunk_size=512, chunk_overlap=50).get_nodes_from_documents(to_documents(items))
    return VectorStoreIndex(
        nodes,
        storage_context=StorageContext.from_defaults(vector_store=store),
        embed_model=make_embed_model(settings, embed_kind),
        show_progress=False,
    )


def load_qdrant_index(settings: RagSettings, embed_kind: str = "hf", client: Any = None) -> Any:
    from llama_index.core import VectorStoreIndex
    from llama_index.vector_stores.qdrant import QdrantVectorStore

    from .indexing import make_embed_model

    store = QdrantVectorStore(
        client=client or make_qdrant_client(settings), collection_name=settings.qdrant_collection
    )
    return VectorStoreIndex.from_vector_store(store, embed_model=make_embed_model(settings, embed_kind))
