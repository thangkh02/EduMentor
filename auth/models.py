from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    full_name: Optional[str] = None

class TokenData(BaseModel):
    username: Optional[str] = None

class DocumentInfo(BaseModel):
    filename: str
    upload_date: datetime
    file_type: str
    is_indexed: bool = True
    size_bytes: Optional[int] = None

class SubjectProgress(BaseModel):
    progress: int = Field(0, description="Tiến độ học tập (phần trăm, 0-100)")
    progress_updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    description: Optional[str] = Field(None)

class StatsResponse(BaseModel):
    username: str
    subjects: Dict[str, SubjectProgress] = {}
    documents: List[DocumentInfo] = []
    flashcards: Dict[str, Any] = {}
    chat_history_count: int = 0
    completed_quizzes: int = 0
    last_activity: Optional[datetime] = None
    recommendations: List[str] = []

class StatsUpdate(BaseModel):
    username: str
    subject: str
    progress: Optional[int] = None
    description: Optional[str] = None
    action: Optional[str] = None
    action_data: Optional[Dict[str, Any]] = None
    completed_quiz: Optional[Dict[str, Any]] = None
    flashcards: Optional[Dict[str, Dict[str, Any]]] = None

class ApiResponse(BaseModel):
    response: Dict[str, Any]