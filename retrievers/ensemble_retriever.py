import re
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Optional, Any
from pymilvus import Collection, connections, utility
from sentence_transformers import SentenceTransformer, util
from rank_bm25 import BM25Okapi

class EnsembleRetriever:
    """Retrieves documents using vector search (Milvus) and BM25  search."""
    
    def __init__(self, collection_name: str, model_name: str = "all-MiniLM-L6-v2",
                 host: str = "localhost", port: str = "19530", vector_weight: float = 0.7,
                 bm25_weight: float = 0.3, top_k: int = 4, max_docs_bm25: int = 10000, 
                 batch_size_load: int = 1000):
 
        self.collection_name = collection_name
        self.host = host
        self.port = port
        self.vector_weight = vector_weight
        self.bm25_weight = bm25_weight
        self.top_k = top_k
        self.max_docs_bm25 = max_docs_bm25
        self.batch_size_load = batch_size_load
        self.collection = None
        self.bm25 = None
        self.bm25_docs = []

        # Load SentenceTransformer model
        self.model = SentenceTransformer(model_name)

        # Connect to Milvus and initialize BM25
        self._setup()

    def _setup(self):
        """Simplified setup for Milvus and BM25."""
        connections.connect(host=self.host, port=self.port)
        if utility.has_collection(self.collection_name):
            self.collection = Collection(self.collection_name)
            self.collection.load()
            self._initialize_bm25()

    def _initialize_bm25(self):
        """Loads documents and initializes BM25 index."""
        if not self.collection:
            return
        
        expr = "id >= 0"
        offset = 0
        fetched_docs = []
        
        while len(fetched_docs) < self.max_docs_bm25:
            results = self.collection.query(
                expr=expr, output_fields=["id", "text", "metadata"],
                limit=self.batch_size_load, offset=offset
            )
            if not results:
                break
            fetched_docs.extend(
                {"id": item["id"], "text": item["text"], "metadata": item.get("metadata", "{}")}
                for item in results if isinstance(item["text"], str)
            )
            offset += len(results)
        
        if fetched_docs:
            self.bm25_docs = fetched_docs[:self.max_docs_bm25]
            tokenized_corpus = [self._preprocess_text(doc["text"]) for doc in self.bm25_docs]
            valid_corpus = [tokens for tokens in tokenized_corpus if tokens]
            if valid_corpus:
                self.bm25 = BM25Okapi(valid_corpus)

    def _preprocess_text(self, text: str) -> List[str]:
        """Preprocesses text for BM25."""
        if not isinstance(text, str):
            return []
        tokens = re.findall(r'\b\w+\b', text.lower())
        return [token for token in tokens if token.isalnum()]

    async def search(self, query: str, top_k: Optional[int] = None, filter_metadata: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """Performs ensemble search asynchronously."""
        if not query or not isinstance(query, str):
            return []

        effective_top_k = top_k or self.top_k
        loop = asyncio.get_running_loop()
        
        with ThreadPoolExecutor() as executor:
            vector_task = None
            if self.collection:
                vector_task = loop.run_in_executor(executor, self._vector_search_sync, query, effective_top_k, filter_metadata)
            
            bm25_task = None
            if self.bm25:
                bm25_task = loop.run_in_executor(executor, self._bm25_search_sync, query, effective_top_k)

            results = await asyncio.gather(
                vector_task if vector_task else asyncio.sleep(0, result=[]),
                bm25_task if bm25_task else asyncio.sleep(0, result=[])
            )

        vector_results = results[0]
        bm25_results = results[1]
        
        if not vector_results and not bm25_results:
            return []

        combined_results = self._combine_results(vector_results, bm25_results)
        return self._rerank_results(query, combined_results)[:effective_top_k]

    def _vector_search_sync(self, query: str, top_k: int, filter_metadata: Optional[Dict] = None) -> List[Dict[str, Any]]:

        if not self.collection or not isinstance(self.collection, Collection):
            print("Warning: Milvus collection not available for vector search.") # Added warning
            return []

        # Generate query embedding
        query_embedding = self.model.encode(query, normalize_embeddings=True)
        search_params = {"metric_type": "L2", "params": {"nprobe": 10}}


        expr = "id >= 0"
        if filter_metadata is not None and filter_metadata:  # Check for non-empty dict
            expr_parts = [expr]
            for key, value in filter_metadata.items():
                
                safe_value = json.dumps(value) 
                expr_parts.append(f"metadata['{key}'] == {safe_value}")
                # Or using json_contains if value is complex or you need partial match:
                # expr_parts.append(f"json_contains(metadata, '{{\"{key}\": {safe_value}}}')")
            expr = " and ".join(expr_parts)
            print(f"Using filter expression: {expr}") # Debugging print

        # Perform vector search
        try: # Add try-except for robustness
            results = self.collection.search(
                data=[query_embedding.tolist()],  # Convert numpy array to list
                anns_field="embedding",          # Field storing embeddings in Milvus
                param=search_params,             # Search parameters
                limit=top_k,                     # Limit to top_k results
                expr=expr,                       # Filter expression
                output_fields=["id", "text", "metadata"]  # Fields to return
            )
        except Exception as e:
            print(f"Error during Milvus search: {e}") # Log the error
            return []


        # Process search results
        output = []
        if results and len(results) > 0 and len(results[0]) > 0:
            for hit in results[0]:
                score = 1.0 / (1.0 + hit.distance) if hit.distance >= 0 else 1.0
                # --- FIX ---
                text_content = getattr(hit.entity, 'text', '') # Default to empty string if 'text' attribute missing
                metadata_content = getattr(hit.entity, 'metadata', '{}') # Default to empty JSON string if 'metadata' attribute missing
                # --- END OF FIX ---

                output.append({
                    "id": hit.id,
                    "text": text_content,           # Use the retrieved text
                    "score": score,                 # Similarity score
                    "source": "vector",             # Source indicator
                    "metadata": metadata_content    # Use the retrieved metadata
                })
        elif results and len(results) > 0 and len(results[0]) == 0:
             print("Vector search returned results structure, but no hits found (possibly due to filter).") # More info
        elif not results:
             print("Vector search returned None or empty results.") # More info


        return output

    def _bm25_search_sync(self, query: str, top_k: int) -> List[Dict[str, Any]]:
        """Synchronous BM25 search."""
        if not self.bm25 or not self.bm25_docs:
            return []
        
        tokenized_query = self._preprocess_text(query)
        if not tokenized_query:
            return []
        
        bm25_scores = self.bm25.get_scores(tokenized_query)
        top_indices = sorted(
            [i for i, score in enumerate(bm25_scores) if score > 0],
            key=lambda i: bm25_scores[i], reverse=True
        )[:top_k]

        return [
            {"id": self.bm25_docs[i]["id"], "text": self.bm25_docs[i]["text"], 
             "score": bm25_scores[i], "source": "bm25", "metadata": self.bm25_docs[i]["metadata"]}
            for i in top_indices if i < len(self.bm25_docs)
        ]

    def _combine_results(self, vector_results: List[Dict[str, Any]], bm25_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Combines vector and BM25 results."""
        combined_dict: Dict[Any, Dict] = {}
        max_vec_score = max([r["score"] for r in vector_results] + [1e-9])
        max_bm25_score = max([r["score"] for r in bm25_results] + [1e-9])

        for result in vector_results:
            norm_score = result["score"] / max_vec_score
            combined_dict[result["id"]] = {
                "id": result["id"], "text": result["text"], "metadata": result["metadata"],
                "score": norm_score * self.vector_weight, "sources": ["vector"]
            }
        for result in bm25_results:
            norm_score = result["score"] / max_bm25_score
            if result["id"] in combined_dict:
                combined_dict[result["id"]]["score"] += norm_score * self.bm25_weight
                combined_dict[result["id"]]["sources"].append("bm25")
            else:
                combined_dict[result["id"]] = {
                    "id": result["id"], "text": result["text"], "metadata": result["metadata"],
                    "score": norm_score * self.bm25_weight, "sources": ["bm25"]
                }
        combined_list = list(combined_dict.values())
        combined_list.sort(key=lambda x: x["score"], reverse=True)
        return combined_list[:self.top_k * 2]

    def _rerank_results(self, query: str, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Reranks results using semantic similarity."""
        if not results:
            return []
        
        texts = [result["text"] for result in results]
        query_embedding = self.model.encode(query, normalize_embeddings=True)
        text_embeddings = self.model.encode(texts, batch_size=32, normalize_embeddings=True)
        similarities = util.cos_sim(query_embedding, text_embeddings)[0].cpu().tolist()

        processed_results = []
        for i, result in enumerate(results):
            final_score = 0.6 * similarities[i] + 0.4 * result["score"]
            metadata = result["metadata"] if isinstance(result["metadata"], dict) else json.loads(result["metadata"] or "{}")
            processed_results.append({
                "text": result["text"], "score": final_score, "source": ", ".join(result["sources"]),
                "metadata": result["metadata"], "title": metadata.get("title", "N/A"),
                "slide_number": metadata.get("slide_number", None), "timestamp": metadata.get("timestamp", None)
            })
        processed_results.sort(key=lambda x: x["score"], reverse=True)
        return processed_results

    def close(self):
 
        if self.collection:
            self.collection.release()
        connections.disconnect("default")