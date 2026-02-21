"""Configuration management for the application."""

import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings from environment variables."""

    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")

    PINECONE_API_KEY: Optional[str] = os.getenv("PINECONE_API_KEY")
    PINECONE_INDEX_NAME: str = os.getenv(
        "PINECONE_INDEX_NAME", "aquinas-works-testing-page-number"
    )
    PINECONE_NAMESPACE: Optional[str] = (
        os.getenv("PINECONE_NAMESPACE", "").strip() or None
    )

    LLAMA_CLOUD_API_KEY: Optional[str] = os.getenv("LLAMA_CLOUD_API_KEY")

    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "openai")
    VECTOR_STORE: str = os.getenv("VECTOR_STORE", "pinecone")
    EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "openai")

    EMBED_BATCH_SIZE: int = int(os.getenv("EMBED_BATCH_SIZE", "10"))
    EMBED_DELAY: float = float(os.getenv("EMBED_DELAY", "0.5"))

    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")

    def check_required_vars(self) -> list[str]:
        """Check if required environment variables are set."""
        required_vars = []

        if self.LLM_PROVIDER == "openai":
            if not self.OPENAI_API_KEY:
                required_vars.append("OPENAI_API_KEY")
        elif self.LLM_PROVIDER == "anthropic":
            if not self.ANTHROPIC_API_KEY:
                required_vars.append("ANTHROPIC_API_KEY")

        if not self.OPENAI_API_KEY:
            required_vars.append("OPENAI_API_KEY (for embeddings)")

        if self.VECTOR_STORE == "pinecone" and not self.PINECONE_API_KEY:
            required_vars.append("PINECONE_API_KEY")

        return required_vars


settings = Settings()
