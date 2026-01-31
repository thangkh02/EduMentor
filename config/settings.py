# config.py (Kiểm tra lại và bổ sung nếu cần)
import os
from dotenv import load_dotenv

load_dotenv()

# --- ChromaDB Configuration ---
# Lưu trữ database ngay trong thư mục data của project để không cần cài đặt gì thêm
CHROMA_DB_PATH = os.path.join(os.getcwd(), "data", "chroma_db")
os.makedirs(CHROMA_DB_PATH, exist_ok=True)

CHROMA_SERVER_HOST = os.getenv("CHROMA_SERVER_HOST")
CHROMA_SERVER_PORT = os.getenv("CHROMA_SERVER_PORT")

DEFAULT_COLLECTION_NAME = "learning_docs"
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", DEFAULT_COLLECTION_NAME)

# --- MongoDB Configuration ---
MONGODB_HOST = os.getenv("MONGODB_HOST", "localhost") 
MONGODB_PORT = int(os.getenv("MONGODB_PORT", 27017))
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "edumentor")
MONGODB_COLLECTION = os.getenv("MONGODB_COLLECTION", "edumentor")
MONGODB_URI = os.getenv("MONGODB_URI", f"mongodb://{MONGODB_HOST}:{MONGODB_PORT}")

# --- JWT Authentication ---
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-please-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24))  # 1 day

# --- Embedding Model ---
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# --- LLM Configuration ---
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
LLM_GROQ_MODEL = os.getenv("LLM_GROQ_MODEL", "llama-3.3-70b-versatile")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", 0.05))

# --- Web Search Configuration ---
SERPER_API_KEY = os.getenv("SERPER_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

# --- Indexing Configuration ---
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 500))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 50))

# --- Upload Directory ---
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- Logging ---
LOGGING_LEVEL = os.getenv("LOGGING_LEVEL", "INFO").upper()

# --- Retriever Configuration ---
RETRIEVER_TOP_K = int(os.getenv("RETRIEVER_TOP_K", 5))
VECTOR_WEIGHT = float(os.getenv("VECTOR_WEIGHT", 0.7))
BM25_WEIGHT = float(os.getenv("BM25_WEIGHT", 0.3))

# --- API Configuration ---
API_PORT = int(os.getenv("API_PORT", 5000))
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_RELOAD = os.getenv("API_RELOAD", "true").lower() == "true"
API_TIMEOUT = int(os.getenv("API_TIMEOUT", 120)) # Timeout cho request /ask

# --- Simple Check ---
