from pinecone import Pinecone

from app.core.config import settings

_index = None


def get_pinecone_index():
    global _index
    if _index is None:
        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        _index = pc.Index(settings.PINECONE_INDEX_NAME)
    return _index
