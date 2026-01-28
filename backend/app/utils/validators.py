"""Input validation utilities."""

from fastapi import HTTPException


def validate_pdf_file(filename: str):
    """Validate that the uploaded file is a PDF."""
    if not filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")