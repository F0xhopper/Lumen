"""Error handling middleware."""

from fastapi import FastAPI
from fastapi.responses import JSONResponse


def add_error_handlers(app: FastAPI):
    """Add error handlers to the FastAPI application."""
    
    @app.exception_handler(404)
    async def not_found_handler(request, exc):
        return JSONResponse(
            status_code=404,
            content={"detail": "Endpoint not found"}
        )

    @app.exception_handler(500)
    async def internal_error_handler(request, exc):
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )