"""Query processing service."""

from typing import List, Dict, Any, Optional
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.postprocessor import SimilarityPostprocessor
from llama_index.core.schema import NodeWithScore

from app.core.logging import get_logger

logger = get_logger(__name__)


class QueryService:
    """Service for processing queries and retrieving passages."""
    
    def process_query(
        self,
        question: str,
        query_engine,
        context_length: int = 4000,
        retrieve_passages: bool = True,
        index = None
    ) -> str:
        """Process a query and return the answer."""
        retrieved_passages = None
        if retrieve_passages and index:
            retrieved_passages = self._retrieve_relevant_passages(question, index)
            
        aquinas_prompt = self._create_aquinas_prompt(question, retrieved_passages)
        
        response = query_engine.query(aquinas_prompt)
        
        logger.info(f"Query: {question}")
        logger.info(f"Response type: {type(response)}")
        logger.info(f"Response: {response}")
        
        if not response or str(response).strip() == "":
            return "I apologize, but I couldn't find relevant information in the uploaded documents to answer your question. Please try rephrasing your question or upload more relevant documents."
        
        return str(response)
    
    def get_relevant_passages(self, question: str, index, top_k: int = 5) -> List[Dict[str, Any]]:
        """Get relevant passages for a question without generating a full response."""
        passages = self._retrieve_relevant_passages(question, index, top_k)
        
        result = []
        for i, passage in enumerate(passages, 1):
            if hasattr(passage, 'node'):
                node = passage.node
                passage_info = {
                    'rank': i,
                    'text': node.text,
                    'score': getattr(passage, 'score', 0.0),
                    'source': node.metadata.get('source', f'Passage {i}'),
                    'file_name': node.metadata.get('file_name', 'Unknown'),
                    'author': node.metadata.get('author', ''),
                    'title': node.metadata.get('title', ''),
                    'link': node.metadata.get('link', ''),
                    'page_label': node.metadata.get('page_label', ''),
                    'metadata': node.metadata
                }
            else:
                passage_info = {
                    'rank': i,
                    'text': str(passage),
                    'score': 0.0,
                    'source': f'Passage {i}',
                    'file_name': 'Unknown',
                    'metadata': {}
                }
            result.append(passage_info)
        
        return result
    
    def _retrieve_relevant_passages(self, question: str, index, top_k: int = 5) -> List[NodeWithScore]:
        """Retrieve relevant passages from the vector store for the given question."""
        if not index:
            return []
        
        try:
            retriever = VectorIndexRetriever(
                index=index,
                similarity_top_k=top_k * 2
            )
            
            nodes = retriever.retrieve(question)
            
            similarity_postprocessor = SimilarityPostprocessor(similarity_cutoff=0.3)
            filtered_nodes = similarity_postprocessor.postprocess_nodes(nodes)
            
            def sort_key(node_with_score):
                score = getattr(node_with_score, 'score', 0.0)
                return score
            
            sorted_nodes = sorted(filtered_nodes, key=sort_key, reverse=True)
            
            prioritized_nodes = sorted_nodes[:top_k]
            
            logger.info(f"Retrieved {len(prioritized_nodes)} relevant passages for question: {question}")
            
            return prioritized_nodes
            
        except Exception as e:
            logger.error(f"Error retrieving passages: {e}")
            return []
    
    
    def _create_aquinas_prompt(self, question: str, retrieved_passages: list = None) -> str:
        """Create a sophisticated prompt for Aquinas queries with RAG integration."""
        
        context_section = ""
        if retrieved_passages:
            context_section = "\n\nRetrieved Context from Aquinas's Works:\n"
            
            citation_data = []
            
            for passage in retrieved_passages:
                if hasattr(passage, 'node'):
                    node = passage.node
                    text_content = node.text
                    
                    author = node.metadata.get('author', '')
                    title = node.metadata.get('title', '')
                    link = node.metadata.get('link', '')
                    source_info = node.metadata.get('source', '')
                    file_name = node.metadata.get('file_name', 'Unknown')
                    page_label = node.metadata.get('page_label', '')
                    leaf_number = node.metadata.get('leaf_number', '')
                    
                    citation_parts = []
                    
                    if author:
                        citation_parts.append(author)
                    
                    if title:
                        citation_parts.append(f'"{title}"')
                    elif file_name != 'Unknown':
                        citation_parts.append(f'({file_name})')
                    
                    if page_label:
                        citation_parts.append(f'p. {page_label}')
                    
                    if link:
                        if 'archive.org' in link and leaf_number:
                            if 'archive.org/details/' in link:
                                if '/mode/' in link:
                                    link_with_page = link.replace('/mode/', f'/page/n{leaf_number}/mode/')
                                else:
                                    link_with_page = f"{link}/page/n{leaf_number}/mode/2up"
                                citation_parts.append(f'[Link: {link_with_page}]')
                            else:
                                citation_parts.append(f'[Link: {link}]')
                        else:
                            citation_parts.append(f'[Link: {link}]')
                    
                    if citation_parts:
                        citation_text = ', '.join(citation_parts)
                    else:
                        citation_text = f"{source_info}"
                        if file_name != 'Unknown':
                            citation_text += f" ({file_name})"
                    
                    citation_data.append({
                        'text': text_content,
                        'citation': citation_text,
                    })
                else:
                    text_content = str(passage)
                    citation_text = 'Passage'
                    
                    citation_data.append({
                        'text': text_content,
                        'citation': citation_text,
                    })
            
            for citation_info in citation_data:
                context_section += f"{citation_info['citation']}:\n> {citation_info['text'].replace(chr(10), chr(10) + '> ')}\n\n"
        
        return f"""You are a specialized scholarly assistant with deep expertise in the complete works of St. Thomas Aquinas (1225-1274). Your responses must be grounded in his actual texts and demonstrate mastery of Thomistic thought.

PRIMARY SOURCE PRIORITY:
- ALWAYS prioritize answering the question using Aquinas's own words from the retrieved primary sources
- When multiple sources are available, give precedence to Aquinas's direct statements
- Distinguish clearly between Aquinas's original texts and later Thomistic tradition
- If secondary sources are present, use them only to supplement, not replace, Aquinas's own words
- Base your analysis primarily on Aquinas's actual texts, not on interpretations or summaries

METHODOLOGY:
- Base your analysis primarily on the retrieved passages provided below
- Use Aquinas's own terminology and conceptual framework
- Distinguish between what Aquinas explicitly states vs. reasonable inferences
- Consider objections and replies in Aquinas's characteristic style
- Show awareness of his sources (especially Aristotle, Augustine, Pseudo-Dionysius)

CITATION REQUIREMENTS:
- Use Wikipedia-style numbered citations throughout your response (e.g., [1], [2], [3])
- Reference specific works using standard abbreviations (ST = Summa Theologiae, SCG = Summa Contra Gentiles, etc.)
- Use precise citations (e.g., ST I, q.2, a.3; SCG II, c.15)
- Distinguish between Aquinas's own position and positions he discusses but rejects
- Note when paraphrasing vs. directly quoting
- Always cite Aquinas's primary texts when available, not secondary sources
- IMPORTANT: You must assign reference numbers [1], [2], [3], etc. based on the ORDER OF APPEARANCE in your response, not the order the sources were retrieved
- The first source you reference in your response should be [1], the second should be [2], and so on
- Include a numbered reference list at the end of your response that corresponds to the citation numbers you used
- For archive.org links, the URL uses leaf numbers with 'n' prefix for navigation (e.g., /page/n162/mode/2up), but reference page labels in your response text

SCHOLARLY STANDARDS:
- Maintain academic precision while being accessible
- Acknowledge limitations or uncertainties in interpretation
- Note when questions go beyond what Aquinas directly addressed
- Distinguish between historical Thomas and later Thomistic tradition when relevant
- When secondary sources are cited, clearly indicate they are secondary and not Aquinas's own words

RESPONSE STRUCTURE:
- As a priority begin the response using Aquinas's own words from retrieved primary sources
- Structure your response to prioritize Aquinas's direct statements
- Use secondary sources only as supplementary support
- Provide comprehensive analysis grounded in Aquinas's actual texts
- Support all claims with appropriate citations from Aquinas's primary sources whenever possible, especially from the retrieved primary sources
- If primary sources are available, they must form the core of your response
- When quoting Aquinas directly, format the quotes using markdown block quotes (> text) for proper visual distinction
- End your response with a "References" section containing numbered citations that correspond to the [1], [2], [3] citations used throughout your response
- The reference numbers should be assigned based on the order you first mention each source in your response, not the retrieval order

{context_section}
QUESTION: {question}

Provide a comprehensive response that demonstrates both textual fidelity to Aquinas and sophisticated theological-philosophical analysis. Structure your response clearly and support all claims with appropriate citations from Aquinas's primary sources whenever possible. Remember to assign reference numbers [1], [2], [3], etc. based on the order you first reference each source in your response, not the order they appear in the retrieved context above."""