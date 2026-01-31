import os
from typing import List, Dict, Optional, Any
import chromadb
from sentence_transformers import SentenceTransformer
from langchain.text_splitter import RecursiveCharacterTextSplitter
from mistralai import Mistral
from pathlib import Path
from dotenv import load_dotenv
import json
import docx2txt
import uuid
from docx import Document
from config import settings

load_dotenv()

class DocumentIndexer:
    def __init__(self, collection_name: str = settings.CHROMA_COLLECTION, model_name: str = "all-MiniLM-L6-v2", 
                 chunk_size: int = 500, chunk_overlap: int = 50):
        # Khởi tạo ChromaDB Client
        if settings.CHROMA_SERVER_HOST and settings.CHROMA_SERVER_PORT:
            print(f"Connecting to ChromaDB Server at {settings.CHROMA_SERVER_HOST}:{settings.CHROMA_SERVER_PORT}")
            self.client = chromadb.HttpClient(host=settings.CHROMA_SERVER_HOST, port=int(settings.CHROMA_SERVER_PORT))
        else:
            print(f"using local ChromaDB at {settings.CHROMA_DB_PATH}")
            self.client = chromadb.PersistentClient(path=str(settings.CHROMA_DB_PATH))
        self.collection_name = collection_name
        self.collection = self.client.get_or_create_collection(name=collection_name)
        
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.model = SentenceTransformer(model_name)
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size, chunk_overlap=chunk_overlap, length_function=len, add_start_index=True
        )

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
            text_content = doc.page_content  # Chroma không giới hạn độ dài nghiêm ngặt như Milvus VARCHAR
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

            if not chunks_data:
                 return {"success": False, "documents_added": 0, "error": "No content to index"}

            # Chuẩn bị dữ liệu cho ChromaDB
            texts = [chunk["text"] for chunk in chunks_data]
            embeddings = self.model.encode(texts, batch_size=32).tolist()
            
            ids = []
            metadatas = []
            
            for i, chunk in enumerate(chunks_data):
                # Tạo ID duy nhất
                chunk_id = str(uuid.uuid4())
                ids.append(chunk_id)
                
                # Metadata trong Chroma nên phẳng (flat), nhưng code cũ dùng json string cho field 'metadata'
                # Để tương thích với code retriever cũ (parse json từ metadata), ta sẽ lưu:
                # 1. 'source': filename
                # 2. 'metadata': json string của toàn bộ metadata gốc
                orig_metadata = chunk["metadata"]
                meta_json = json.dumps(orig_metadata, ensure_ascii=False)
                
                metadatas.append({
                    "source": os.path.basename(file_path),
                    "metadata": meta_json  # Giữ tương thích với retriever cũ
                })

            # Thêm vào Chroma
            if ids:
                self.collection.add(
                    documents=texts,
                    embeddings=embeddings,
                    metadatas=metadatas,
                    ids=ids
                )
                return {"success": True, "documents_added": len(ids)}
            
            return {"success": True, "documents_added": 0}

        except Exception as e:
            print(f"Error indexing document: {str(e)}")
            return {"success": False, "documents_added": 0, "error": str(e)}