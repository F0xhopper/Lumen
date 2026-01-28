# Aquinas RAG Backend

A sophisticated RAG (Retrieval-Augmented Generation) system for St. Thomas Aquinas works using FastAPI, Pinecone, OpenAI, and LlamaIndex.

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app initialization
│   ├── core/
│   │   ├── config.py              # Configuration management
│   │   ├── logging.py             # Logging configuration
│   │   └── dependencies.py        # FastAPI dependencies
│   ├── api/
│   │   ├── routes/                # API route handlers
│   │   │   ├── query.py           # Query endpoints
│   │   │   ├── upload.py          # Upload endpoints
│   │   │   ├── status.py          # Status endpoints
│   │   │   ├── passages.py        # Passages endpoints
│   │   │   └── root.py            # Root endpoints
│   │   └── middleware/            # Middleware components
│   │       ├── cors.py            # CORS configuration
│   │       └── error_handlers.py  # Error handling
│   ├── models/
│   │   ├── requests.py            # Pydantic request models
│   │   ├── responses.py           # Pydantic response models
│   │   └── domain.py              # Domain models
│   ├── services/
│   │   ├── rag_service.py         # Main RAG orchestration
│   │   ├── embedding_service.py   # Embedding operations
│   │   └── query_service.py       # Query processing
│   ├── repositories/
│   │   └── vector_repository.py   # Vector store operations
│   └── utils/
│       ├── chunking.py            # Text chunking utilities
│       ├── file_processing.py     # File handling
│       └── validators.py          # Input validation
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── scripts/
│   └── start.py                   # Startup script
├── requirements/
│   ├── base.txt                   # Core dependencies
│   ├── dev.txt                    # Development dependencies
│   └── prod.txt                   # Production dependencies
└── README.md
```

## Quick Start

### 1. Environment Setup

Copy the environment template and fill in your API keys:

```bash
cp .env.example .env
```

Required environment variables:
- `OPENAI_API_KEY` - OpenAI API key for LLM and embeddings
- `PINECONE_API_KEY` - Pinecone API key for vector storage
- `PINECONE_INDEX_NAME` - Name of your Pinecone index
- `LLAMA_CLOUD_API_KEY` - LlamaCloud API key for document parsing

### 2. Install Dependencies

For development:
```bash
pip install -r requirements/dev.txt
```

For production:
```bash
pip install -r requirements/prod.txt
```

### 3. Run the Application

#### Development Mode
```bash
# From the backend directory
python -m app.main
```

#### Or use uvicorn directly
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Docker
```bash
cd docker
docker-compose up --build
```

### 4. Access the API

- API Documentation: http://localhost:8000/docs
- API Base URL: http://localhost:8000
- Health Check: http://localhost:8000/status

## API Endpoints

- `GET /` - API information
- `POST /query` - Query the RAG system
- `POST /upload` - Upload documents
- `GET /passages` - Retrieve relevant passages
- `GET /status` - System health check

## Architecture

### Service Layer
- **RAGService**: Main orchestrator for all RAG operations
- **EmbeddingService**: Manages LLM and embedding models
- **QueryService**: Handles query processing and retrieval

### Repository Layer
- **VectorRepository**: Manages Pinecone vector store operations

### API Layer
- Focused route modules for different functionalities
- Middleware for CORS and error handling
- Dependency injection for service management

## Configuration

Configuration is managed through environment variables and the `Settings` class in `app/core/config.py`. All settings have sensible defaults and can be overridden via environment variables.

## Development

### Running Tests
```bash
pytest
```

### Code Formatting
```bash
black app/
isort app/
```

### Type Checking
```bash
mypy app/
```

## Migration from Old Structure

The new structure provides:
- **Better separation of concerns** - API, business logic, and data access are clearly separated
- **Improved testability** - Each layer can be tested independently
- **Enhanced maintainability** - Smaller, focused files are easier to understand and modify
- **Scalability** - Easy to add new features without affecting existing code
- **Professional organization** - Follows industry best practices for Python web applications