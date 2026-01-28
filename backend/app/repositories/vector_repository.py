"""Vector store repository for managing vector operations."""

from typing import List, Optional
from llama_index.core import VectorStoreIndex, StorageContext, Document
from llama_index.vector_stores.pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class VectorRepository:
    """Repository for vector store operations."""
    
    def __init__(self):
        self._setup_vector_store()
        
    def _setup_vector_store(self):
        """Set up Pinecone vector store."""
        if not settings.PINECONE_API_KEY:
            raise ValueError("PINECONE_API_KEY required")
        
        self.pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        
        index_name = settings.PINECONE_INDEX_NAME
        namespace = settings.PINECONE_NAMESPACE
        
        self.pinecone_index_name = index_name
        self.pinecone_namespace = namespace
        
        if index_name not in self.pc.list_indexes().names():
            logger.info(f"Creating Pinecone index: {index_name}")
            self.pc.create_index(
                name=index_name,
                dimension=3072,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
        else:
            logger.info(f"Using existing Pinecone index: {index_name}")
        
        pinecone_index = self.pc.Index(index_name)
        
        self.vector_store_obj = PineconeVectorStore(
            pinecone_index=pinecone_index,
            namespace=namespace
        )
    
    def get_index(self) -> Optional[VectorStoreIndex]:
        """Get or create index from vector store."""
        try:
            index = VectorStoreIndex.from_vector_store(self.vector_store_obj)
            return index
        except Exception as e:
            logger.warning(f"Failed to create index from vector store: {e}")
            return None
    
    def create_index(self, documents: List[Document], node_parser=None) -> VectorStoreIndex:
        """Create a new index with documents."""
        storage_context = StorageContext.from_defaults(vector_store=self.vector_store_obj)
        
        transformations = [node_parser] if node_parser else None
        
        index = VectorStoreIndex.from_documents(
            documents,
            show_progress=True,
            storage_context=storage_context,
            transformations=transformations
        )
        
        return index
    
    def get_existing_vector_count(self) -> int:
        """Return approximate count of existing vectors in the Pinecone index/namespace."""
        try:
            index = self.pc.Index(self.pinecone_index_name)
            stats = index.describe_index_stats()
            if hasattr(stats, "to_dict"):
                stats = stats.to_dict()
            elif not isinstance(stats, dict):
                maybe_total = getattr(stats, "total_vector_count", None)
                maybe_namespaces = getattr(stats, "namespaces", None)
                if maybe_total is not None:
                    return int(maybe_total)
                if isinstance(maybe_namespaces, dict) and self.pinecone_namespace:
                    ns_stats = maybe_namespaces.get(self.pinecone_namespace) or {}
                    ns_total = ns_stats.get("vector_count") or ns_stats.get("total_vector_count") or 0
                    return int(ns_total)
                return 0
            if self.pinecone_namespace:
                ns = stats.get("namespaces", {}).get(self.pinecone_namespace)
                if isinstance(ns, dict):
                    return int(ns.get("vector_count") or ns.get("total_vector_count") or 0)
                return 0
            return int(stats.get("total_vector_count") or 0)
        except Exception as e:
            logger.debug(f"Failed to get Pinecone stats: {e}")
            return 0