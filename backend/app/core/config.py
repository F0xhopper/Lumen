import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    EMBED_MODEL: str = "text-embedding-3-large"
    EMBED_DIM: int = 3072
    CHAT_MODEL: str = "gpt-4.1"

    PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "")
    PINECONE_INDEX_NAME: str = os.getenv("PINECONE_INDEX_NAME", "lumen-summa")
    PINECONE_NAMESPACE: str = os.getenv("PINECONE_NAMESPACE", "summa")

    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    def check_required_vars(self) -> list[str]:
        missing = []
        if not self.OPENAI_API_KEY:
            missing.append("OPENAI_API_KEY")
        if not self.PINECONE_API_KEY:
            missing.append("PINECONE_API_KEY")
        if not self.DATABASE_URL:
            missing.append("DATABASE_URL")
        return missing


settings = Settings()
