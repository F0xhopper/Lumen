from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def root():
    return {
        "name": "Lumen API",
        "description": "Summa Theologica — PostgreSQL + Pinecone hybrid search + GPT-4.1",
        "endpoints": {
            "passages": "GET /passages?query=...&top_k=8",
            "article": "GET /article?part_id=prima-pars&question_n=2&article_n=3",
            "query": "POST /query",
            "health": "GET /health",
            "docs": "/docs",
        },
    }
