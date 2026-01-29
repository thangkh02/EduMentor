import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from config.settings import MONGODB_HOST, MONGODB_PORT, MONGODB_DB_NAME, MONGODB_COLLECTION
from config.settings import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_ACCESS_TOKEN_EXPIRE_MINUTES
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.security.utils import get_authorization_scheme_param

# Cấu hình mã hóa và JWT
SECRET_KEY = JWT_SECRET_KEY
ALGORITHM = JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = JWT_ACCESS_TOKEN_EXPIRE_MINUTES

# Password context cho việc hash và verify
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Client MongoDB toàn cục
mongo_client = None
db = None
users_collection = None

# OAuth2 scheme cho xác thực
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

def get_mongo_connection():
    """Tạo và trả về kết nối MongoDB"""
    global mongo_client, db, users_collection
    
    if not mongo_client:
        try:
            mongo_client = MongoClient(MONGODB_HOST, MONGODB_PORT, serverSelectionTimeoutMS=5000)
            mongo_client.admin.command('ismaster') 
            db = mongo_client[MONGODB_DB_NAME]
            users_collection = db[MONGODB_COLLECTION]
            print("Authentication module: Successfully connected to MongoDB")
        except ConnectionFailure:
            print("Authentication module: Failed to connect to MongoDB")
            raise
        except Exception as e:
            print(f"Authentication module: An unexpected error occurred during MongoDB connection: {e}")
            raise
    
    return users_collection

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Kiểm tra mật khẩu người dùng nhập vào với mật khẩu đã hash trong DB"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Tạo hash cho mật khẩu mới"""
    return pwd_context.hash(password)

def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Xác thực người dùng bằng username và password"""
    try:
        collection = get_mongo_connection()
        user = collection.find_one({"_id": username})
        
        if not user:
            return None
        if not verify_password(password, user.get("hashed_password", "")):
            return None
        
        # Loại bỏ hashed_password từ thông tin trả về
        if "hashed_password" in user:
            user_dict = dict(user)
            user_dict.pop("hashed_password")
            return user_dict
        
        return dict(user)
    except Exception as e:
        print(f"Error authenticating user: {e}")
        return None

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Tạo JWT token cho user đã xác thực"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt

async def get_current_user_optional(token: Optional[str] = Depends(oauth2_scheme)):
    """
    Xác thực người dùng hiện tại từ token, nhưng không yêu cầu bắt buộc có token.
    Trả về thông tin người dùng nếu token hợp lệ, ngược lại trả về None.
    """
    if not token:
        return None
        
    # Xác thực token
    token_data = verify_token(token)
    if token_data is None:
        return None
    
    # Lấy thông tin người dùng từ database
    try:
        collection = get_mongo_connection()
        username = token_data.get("username")
        
        # Kiểm tra username có giá trị không
        if not username:
            return None
            
        user = collection.find_one({"_id": username})
        
        if not user:
            return None
            
        # Loại bỏ hashed_password từ thông tin trả về
        if "hashed_password" in user:
            user_dict = dict(user)
            user_dict.pop("hashed_password")
            return user_dict
            
        return dict(user)
    except Exception as e:
        print(f"Error in get_current_user_optional: {e}")
        return None

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Xác thực và giải mã JWT token"""
    try:
        # Kiểm tra token có giá trị không
        if not token or not isinstance(token, str) or not token.strip():
            print("Token is empty or invalid format")
            return None
            
        # Thử giải mã token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        
        if username is None:
            print("Token verification failed: 'sub' claim is missing")
            return None
            
        # Trả về thông tin cơ bản từ token
        token_data = {
            "username": username,
            "exp": payload.get("exp")
        }
        
        # Thêm các trường khác từ payload nếu có
        for key, value in payload.items():
            if key not in ["sub", "exp"]:
                token_data[key] = value
                
        return token_data
    except JWTError as e:
        print(f"JWT Error during token verification: {e}")
        # Ghi log chi tiết hơn để dễ dàng debug
        if "expired" in str(e).lower():
            print("Token has expired - please login again")
        elif "signature" in str(e).lower():
            print("Invalid token signature - token may have been tampered with")
        elif "invalid" in str(e).lower():
            print("Invalid token format - token structure is incorrect")
        else:
            print(f"Other JWT error: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error in verify_token: {e}")
        return None

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Xác thực người dùng hiện tại từ token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Xác thực token
    token_data = verify_token(token)
    if token_data is None:
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
        
        # Kiểm tra username có giá trị không
        if not username:
            raise credentials_exception
            
        user = collection.find_one({"_id": username})
        
        if not user:
            raise credentials_exception
            
        # Loại bỏ hashed_password từ thông tin trả về
        if "hashed_password" in user:
            user_dict = dict(user)
            user_dict.pop("hashed_password")
            return user_dict
            
        return dict(user)
    except Exception as e:
        raise credentials_exception

def update_user_stats(username: str, stats_data: dict) -> bool:
    """
    Cập nhật thông tin thống kê học tập của người dùng
    
    Args:
        username: Tên người dùng
        stats_data: Dict chứa dữ liệu thống kê cần cập nhật
            - subject: Tên môn học (nếu có)
            - progress: Tiến độ học tập (0-100) (nếu có)
            - action: Loại hoạt động (ví dụ: 'quiz', 'chat', 'mindmap')
            - action_data: Dữ liệu chi tiết về hoạt động
            
    Returns:
        bool: True nếu cập nhật thành công, False nếu có lỗi
    """
    try:
        collection = get_mongo_connection()
        now_utc = datetime.now(timezone.utc)
        update_data = {"last_activity": now_utc}
        
        subject = stats_data.get("subject")
        progress = stats_data.get("progress")
        action = stats_data.get("action")
        action_data = stats_data.get("action_data", {})
        
        # Cập nhật tiến độ môn học
        if subject and progress is not None:
            if not (0 <= progress <= 100):
                return False
                
            update_data[f"stats.{subject}.progress"] = progress
            update_data[f"stats.{subject}.updated_at"] = now_utc
            
        # Cập nhật hoạt động
        if action:
            if action == "chat":
                # Lưu tin nhắn với timestamp
                if not isinstance(action_data, dict):
                    action_data = {"message": str(action_data)}
                    
                action_data["timestamp"] = now_utc
                
                collection.update_one(
                    {"_id": username},
                    {
                        "$push": {"chat_history": action_data},
                        "$set": {"last_activity": now_utc}
                    },
                    upsert=True
                )
                
            elif action == "quiz_complete":
                # Lưu kết quả bài kiểm tra
                if action_data:
                    action_data["completed_at"] = now_utc
                    
                    collection.update_one(
                        {"_id": username},
                        {
                            "$push": {"completed_quizzes": action_data},
                            "$set": {"last_activity": now_utc}
                        },
                        upsert=True
                    )
                    
            elif action == "mindmap_created":
                # Lưu thông tin mind map mới
                if action_data and "topic" in action_data and "filename" in action_data:
                    topic = action_data["topic"]
                    filename = action_data["filename"]
                    
                    collection.update_one(
                        {"_id": username},
                        {
                            "$set": {
                                f"mindmaps.{topic}": {
                                    "filename": filename,
                                    "created_at": now_utc
                                },
                                "last_activity": now_utc
                            }
                        },
                        upsert=True
                    )
                    
            elif action == "flashcard_created":
                # Lưu thông tin flashcard mới
                if action_data and "deck_name" in action_data and "cards" in action_data:
                    deck_name = action_data["deck_name"]
                    cards = action_data["cards"]
                    
                    collection.update_one(
                        {"_id": username},
                        {
                            "$set": {
                                f"flashcards.{deck_name}": {
                                    "cards": cards,
                                    "created_at": now_utc,
                                    "last_reviewed": now_utc,
                                    "review_count": 0
                                },
                                "last_activity": now_utc
                            }
                        },
                        upsert=True
                    )
            else:
                # Các hoạt động khác
                collection.update_one(
                    {"_id": username},
                    {
                        "$set": {
                            f"activities.{action}": action_data or {"count": 1, "last_time": now_utc},
                            "last_activity": now_utc
                        }
                    },
                    upsert=True
                )
                
        # Nếu chỉ cập nhật tiến độ
        if subject and progress is not None and not action:
            collection.update_one(
                {"_id": username},
                {"$set": update_data},
                upsert=True
            )
            
        return True
    except Exception as e:
        print(f"Error updating user stats: {e}")
        return False

def get_learning_recommendations(username: str) -> list:
    """
    Tạo danh sách gợi ý học tập dựa trên dữ liệu người dùng
    
    Args:
        username: Tên người dùng
        
    Returns:
        list: Danh sách các gợi ý học tập
    """
    try:
        collection = get_mongo_connection()
        user_data = collection.find_one({"_id": username})
        
        if not user_data:
            return []
            
        recommendations = []
        
        # Gợi ý dựa trên các môn học có tiến độ thấp
        subjects = user_data.get("stats", {})
        low_progress_subjects = [
            subject for subject, data in subjects.items() 
            if data.get("progress", 0) < 50
        ]
        
        if low_progress_subjects:
            recommendations.append(
                f"Tập trung vào các chủ đề có tiến độ thấp: {', '.join(low_progress_subjects)}"
            )
            
        # Gợi ý ôn tập các môn học đã hoàn thành
        completed_subjects = [
            subject for subject, data in subjects.items() 
            if data.get("progress", 0) >= 100
        ]
        
        if completed_subjects:
            recommendations.append(
                f"Ôn tập lại các chủ đề đã hoàn thành: {', '.join(completed_subjects)}"
            )
            
        # Gợi ý dựa trên hoạt động gần đây
        chat_history = user_data.get("chat_history", [])
        if chat_history:
            # Phân tích các cuộc trò chuyện gần đây để tạo gợi ý
            recent_chats = chat_history[-5:]  # 5 cuộc trò chuyện gần nhất
            chat_topics = set()
            
            for chat in recent_chats:
                if chat.get("topic"):
                    chat_topics.add(chat.get("topic"))
                    
            if chat_topics:
                recommendations.append(
                    f"Tiếp tục tìm hiểu về: {', '.join(chat_topics)}"
                )
        
        # Tăng tần suất ôn tập flashcards 
        flashcards = user_data.get("flashcards", {})
        review_needed = []
        
        now = datetime.now(timezone.utc)
        for deck_name, deck_data in flashcards.items():
            last_review = deck_data.get("last_reviewed")
            
            if last_review:
                last_review = last_review if isinstance(last_review, datetime) else datetime.fromisoformat(last_review)
                days_since_review = (now - last_review).days
                
                if days_since_review > 2:  # Nếu đã hơn 2 ngày chưa ôn tập
                    review_needed.append(deck_name)
        
        if review_needed:
            recommendations.append(
                f"Ôn tập các bộ thẻ flashcard: {', '.join(review_needed)}"
            )
            
        return recommendations
    except Exception as e:
        print(f"Error generating learning recommendations: {e}")
        return []