"""Text chunking utilities for Aquinas texts."""

from llama_index.core.node_parser import SemanticSplitterNodeParser


class AquinasChunker:
    """Semantic chunker optimized for Aquinas's philosophical texts."""
    
    def __init__(self, embeddings):
        self.embeddings = embeddings
    
    def get_semantic_splitter(self):
        """Return semantic chunking strategy for all Aquinas texts."""
        return SemanticSplitterNodeParser(
            buffer_size=1,
            breakpoint_percentile_threshold=95,
            embed_model=self.embeddings
        )