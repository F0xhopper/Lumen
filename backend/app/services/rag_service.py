"""Main RAG service for Aquinas system."""

import time
from typing import List, Dict, Any, Optional, Union
from pathlib import Path

from llama_index.core import VectorStoreIndex, Document, Settings
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.postprocessor import SimilarityPostprocessor, LLMRerank, LongContextReorder
from llama_index.core.schema import NodeWithScore

from app.core.config import settings
from app.core.logging import get_logger
from app.utils.chunking import AquinasChunker
from app.services.embedding_service import EmbeddingService
from app.services.query_service import QueryService
from app.repositories.vector_repository import VectorRepository

logger = get_logger(__name__)


class RAGService:
    """Main RAG service orchestrating all components."""
    
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.vector_repository = VectorRepository()
        self.query_service = QueryService()
        
        self.embed_batch_size = settings.EMBED_BATCH_SIZE
        self.embed_delay = settings.EMBED_DELAY
        
        self.aquinas_chunker = AquinasChunker(self.embedding_service.embeddings)
        self.semantic_parser = self.aquinas_chunker.get_semantic_splitter()
        
        self.index = None
        self.query_engine = None
        
        self._initialize_index()
        
    def _initialize_index(self):
        """Initialize index from existing vector store if available."""
        try:
            self.index = self.vector_repository.get_index()
            if self.index:
                self.create_query_engine()
                logger.info("Vector store connected; query engine initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize index from vector store: {e}")
    
    def _rate_limit_delay(self):
        """Add a small delay to avoid rate limiting."""
        if self.embed_delay > 0:
            time.sleep(self.embed_delay)
    
    def ensure_ready_for_queries(self) -> None:
        """Ensure that an index wrapper and query engine are initialized."""
        if self.index is None:
            self.index = self.vector_repository.get_index()
        if self.query_engine is None:
            self.create_query_engine()
    
    def ingest_documents(
        self, 
        documents_path: Union[str, Path],
        custom_metadata: Optional[Dict[str, Any]] = None
    ) -> List[Document]:
        """Ingest documents from the specified path."""
        documents_path = Path(documents_path)
        
        if not documents_path.exists():
            raise FileNotFoundError(f"Documents path not found: {documents_path}")
            
        logger.info(f"Ingesting documents from: {documents_path}")
        
        if documents_path.is_file():
            file_paths = [documents_path]
        else:
            file_paths = list(documents_path.rglob("*"))
            file_paths = [f for f in file_paths if f.is_file() and f.suffix.lower() in ['.pdf', '.docx', '.txt', '.md']]
            
        documents = []
        
        for file_path in file_paths:
            try:
                self._rate_limit_delay()
                
                parsed_docs = self._parse_document(file_path, custom_metadata)
                documents.extend(parsed_docs)
                
            except Exception as e:
                logger.error(f"Error processing {file_path}: {e}")
                continue
                
        logger.info(f"Successfully ingested {len(documents)} documents")
        return documents
    
    def _parse_document(self, file_path: Path, custom_metadata: Dict[str, Any] = None) -> List[Document]:
        """Parse a single document file."""
        from llama_index.core import SimpleDirectoryReader
        
        reader = SimpleDirectoryReader(input_files=[str(file_path)])
        parsed_docs = reader.load_data()
        
        for i, doc in enumerate(parsed_docs):
            doc.metadata.update({
                "file_path": str(file_path),
                "file_name": file_path.name,
                "leaf_number": i + 1,
                "source": "aquinas_works"
            })
            
            if custom_metadata:
                doc.metadata.update(custom_metadata)
        
        return parsed_docs
    
    def build_index(self, documents: List[Document]):
        """Build the vector index from documents using semantic chunking."""
        logger.info("Building vector index with semantic chunking...")
        
        self.index = self.vector_repository.create_index(
            documents=documents,
            node_parser=self.semantic_parser
        )
        
        logger.info("Vector index built successfully with semantic chunking")
    
    def add_documents_to_index(self, documents: List[Document]):
        """Add new documents to an existing vector index."""
        if not self.index:
            raise ValueError("No existing index found. Call build_index() first.")
        
        logger.info(f"Adding {len(documents)} documents to existing index...")
        
        nodes = self.semantic_parser.get_nodes_from_documents(documents)
        self.index.insert_nodes(nodes)
        logger.info(f"Successfully added {len(documents)} documents to existing index")
        
        self.create_query_engine()
        logger.info("Query engine updated with new documents")
    
    def create_query_engine(
        self,
        similarity_top_k: int = 15,
        response_mode: str = "compact",
        use_llm_rerank: bool = True
    ):
        """Create the query engine with Aquinas-specific configuration."""
        if not self.index:
            raise ValueError("Index not built. Call build_index() first.")
            
        retriever = VectorIndexRetriever(
            index=self.index,
            similarity_top_k=similarity_top_k
        )
        
        postprocessors = []
        
        similarity_postprocessor = SimilarityPostprocessor(similarity_cutoff=0.3)
        postprocessors.append(similarity_postprocessor)
        
        long_context_reorder = LongContextReorder()
        postprocessors.append(long_context_reorder)
        
        if use_llm_rerank:
            llm_rerank = LLMRerank(top_n=5)
            postprocessors.append(llm_rerank)
        
        self.query_engine = RetrieverQueryEngine.from_args(
            retriever=retriever,
            node_postprocessors=postprocessors,
            response_mode=response_mode
        )
        
        logger.info("Query engine created successfully with advanced postprocessing")
    
    def query(
        self,
        question: str,
        context_length: int = 4000,
        retrieve_passages: bool = True
    ) -> str:
        """Query the Aquinas RAG system."""
        if not self.query_engine:
            raise ValueError("Query engine not created. Call create_query_engine() first.")
        
        return self.query_service.process_query(
            question=question,
            query_engine=self.query_engine,
            context_length=context_length,
            retrieve_passages=retrieve_passages,
            index=self.index
        )
    
    def get_relevant_passages(self, question: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Get relevant passages for a question without generating a full response."""
        return self.query_service.get_relevant_passages(
            question=question,
            index=self.index,
            top_k=top_k
        )
    
    def get_metadata_summary(self) -> Dict[str, Any]:
        """Get a summary of the indexed documents' metadata."""
        if not self.index:
            return {}
            
        return {
            "total_documents": "N/A",
            "vector_store": "Pinecone",
            "llm_provider": "OpenAI GPT-4o",
            "embedding_provider": "OpenAI text-embedding-3-large",
            "chunking_strategy": "Semantic Splitter"
        }