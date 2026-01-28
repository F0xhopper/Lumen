"""Upload endpoints for document processing."""

from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends

from app.models.responses import UploadResponse
from app.core.dependencies import get_rag_service
from app.utils.file_processing import process_uploaded_file
from app.utils.validators import validate_pdf_file
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(..., description="PDF document to upload"),
    author: Optional[str] = Form(None, description="Author of the document"),
    title: Optional[str] = Form(None, description="Title of the document"),
    link: Optional[str] = Form(None, description="Link to the original document"),
    rag_service = Depends(get_rag_service)
):
    """
    Upload a PDF document to the Aquinas RAG system with optional metadata.
    
    This endpoint processes PDF documents using LlamaCloud parsing and adds them 
    to the Pinecone vector index for querying. Documents are chunked using 
    advanced strategies optimized for Aquinas's philosophical texts.
    
    You can optionally provide author, title, and link information that will be 
    stored as metadata with the document for better organization and citation.
    """
    try:
        validate_pdf_file(file.filename)
    except HTTPException:
        raise
    
    try:
        custom_metadata = {}
        if author:
            custom_metadata["author"] = author
        if title:
            custom_metadata["title"] = title
        if link:
            custom_metadata["link"] = link
        
        documents = await process_uploaded_file(
            file, 
            custom_metadata if custom_metadata else None
        )
        
        if not documents:
            raise HTTPException(status_code=400, detail="No documents could be processed from the file")
        
        if rag_service.index is None:
            logger.info("Building new index with first document...")
            rag_service.build_index(documents)
            rag_service.create_query_engine()
            index_status = "New index created"
        else:
            logger.info("Adding document to existing index...")
            rag_service.add_documents_to_index(documents)
            index_status = "Document added to existing index"
        
        total_documents = len(documents) if rag_service.index is None else len(documents) + 1
        
        return UploadResponse(
            message="Document uploaded and processed successfully",
            documents_processed=len(documents),
            file_names=[file.filename],
            index_status=index_status,
            total_documents=total_documents,
            metadata_added=custom_metadata
        )
        
    except Exception as e:
        logger.error(f"Error processing upload: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing upload: {str(e)}")