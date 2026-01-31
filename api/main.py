from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Depends, Header, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from auth.models import UserBase, UserCreate, UserLogin, Token, UserUpdate, TokenData, StatsResponse, StatsUpdate
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json
from pathlib import Path
import asyncio
import logging
from contextlib import asynccontextmanager
from core.learning_assistant_v2 import LearningAssistant
from indexing.document_indexer import DocumentIndexer
from auth.utils import (
    authenticate_user, create_access_token, verify_token,
    get_password_hash, get_mongo_connection
)
from config import settings as config # Import the config settings

# Ensure StatsResponse is imported
from auth.models import UserBase, UserCreate, UserLogin, Token, UserUpdate, TokenData, StatsResponse, StatsUpdate
from datetime import datetime, timedelta, timezone

# Import router stats mới
from api.stats import router as stats_router

# Thiết lập logging thay vì print
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Biến toàn cục để lưu trữ tài nguyên
assistant = None
document_indexer = None
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Context manager để quản lý lifecycle của ứng dụng
@asynccontextmanager
async def lifespan(app: FastAPI):
    global assistant, document_indexer
    mongo_collection = None # Initialize mongo_collection to None
    chroma_collection_name = os.getenv("CHROMA_COLLECTION", config.DEFAULT_COLLECTION_NAME) # Use config default
    logger.info(f"Starting EduMentor API with Chroma collection: {chroma_collection_name}")

    # --- Get MongoDB Connection ---
    try:
        # Use the utility function to get the collection
        mongo_collection = get_mongo_connection()
        logger.info(f"Successfully connected to MongoDB collection: {config.MONGODB_DB_NAME}/{config.MONGODB_COLLECTION}")
    except Exception as e:
        logger.error(f"CRITICAL: Failed to connect to MongoDB during startup: {e}. Some features might be disabled.")
        # Decide if the app should proceed without MongoDB or raise the error
        # For now, let it proceed but log the warning. Assistant will handle None collection.
        # raise # Uncomment this to prevent startup without DB

    # --- Initialize Assistant and Indexer ---
    try:
        # Pass the mongo_collection (which might be None) to the assistant
        assistant = LearningAssistant(
            mongo_collection=mongo_collection,
            collection_name=chroma_collection_name
        )
        document_indexer = DocumentIndexer(collection_name=chroma_collection_name)
        logger.info("LearningAssistant and DocumentIndexer initialized successfully")
        yield # Application runs here
    except Exception as e:
        logger.error(f"Error initializing core resources (Assistant/Indexer): {e}")
        raise # Raise error if core components fail to initialize
    finally:
        logger.info("Shutting down EduMentor API")
        if assistant:
            try:
                assistant.close()
                logger.info("LearningAssistant closed")
            except Exception as e:
                logger.error(f"Error closing LearningAssistant: {e}")
        if document_indexer and hasattr(document_indexer, 'close'):
            try:
                document_indexer.close()
                logger.info("DocumentIndexer closed")
            except Exception as e:
                logger.error(f"Error closing DocumentIndexer: {e}")

# Khởi tạo FastAPI app
app = FastAPI(
    title="EduMentor API",
    description="API cho hệ thống hỗ trợ học tập EduMentor",
    version="2.0.0",
    lifespan=lifespan
)

# Thêm CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Cập nhật danh sách này trong production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký router stats
app.include_router(stats_router)

# --- Pydantic Models ---l

# Model cho endpoint /tools (chung)
class ToolRequest(BaseModel):
    action: str # Tên hành động/tool (e.g., "quiz", "summary")
    input: str  # Đầu vào chính cho tool (e.g., chủ đề, câu hỏi)
    context: Optional[str] = None # Ngữ cảnh bổ sung (tùy chọn)
    options: Optional[Dict[str, Any]] = None # Các tùy chọn khác (tùy chọn)

# Model cho endpoint /tools/{tool_name} (cụ thể) - Bỏ action vì đã có trong path
class SpecificToolInput(BaseModel):
    input: str # Đầu vào chính cho tool
    context: Optional[str] = None # Ngữ cảnh bổ sung (tùy chọn)
    options: Optional[Dict[str, Any]] = None # Các tùy chọn khác (tùy chọn)

class AskRequest(BaseModel):
    question: str

# --- Models for Quiz Submission ---
class QuizQuestion(BaseModel):
    id: int
    question_text: str
    options: List[str]
    correct_answer_index: int

class QuizSubmission(BaseModel):
    quiz_id: str
    questions: List[QuizQuestion] # Send original questions back for grading
    answers: Dict[int, int] # {question_id: selected_option_index}

class QuizResult(BaseModel):
    quiz_id: str
    score: float # Percentage score
    total_questions: int
    correct_count: int
    results: Dict[int, bool] # {question_id: is_correct}
    feedback: Optional[str] = None # Optional overall feedback

class UploadResponse(BaseModel):
    success: bool
    filename: str
    indexed: bool
    documents_added: int
    file_type: str
    message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class ApiResponse(BaseModel):
    response: Any
    sources: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None

# Thư mục lưu trữ file upload
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# --- Endpoints API ---






# --- Authentication Helper ---
# Define get_current_user BEFORE it's used as a dependency
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Xác thực người dùng hiện tại từ token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Ghi log thông tin request để debug
    logger.info(f"Authenticating user with token")
    
    # Xác thực token
    token_data = verify_token(token)
    if token_data is None:
        logger.error(f"Token verification failed - invalid or expired token")
        # Thay đổi thông báo lỗi để cung cấp thông tin chi tiết hơn
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Lấy thông tin người dùng từ database để đảm bảo dữ liệu mới nhất
    try:
        collection = get_mongo_connection()
        username = token_data.get("username")
        
        # Ghi log để debug
        logger.info(f"Attempting to authenticate user: {username}")
        
        # Kiểm tra username có giá trị không
        if not username:
            logger.error("Username not found in token data")
            raise credentials_exception
            
        user = collection.find_one({"_id": username})
        
        if not user:
            logger.error(f"User not found in database: {username}")
            raise credentials_exception
            
        # Loại bỏ hashed_password từ thông tin trả về
        if "hashed_password" in user:
            user_dict = dict(user)
            user_dict.pop("hashed_password")
            return user_dict
            
        return dict(user)
    except Exception as e:
        logger.error(f"Error retrieving user data: {e}")
        raise credentials_exception

# --- Main API Endpoints ---

@app.post("/ask", response_model=ApiResponse)
# Add optional current_user dependency (now defined above)
async def ask_question(request: AskRequest, current_user: Optional[dict] = Depends(get_current_user)): 
    """Xử lý câu hỏi từ người dùng. Lưu lịch sử nếu người dùng đã đăng nhập."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống")

    if not assistant:
        raise HTTPException(status_code=503, detail="Hệ thống đang khởi động, vui lòng thử lại sau")

    try:
        # Extract username if authenticated
        username = current_user.get("username") if current_user else None
        
        logger.info(f"Processing question for user '{username or 'anonymous'}': {request.question[:100]}...")
        # Pass username to the answer method
        result = await asyncio.wait_for(assistant.answer(request.question, username=username), timeout=120.0) 

        if not result or "response" not in result:
            logger.error(f"Invalid response from workflow: {result}")
            raise HTTPException(status_code=500, detail="Không thể tạo câu trả lời từ workflow")

        metadata = {
            "timestamp": asyncio.get_event_loop().time(),
            "route_decision": result.get("metadata", {}).get("route_decision"),
            "selected_tool": result.get("metadata", {}).get("selected_tool"),
            "executed_tools": list(result.get("tool_outputs", {}).keys()) if result.get("tool_outputs") else []
        }

        return ApiResponse(
            response=result["response"],
            sources=result.get("sources", []),
            metadata=metadata
        )
    except asyncio.TimeoutError:
        logger.warning(f"Timeout processing question: {request.question[:50]}...")
        return ApiResponse(
            response="Quá thời gian xử lý câu hỏi. Vui lòng thử lại.",
            sources=[],
            metadata={"error": "timeout"}
)
    except Exception as e:
        logger.error(f"Error processing /ask: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi máy chủ khi xử lý câu hỏi: {str(e)}")


# Endpoint để thực thi một công cụ cụ thể qua path parameter
@app.post("/tools/{tool_name}", response_model=ApiResponse)
async def use_specific_tool(
    tool_name: str, 
    request: SpecificToolInput,
    current_user: Dict = Depends(get_current_user)  # Thêm dependency này để xác thực người dùng
): 
    """Thực thi một công cụ cụ thể theo tên được cung cấp trong URL path."""
    tool_map = {
        "quiz": "Quiz_Generator",
        "flashcard": "Flashcard_Generator",
        "study_plan": "Study_Plan_Creator",
        "concept": "Concept_Explainer",
        "summary": "Summary_Generator",
        "mindmap": "Mind_Map_Creator",
        "progress": "Progress_Tracker",
        "rag": "RAG_Search",
        "web_search": "Web_Search"
    }

    # Kiểm tra xem tool_name có trong danh sách không
    if tool_name not in tool_map:
        raise HTTPException(status_code=400, detail=f"Công cụ '{tool_name}' không được hỗ trợ")
    
    actual_tool_name = tool_map[tool_name]

    if not assistant or not assistant.tool_registry.has_tool(actual_tool_name):
        raise HTTPException(status_code=503, detail=f"Hệ thống đang khởi động hoặc công cụ '{actual_tool_name}' không khả dụng.")

    try:
        # Chuẩn bị arguments cho tool execute
        # 'question' là key mặc định mà nhiều tool dùng cho input chính
        tool_kwargs = {"question": request.input}
        if request.context:
            tool_kwargs["context"] = request.context

        # Đảm bảo options có thông tin người dùng khi cần
        options = request.options or {}
        
        # Luôn đặt username từ thông tin người dùng xác thực vào options
        # Nếu username đã được cung cấp trong options, giữ nguyên giá trị đó
        if not options.get("username") and current_user.get("username"):
            options["username"] = current_user.get("username")
            logger.info(f"Setting authenticated username '{options['username']}' for tool {actual_tool_name}")
        
        # Cập nhật tool_kwargs với options đã được bổ sung username
        if options:
            tool_kwargs["options"] = options
        
        logger.info(f"Executing tool: {actual_tool_name} with input: {request.input[:50]}...")
        result = await assistant.tool_registry.execute_tool(actual_tool_name, **tool_kwargs)
        
        # Xử lý đặc biệt cho Progress_Tracker
        if actual_tool_name == "Progress_Tracker":
            # Trả về dữ liệu trực tiếp không cần chuyển đổi nữa vì tool đã trả về dict
            return ApiResponse(
                response=result,
                metadata={"tool_executed": actual_tool_name, "input_provided": request.input[:100]}
            )
        else:
            # Các công cụ khác vẫn xử lý như bình thường
            return ApiResponse(
                response=result,
                metadata={"tool_executed": actual_tool_name, "input_provided": request.input[:100]}
            )
    except Exception as e:
        logger.error(f"Error executing tool {actual_tool_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi khi chạy công cụ '{actual_tool_name}': {str(e)}")


# --- Endpoint for Quiz Submission ---
@app.post("/tools/quiz/submit", response_model=QuizResult)
async def submit_quiz(submission: QuizSubmission):
    """Nhận và chấm điểm bài quiz đã nộp."""
    logger.info(f"Received submission for quiz_id: {submission.quiz_id}")
    
    correct_count = 0
    results = {}
    total_questions = len(submission.questions)

    if total_questions == 0:
        raise HTTPException(status_code=400, detail="Không có câu hỏi nào trong bài nộp.")

    # Grade the quiz
    for question in submission.questions:
        question_id = question.id
        user_answer_index = submission.answers.get(question_id)
        correct_answer_index = question.correct_answer_index
        
        is_correct = user_answer_index == correct_answer_index
        results[question_id] = is_correct
        if is_correct:
            correct_count += 1
            
    score = (correct_count / total_questions) * 100 if total_questions > 0 else 0
    
    logger.info(f"Graded quiz {submission.quiz_id}: Score {score:.2f}% ({correct_count}/{total_questions})")

    # TODO: Add optional LLM-based feedback generation here if desired
    # feedback_prompt = f"Người dùng vừa hoàn thành bài quiz {submission.quiz_id} với điểm {score:.2f}%. Hãy đưa ra nhận xét ngắn gọn và lời khuyên học tập."
    # llm_feedback = await assistant.llm.ainvoke(feedback_prompt) # Requires assistant instance access

    return QuizResult(
        quiz_id=submission.quiz_id,
        score=score,
        total_questions=total_questions,
        correct_count=correct_count,
        results=results,
        feedback=None # Placeholder for LLM feedback
    )

@app.get("/", summary="Kiểm tra trạng thái API")
async def root():
    """Kiểm tra trạng thái API."""
    return {"status": "EduMentor API is running", "version": "2.0.0"}

# --- Authentication & User Management Endpoints ---

# get_current_user is now defined above the endpoints that use it

@app.post("/register", response_model=Token)
async def register_user(user: UserCreate):
    """Đăng ký người dùng mới"""
    try:
        collection = get_mongo_connection()
        
        # Kiểm tra xem người dùng đã tồn tại chưa
        existing_user = collection.find_one({"_id": user.username})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username đã tồn tại")
        
        # Tạo user mới
        hashed_password = get_password_hash(user.password)
        now_utc = datetime.now(timezone.utc)
        
        user_data = {
            "_id": user.username,
            "username": user.username,
            "hashed_password": hashed_password,
            "email": user.email,
            "full_name": user.full_name,
            "created_at": now_utc,
            "updated_at": now_utc
        }
        
        collection.insert_one(user_data)
        logger.info(f"New user registered: {user.username}")
        
        # Tạo token và trả về
        access_token = create_access_token(data={"sub": user.username})
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "username": user.username,
            "full_name": user.full_name
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        raise HTTPException(status_code=500, detail="Lỗi máy chủ khi đăng ký người dùng")

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """Đăng nhập và lấy access token"""
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Tạo JWT token
    access_token = create_access_token(data={"sub": user["username"]})
    
    # Cập nhật thời gian đăng nhập cuối cùng
    try:
        collection = get_mongo_connection()
        collection.update_one(
            {"_id": user["username"]},
            {"$set": {"last_login": datetime.now(timezone.utc)}}
        )
    except Exception as e:
        logger.error(f"Error updating last login: {e}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user["username"],
        "full_name": user.get("full_name")
    }

@app.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    """Endpoint đăng nhập thân thiện hơn"""
    user = authenticate_user(user_data.username, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác"
        )
    
    # Tạo JWT token
    access_token = create_access_token(data={"sub": user["username"]})
    
    # Cập nhật thời gian đăng nhập cuối cùng
    try:
        collection = get_mongo_connection()
        collection.update_one(
            {"_id": user["username"]},
            {"$set": {"last_login": datetime.now(timezone.utc)}}
        )
    except Exception as e:
        logger.error(f"Error updating last login: {e}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user["username"],
        "full_name": user.get("full_name")
    }

@app.get("/me", response_model=UserBase)
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    """Lấy thông tin người dùng hiện tại"""
    try:
        # current_user đã là thông tin người dùng đầy đủ từ database
        # được trả về bởi hàm get_current_user đã sửa
        if not current_user or "username" not in current_user:
            logger.error(f"Invalid user data in token: {current_user}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Thông tin người dùng không hợp lệ",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return {
            "username": current_user["username"],
            "email": current_user.get("email"),
            "full_name": current_user.get("full_name")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail="Lỗi máy chủ khi lấy thông tin người dùng")

@app.put("/me", response_model=UserBase)
async def update_user_profile(user_update: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Cập nhật thông tin người dùng"""
    try:
        username = current_user.get("username")
        collection = get_mongo_connection()
        
        # Chuẩn bị dữ liệu cập nhật
        update_data = {"updated_at": datetime.now(timezone.utc)}
        if user_update.email is not None:
            update_data["email"] = user_update.email
        if user_update.full_name is not None:
            update_data["full_name"] = user_update.full_name
        if user_update.password is not None:
            update_data["hashed_password"] = get_password_hash(user_update.password)
        
        # Cập nhật người dùng
        result = collection.update_one(
            {"_id": username},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Người dùng không tồn tại")
        
        # Lấy thông tin đã cập nhật
        updated_user = collection.find_one({"_id": username})
        
        return {
            "username": updated_user["username"],
            "email": updated_user.get("email"),
            "full_name": updated_user.get("full_name")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        raise HTTPException(status_code=500, detail="Lỗi máy chủ khi cập nhật thông tin người dùng")


# --- File Management Endpoints (Moved here to have access to get_current_user) ---

@app.post("/upload", response_model=UploadResponse)
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload file và chạy indexing trong background."""
    try:
        allowed_extensions = {'.pdf', '.docx', '.doc', '.txt', '.pptx', '.ppt'}
        file_ext = Path(file.filename).suffix.lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Định dạng file không được hỗ trợ. Chỉ chấp nhận: {', '.join(allowed_extensions)}"
            )

        # Tạo tên file duy nhất để tránh xung đột
        safe_filename = f"{Path(file.filename).stem}_{os.urandom(4).hex()}{file_ext}"
        file_location = UPLOAD_DIR / safe_filename

        # Lưu file
        try:
            with open(file_location, "wb") as f:
                content = await file.read()
                f.write(content)
        except IOError as e:
            logger.error(f"Failed to save file {file.filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Không thể lưu file: {e}")

        # Hàm chạy indexing trong background
        def run_indexing(location: Path, ext: str):
            logger.info(f"Indexing file {location.name} in background")
            try:
                metadata = {"original_filename": file.filename}
                if ext == '.pdf':
                    result = document_indexer.index_document(str(location), doc_metadata=metadata)
                elif ext in ['.pptx', '.ppt']:
                    result = document_indexer.index_document(str(location), file_type="pptx", doc_metadata=metadata)
                elif ext in ['.docx', '.doc']:
                    result = document_indexer.index_document(str(location), file_type="docx", doc_metadata=metadata)
                else:  # .txt
                    result = document_indexer.index_document(str(location), doc_metadata=metadata)
                
                if result.get("success"):
                    logger.info(f"Indexed {location.name}: {result.get('documents_added', 0)} chunks added")
                else:
                    logger.error(f"Indexing failed for {location.name}: {result.get('error', 'Unknown error')}")
            except Exception as e:
                logger.error(f"Error indexing {location.name}: {e}")

        background_tasks.add_task(run_indexing, file_location, file_ext)

        # INSERT INTRO DB: Save file metadata for user
        try:
            print(f"DEBUG: Attempting to save file metadata for user {current_user['_id']}")
            users_collection = get_mongo_connection()
            db = users_collection.database
            files_collection = db["user_files"]
            
            file_record = {
                "user_id": current_user["_id"],
                "filename": safe_filename,
                "original_filename": file.filename,
                "file_path": str(file_location),
                "file_size": file_location.stat().st_size if file_location.exists() else 0,
                "content_type": file.content_type,
                "created_at": datetime.now(timezone.utc)
            }
            result = files_collection.insert_one(file_record)
            logger.info(f"Saved file metadata for user {current_user['_id']}")
            print(f"DEBUG: Successfully saved file metadata. ID: {result.inserted_id}")
        except Exception as e:
            logger.error(f"Error saving user file metadata: {e}")
            print(f"DEBUG: Error saving user file metadata: {e}")
            # Non-critical, continue

        return UploadResponse(
            success=True,
            filename=file.filename,
            indexed=False,  # Indexing chưa hoàn thành
            documents_added=0,
            file_type=file_ext,
            message="File đã được nhận và đang được xử lý trong background",
            metadata={"saved_as": safe_filename}
        )
    except Exception as e:
        logger.error(f"Unexpected error in /upload: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi máy chủ: {str(e)}")

@app.get("/files", response_model=Dict[str, Any])
async def list_files(current_user: dict = Depends(get_current_user)):
    """List all files uploaded by the current user."""
    print(f"DEBUG: list_files called for user {current_user.get('username')}")
    try:
        users_collection = get_mongo_connection()
        db = users_collection.database
        print(f"DEBUG: Connected to DB: {db.name}")
        
        files_collection = db["user_files"]
        
        # Query files for current user
        query = {"user_id": current_user["_id"]}
        print(f"DEBUG: Querying files with: {query}")
        
        cursor = files_collection.find(query).sort("created_at", -1)
        files = []
        for doc in cursor:
            files.append({
                "id": str(doc["_id"]),
                "name": doc["original_filename"],
                "filename": doc["filename"], # safe filename
                "size": doc.get("file_size", 0),
                "created_at": doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"],
                "type": doc.get("content_type", "unknown")
            })
        
        print(f"DEBUG: Found {len(files)} files") 
        return {
            "success": True,
            "files": files,
            "count": len(files)
        }
    except Exception as e:
        logger.error(f"Error listing files: {e}")
        print(f"DEBUG: Error listing files: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi lấy danh sách file: {str(e)}")


@app.delete("/files/{file_id}", response_model=Dict[str, Any])
async def delete_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a file uploaded by the current user."""
    try:
        users_collection = get_mongo_connection()
        db = users_collection.database
        files_collection = db["user_files"]
        
        # Find file belonging to user
        from bson.objectid import ObjectId
        try:
             # Try objectId first
             query = {"_id": ObjectId(file_id), "user_id": current_user["_id"]}
        except:
             # Fallback to checking by filename if for some reason ID structure differs
             # But we should rely on ObjectId from previous list call
             raise HTTPException(status_code=400, detail="Invalid file ID format")

        file_doc = files_collection.find_one(query)
        
        if not file_doc:
            raise HTTPException(status_code=404, detail="File không tồn tại hoặc bạn không có quyền xóa")
            
        # Delete physical file
        filename = file_doc["filename"]
        file_path = UPLOAD_DIR / filename
        if file_path.exists():
            os.remove(file_path)
            
        # Delete DB record
        files_collection.delete_one({"_id": file_doc["_id"]})
        
        return {
            "success": True,
            "message": f"Đã xóa file {file_doc['original_filename']}"
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error deleting file {file_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa file: {str(e)}")

from fastapi.responses import FileResponse

@app.get("/files/{file_id}/content")
async def get_file_content(file_id: str, current_user: dict = Depends(get_current_user)):
    """Retrieve file content for preview or download."""
    try:
        users_collection = get_mongo_connection()
        db = users_collection.database
        files_collection = db["user_files"]
        
        # Verify ownership
        from bson.objectid import ObjectId
        query = {"_id": ObjectId(file_id), "user_id": current_user["_id"]}
        
        file_doc = files_collection.find_one(query)
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found or access denied")
            
        filename = file_doc["filename"] # safe filename on disk
        file_path = UPLOAD_DIR / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File content not found on server")
            
        # Determine media type
        media_type = file_doc.get("content_type", "application/octet-stream")
        
        # Return file response
        # Using 'inline' disposition allows browser to preview if possible (PDF, Text, Images)
        return FileResponse(
            path=file_path, 
            media_type=media_type, 
            filename=file_doc["original_filename"],
            headers={"Content-Disposition": f"inline; filename*=utf-8''{file_doc['original_filename']}"}
        )
            
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error retrieving file content {file_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving file: {str(e)}")
# --- Stats Endpoints ---

@app.get("/stats/{username}", response_model=StatsResponse)
async def get_user_stats(username: str, current_user: dict = Depends(get_current_user)):
    """Lấy thống kê học tập của người dùng"""
    try:
        # Kiểm tra quyền truy cập
        if current_user.get("username") != username and not current_user.get("is_admin", False):
            logger.warning(f"Access denied: User {current_user.get('username')} attempted to access stats of {username}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Không được phép xem thống kê của người dùng khác"
            )
            
        collection = get_mongo_connection()
        user_data = collection.find_one({"_id": username})
        
        if not user_data:
            logger.warning(f"User not found: {username}")
            raise HTTPException(status_code=404, detail="Người dùng không tồn tại")
        
        # Chuẩn bị dữ liệu thống kê
        stats_data = {
            "username": username,
            "last_activity": user_data.get("last_activity", None),
            "subjects": {},
            "documents": [],  # Khởi tạo danh sách documents trống
            "flashcards": {},  # Khởi tạo flashcards là dict trống
            "completed_quizzes": len(user_data.get("completed_quizzes", [])),
            "chat_history_count": user_data.get("chat_history_count", 0),
            "recommendations": []
        }
        
        # Đảm bảo user_data có trường stats
        if "stats" not in user_data or not isinstance(user_data["stats"], dict):
            # Khởi tạo trường stats nếu chưa tồn tại hoặc không phải là dict
            user_data["stats"] = {}
            # Cập nhật vào cơ sở dữ liệu
            collection.update_one({"_id": username}, {"$set": {"stats": {}}})
            logger.info(f"Initialized empty stats for user: {username}")
        
        # Thêm thông tin documents nếu có
        if "documents" in user_data and isinstance(user_data["documents"], list):
            stats_data["documents"] = user_data["documents"]
            
        # Thêm thông tin flashcards nếu có
        if "flashcards" in user_data and isinstance(user_data["flashcards"], dict):
            stats_data["flashcards"] = user_data["flashcards"]
        
        # Trích xuất dữ liệu tiến độ môn học từ MongoDB
        # Vì đã đảm bảo user_data có trường stats, nên không cần kiểm tra "stats" in user_data
        for subject, data in user_data["stats"].items():
            if not isinstance(data, dict):
                logger.warning(f"Invalid stats data format for subject {subject}: {data}")
                continue
                
            # Đảm bảo progress_updated_at là đối tượng datetime hoặc None
            progress_updated_at = data.get("progress_updated_at")
            # Nếu progress_updated_at không phải là None và không phải là đối tượng datetime,
            # thì chuyển đổi nó thành None để tránh lỗi
            if progress_updated_at is not None and not isinstance(progress_updated_at, datetime):
                logger.warning(f"Invalid progress_updated_at format for {subject}: {progress_updated_at}")
                progress_updated_at = None
            
            stats_data["subjects"][subject] = {
                "progress": data.get("progress", 0),
                "progress_updated_at": progress_updated_at,
                "description": data.get("description", None)  # Thêm trường description theo model
            }
        
        # Tạo đề xuất học tập đơn giản
        incomplete_subjects = [
            subject for subject, data in stats_data["subjects"].items() 
            if data["progress"] < 100
        ]
        
        if incomplete_subjects:
            stats_data["recommendations"].append(
                f"Tiếp tục học môn {incomplete_subjects[0]} để hoàn thành tiến độ."
            )
            
        # Đề xuất dựa trên hoạt động gần đây
        if stats_data["last_activity"]:
            last_activity_time = stats_data["last_activity"]
            now = datetime.now(timezone.utc)
            
            # Đảm bảo last_activity_time có timezone trước khi thực hiện phép trừ
            if last_activity_time.tzinfo is None:
                # Nếu last_activity_time không có timezone, giả định nó là UTC
                last_activity_time = last_activity_time.replace(tzinfo=timezone.utc)
                
            days_since_last_activity = (now - last_activity_time).days
            
            if days_since_last_activity > 7:
                stats_data["recommendations"].append(
                    f"Bạn đã không hoạt động trong {days_since_last_activity} ngày. Hãy luyện tập đều đặn để duy trì kiến thức."
                )
        
        logger.info(f"Successfully retrieved stats for user: {username}")
        return stats_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user stats: {e}")
        raise HTTPException(status_code=500, detail="Lỗi máy chủ khi lấy thống kê học tập")

@app.put("/stats/update", response_model=ApiResponse)
async def update_user_stats(stats_update: StatsUpdate, current_user: dict = Depends(get_current_user)):
    """Cập nhật thống kê học tập của người dùng"""
    try:
        username = stats_update.username
        
        # Kiểm tra quyền truy cập
        if current_user.get("username") != username and not current_user.get("is_admin", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Không được phép cập nhật thống kê của người dùng khác"
            )
            
        collection = get_mongo_connection()
        user_data = collection.find_one({"_id": username})
        
        if not user_data:
            raise HTTPException(status_code=404, detail="Người dùng không tồn tại")
        
        # Đảm bảo user_data có trường stats
        if "stats" not in user_data:
            # Khởi tạo trường stats nếu chưa tồn tại
            user_data["stats"] = {}
            # Cập nhật vào cơ sở dữ liệu
            collection.update_one({"_id": username}, {"$set": {"stats": {}}})
            logger.info(f"Initialized empty stats for user: {username}")
            
        # Cập nhật thông tin thống kê
        update_data = {
            "last_activity": datetime.now(timezone.utc)
        }
        
        # Cập nhật tiến độ học tập cho môn học
        if stats_update.subject:
            subject = stats_update.subject
            progress = stats_update.progress if stats_update.progress is not None else 0
            
            # Tạo hoặc cập nhật thông tin môn học
            stats_key = f"stats.{subject}"
            update_data[stats_key] = {
                "progress": progress,
                "progress_updated_at": datetime.now(timezone.utc)
            }
            
            logger.info(f"Updating stats for user {username}, subject {subject}: {progress}%")
        
        # Cập nhật thông tin flashcard nếu có
        if stats_update.flashcards:
            for card_id, review_data in stats_update.flashcards.items():
                flashcard_key = f"flashcards.{card_id}"
                update_data[flashcard_key] = {
                    "correct_count": review_data.get("correct", 0),
                    "review_count": review_data.get("reviewed", 0),
                    "last_review": datetime.now(timezone.utc)
                }
        
        # Cập nhật lịch sử quiz nếu có
        if stats_update.completed_quiz:
            quiz_data = stats_update.completed_quiz
            collection.update_one(
                {"_id": username},
                {"$push": {"completed_quizzes": {
                    "quiz_id": quiz_data.get("quiz_id"),
                    "score": quiz_data.get("score"),
                    "completed_at": datetime.now(timezone.utc)
                }}}
            )
        
        # Cập nhật vào database
        result = collection.update_one(
            {"_id": username},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Không thể cập nhật thống kê người dùng")
        
        return ApiResponse(
            response={
                "success": True,
                "message": "Đã cập nhật thống kê học tập"
            },
            metadata={
                "updated_fields": list(update_data.keys())
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user stats: {e}")
        raise HTTPException(status_code=500, detail="Lỗi máy chủ khi cập nhật thống kê học tập")


# --- Conversation Endpoints (NEW) ---

@app.get("/conversations", response_model=Dict[str, Any])
async def list_conversations(
    current_user: dict = Depends(get_current_user), 
    limit: int = 20,
    skip: int = 0,
    is_active: Optional[bool] = None
):
    """Lấy danh sách conversations của người dùng hiện tại"""
    try:
        username = current_user.get("username")
        collection = get_mongo_connection()
        db = collection.database
        conversations_collection = db["conversations"]
        
        # Build query
        query = {"username": username}
        if is_active is not None:
            query["is_active"] = is_active
        
        # Get total count
        total = conversations_collection.count_documents(query)
        
        # Get paginated conversations
        conversations = list(
            conversations_collection.find(query)
            .sort("updated_at", -1)
            .skip(skip)
            .limit(limit)
        )
        
        # Convert ObjectId to string for JSON serialization
        for conv in conversations:
            conv["_id"] = str(conv["_id"])
        
        return {
            "conversations": conversations,
            "total": total,
            "limit": limit,
            "skip": skip
        }
    
    except Exception as e:
        logger.error(f"Error listing conversations for {current_user.get('username')}: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi lấy danh sách cuộc trò chuyện: {str(e)}")


@app.post("/conversations", response_model=Dict[str, Any])
async def create_conversation(
    current_user: dict = Depends(get_current_user),
    title: Optional[str] = None
):
    """Tạo conversation mới"""
    try:
        from bson import ObjectId
        import uuid
        
        username = current_user.get("username")
        collection = get_mongo_connection()
        db = collection.database
        conversations_collection = db["conversations"]
        
        now_utc = datetime.now(timezone.utc)
        
        # Deactivate all current active conversations for this user
        conversations_collection.update_many(
            {"username": username, "is_active": True},
            {"$set": {"is_active": False}}
        )
        
        # Create new conversation
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        conversation_title = title or "Cuộc trò chuyện mới"
        
        conversation_doc = {
            "_id": ObjectId(),
            "username": username,
            "session_id": session_id,
            "title": conversation_title,
            "created_at": now_utc,
            "updated_at": now_utc,
            "is_active": True,
            "is_archived": False,
            "message_count": 0,
            "topic_tags": [],
            "messages": []
        }
        
        result = conversations_collection.insert_one(conversation_doc)
        
        # Update user's total conversations count
        collection.update_one(
            {"_id": username},
            {
                "$inc": {"total_conversations": 1},
                "$set": {"last_activity": now_utc}
            },
            upsert=True
        )
        
        logger.info(f"Created new conversation {result.inserted_id} for user: {username}")
        
        return {
            "success": True,
            "conversation_id": str(result.inserted_id),
            "title": conversation_title,
            "created_at": now_utc.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error creating conversation for {current_user.get('username')}: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi tạo cuộc trò chuyện: {str(e)}")


@app.post("/conversations/deactivate_all", response_model=Dict[str, Any])
async def deactivate_all_conversations(current_user: dict = Depends(get_current_user)):
    """Deactivate tất cả conversations của user - dùng khi click New Chat"""
    try:
        username = current_user.get("username")
        collection = get_mongo_connection()
        db = collection.database
        conversations_collection = db["conversations"]
        
        # Deactivate all active conversations for this user
        result = conversations_collection.update_many(
            {"username": username, "is_active": True},
            {"$set": {"is_active": False}}
        )
        
        logger.info(f"Deactivated {result.modified_count} conversations for user: {username}")
        
        return {
            "success": True,
            "deactivated_count": result.modified_count
        }
        
    except Exception as e:
        logger.error(f"Error deactivating conversations for {current_user.get('username')}: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi deactivate conversations: {str(e)}")



@app.get("/conversations/{conversation_id}", response_model=Dict[str, Any])
async def get_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Lấy chi tiết một conversation"""
    try:
        from bson import ObjectId
        
        collection = get_mongo_connection()
        db = collection.database
        conversations_collection = db["conversations"]
        
        # Find conversation
        conversation = conversations_collection.find_one({"_id": ObjectId(conversation_id)})
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Cuộc trò chuyện không tồn tại")
        
        # Check ownership
        if conversation["username"] != current_user.get("username"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Không được phép xem cuộc trò chuyện của người dùng khác"
            )
        
        # Convert ObjectId to string
        conversation["_id"] = str(conversation["_id"])
        
        return conversation
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting conversation {conversation_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi lấy cuộc trò chuyện: {str(e)}")


@app.post("/conversations/{conversation_id}/archive", response_model=Dict[str, Any])
async def archive_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Lưu trữ một conversation"""
    try:
        from bson import ObjectId
        
        collection = get_mongo_connection()
        db = collection.database
        conversations_collection = db["conversations"]
        
        # Find and verify ownership
        conversation = conversations_collection.find_one({"_id": ObjectId(conversation_id)})
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Cuộc trò chuyện không tồn tại")
        
        if conversation["username"] != current_user.get("username"):
            raise HTTPException(status_code=403, detail="Không được phép chỉnh sửa cuộc trò chuyện của người dùng khác")
        
        # Archive
        result = conversations_collection.update_one(
            {"_id": ObjectId(conversation_id)},
            {
                "$set": {
                    "is_archived": True,
                    "is_active": False,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return {"success": result.modified_count > 0, "message": "Lưu trữ thành công"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error archiving conversation {conversation_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu trữ cuộc trò chuyện: {str(e)}")


@app.delete("/conversations/{conversation_id}", response_model=Dict[str, Any])
async def delete_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Xóa một conversation"""
    try:
        from bson import ObjectId
        
        collection = get_mongo_connection()
        db = collection.database
        conversations_collection = db["conversations"]
        
        # Find and verify ownership
        conversation = conversations_collection.find_one({"_id": ObjectId(conversation_id)})
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Cuộc trò chuyện không tồn tại")
        
        if conversation["username"] != current_user.get("username"):
            raise HTTPException(status_code=403, detail="Không được phép xóa cuộc trò chuyện của người dùng khác")
        
        # Delete
        result = conversations_collection.delete_one({"_id": ObjectId(conversation_id)})
        
        return {"success": result.deleted_count > 0, "message": "Xóa thành công"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting conversation {conversation_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa cuộc trò chuyện: {str(e)}")


# --- Chat History Endpoint (UPDATED to use conversations collection) ---

@app.get("/chat_history/{username}", response_model=Dict[str, Any])
async def get_user_chat_history(
    username: str, 
    current_user: dict = Depends(get_current_user), 
    limit: int = 50
):
    """Lấy lịch sử trò chuyện của người dùng từ conversations collection (limit: 50 conversations gần nhất)"""
    try:
        # Kiểm tra quyền truy cập
        if current_user.get("username") != username and not current_user.get("is_admin", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Không được phép xem lịch sử trò chuyện của người dùng khác"
            )

        collection = get_mongo_connection()
        
        # Check if user exists
        user_exists = collection.count_documents({"_id": username}) > 0
        if not user_exists:
            raise HTTPException(status_code=404, detail="Người dùng không tồn tại")

        # Get conversations
        db = collection.database
        conversations_collection = db["conversations"]
        
        conversations = list(
            conversations_collection.find({"username": username})
            .sort("updated_at", -1)
            .limit(limit)
        )
        
        # Convert ObjectId to string for JSON serialization
        for conv in conversations:
            conv["_id"] = str(conv["_id"])
            # Also convert ObjectIds in messages
            if "messages" in conv and conv["messages"]:
                for msg in conv["messages"]:
                    if "_id" in msg:
                        msg["_id"] = str(msg["_id"])
        
        # Get total messages
        user_data = collection.find_one(
            {"_id": username},
            {"total_messages": 1}
        )
        total_messages = user_data.get("total_messages", 0) if user_data else 0
        
        return {
            "username": username,
            "conversations": conversations,
            "total_conversations": len(conversations),
            "total_messages": total_messages
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat history for {username}: {e}")
        raise HTTPException(status_code=500, detail="Lỗi máy chủ khi lấy lịch sử trò chuyện")
