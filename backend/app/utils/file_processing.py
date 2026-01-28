"""File processing utilities."""

import os
import tempfile
from pathlib import Path
from typing import List, Any
from fastapi import UploadFile

from llama_index.core import SimpleDirectoryReader, Document


async def process_uploaded_file(
    file: UploadFile, 
    custom_metadata: dict = None
) -> List[Document]:
    """
    Process an uploaded file and return documents with custom metadata.
    
    Args:
        file: The uploaded file
        custom_metadata: Additional metadata to add to documents
        
    Returns:
        List of processed documents
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_file_path = temp_file.name
    
    try:
        reader = SimpleDirectoryReader(input_files=[temp_file_path])
        documents = reader.load_data()
        
        for i, doc in enumerate(documents):
            doc.metadata.update({
                "file_path": temp_file_path,
                "file_name": file.filename,
                "leaf_number": i + 1,
                "source": "aquinas_works"
            })
            
            if custom_metadata:
                doc.metadata.update(custom_metadata)
        
        return documents
        
    finally:
        os.unlink(temp_file_path)