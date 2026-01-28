"""Embedding service for managing embeddings."""

from llama_index.core import Settings
from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class EmbeddingService:
    """Service for managing embeddings and LLM."""
    
    def __init__(self):
        self._setup_llm()
        self._setup_embeddings()
    
    def _setup_llm(self):
        """Set up OpenAI LLM."""
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        self.llm = OpenAI(
            model="gpt-4.1",
            temperature=0.1,
            max_tokens=4000,
            api_key=settings.OPENAI_API_KEY
        )
        
        Settings.llm = self.llm
        
    def _setup_embeddings(self):
        """Set up OpenAI embeddings."""
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        self.embeddings = OpenAIEmbedding(
            model="text-embedding-3-large",
            embed_batch_size=settings.EMBED_BATCH_SIZE,
            timeout=60.0,
            max_retries=3,
            api_key=settings.OPENAI_API_KEY
        )
        
        Settings.embed_model = self.embeddings