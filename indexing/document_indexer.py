import os
from typing import List, Dict, Optional, Any
from pymilvus import Collection, connections, FieldSchema, CollectionSchema, DataType, utility
from sentence_transformers import SentenceTransformer
from langchain.text_splitter import RecursiveCharacterTextSplitter
from mistralai import Mistral
from pathlib import Path
from dotenv import load_dotenv
import json
import docx2txt
import tempfile
from docx import Document
 

load_dotenv()

class DocumentIndexer:
    def __init__(self, collection_name: str, model_name: str = "all-MiniLM-L6-v2", 
                 host: str = "localhost", port: str = "19530", chunk_size: int = 500, chunk_overlap: int = 50):
        self.milvus_host = host
        self.milvus_port = port
        connections.connect(host=host, port=port)
        self.collection_name = collection_name
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.model = SentenceTransformer(model_name)
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size, chunk_overlap=chunk_overlap, length_function=len, add_start_index=True
        )
        self._setup_collection()

    def _setup_collection(self):
        if utility.has_collection(self.collection_name):
            self.collection = Collection(self.collection_name)
        else:
            fields = [
                FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=False),
                FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=65535),
                FieldSchema(name="source", dtype=DataType.VARCHAR, max_length=255),
                FieldSchema(name="metadata", dtype=DataType.VARCHAR, max_length=65535),
                FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=self.embedding_dim)
            ]
            schema = CollectionSchema(fields=fields, description=f"Collection for {self.collection_name}")
            self.collection = Collection(name=self.collection_name, schema=schema)
            self.collection.create_index(field_name="embedding", index_params={"metric_type": "L2", "index_type": "HNSW", "params": {"M": 8, "efConstruction": 64}})

    def _chunk_documents(self, text: str, source_path: str, doc_metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        langchain_docs = self.text_splitter.create_documents([text])
        chunks_data = []
        for doc in langchain_docs:
            chunk_metadata = {
                "source": os.path.basename(source_path) if isinstance(source_path, str) else "unknown",
                "start_index": doc.metadata.get("start_index", -1),
            }
            if doc_metadata:
                chunk_metadata.update(doc_metadata)
            text_content = doc.page_content[:65535]  # Cắt ngắn nếu vượt quá giới hạn
            chunks_data.append({"text": text_content, "metadata": chunk_metadata})
        return chunks_data

    def index_document(self, file_path: str, file_type: Optional[str] = None, 
                   chunk_size: Optional[int] = None, doc_metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            file_ext = os.path.splitext(file_path)[1].lower()
            base_metadata = doc_metadata or {"title": "Unknown"}
            base_metadata["filename"] = os.path.basename(file_path)

            # Đọc nội dung theo loại file
            if file_ext == '.pdf':
                client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))
                pdf_file = Path(file_path)
                uploaded_file = client.files.upload(file={"file_name": pdf_file.name, "content": pdf_file.read_bytes()}, purpose="ocr")
                signed_url = client.files.get_signed_url(file_id=uploaded_file.id, expiry=1)
                ocr_response = client.ocr.process(model="mistral-ocr-latest", document={"type": "document_url", "document_url": signed_url.url})
                chunks_data = []
                for page_num, page in enumerate(ocr_response.pages, 1):
                    content = page.markdown
                    page_metadata = base_metadata.copy()
                    page_metadata.update({"doc_type": "pdf", "slide_number": page_num})
                    chunks_data.extend(self._chunk_documents(content, file_path, page_metadata))
            elif file_ext == '.docx':
                doc = Document(file_path)
                content = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
                base_metadata["doc_type"] = "docx"
                chunks_data = self._chunk_documents(content, file_path, base_metadata)
            elif file_ext == '.txt':
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                base_metadata["doc_type"] = "txt"
                chunks_data = self._chunk_documents(content, file_path, base_metadata)
            else:
                return {"success": False, "documents_added": 0, "error": f"Unsupported file type: {file_ext}"}

            # Lập chỉ mục chung
            vectors = self.model.encode([chunk["text"] for chunk in chunks_data], batch_size=32).tolist()
            entities = [
                {
                    "id": i,
                    "text": chunk["text"],
                    "source": os.path.basename(file_path),
                    "metadata": json.dumps(chunk["metadata"], ensure_ascii=False),
                    "embedding": vector
                }
                for i, (chunk, vector) in enumerate(zip(chunks_data, vectors))
                if chunk["text"].strip()
            ]
            
            if entities:
                self.collection.insert(entities)
                self.collection.flush()
                return {"success": True, "documents_added": len(entities)}
            return {"success": False, "documents_added": 0, "error": "No content to index"}
        except Exception as e:
            print(f"Error indexing document: {str(e)}")
            return {"success": False, "documents_added": 0, "error": str(e)}