from fastapi import APIRouter
from app.infrastructure.database import get_pool as get_db_pool
from app.infrastructure.pinecone import get_pinecone_index

router = APIRouter()


@router.get("/health")
async def health():
    db_ok = False
    pinecone_ok = False

    try:
        pool = get_db_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        db_ok = True
    except Exception:
        pass

    try:
        idx = get_pinecone_index()
        idx.describe_index_stats()
        pinecone_ok = True
    except Exception:
        pass

    return {"database": db_ok, "pinecone": pinecone_ok, "status": "ok" if (db_ok and pinecone_ok) else "degraded"}
