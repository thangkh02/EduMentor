import logging
import hashlib
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timezone
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure

logger = logging.getLogger(__name__)

# MongoDB Configuration
MONGO_HOST = "localhost"
MONGO_PORT = 27017
MONGO_DB_NAME = "edumentor"
MONGO_COLLECTION_NAME = "stats"
DEFAULT_USER_ID = "anonymous_user"

class UserDataManager:
    """
    Lớp trung tâm để quản lý dữ liệu người dùng từ tất cả các công cụ.
    Lớp này đảm bảo tất cả các cập nhật dữ liệu đồng bộ với nhau và endpoint stats
    có thể truy xuất thông tin đầy đủ.
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(UserDataManager, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        """Khởi tạo kết nối MongoDB và các thuộc tính cần thiết."""
        self.mongo_client = None
        self.db = None
        self.collection = None
        self._connect_mongo()
    
    def _connect_mongo(self):
        """Thiết lập kết nối đến MongoDB."""
        if not self.mongo_client:
            try:
                self.mongo_client = MongoClient(MONGO_HOST, MONGO_PORT, serverSelectionTimeoutMS=5000)
                self.mongo_client.admin.command('ismaster')
                self.db = self.mongo_client[MONGO_DB_NAME]
                self.collection = self.db[MONGO_COLLECTION_NAME]
                logger.info(f"UserDataManager: Kết nối MongoDB thành công.")
            except ConnectionFailure:
                logger.error(f"UserDataManager: Không thể kết nối đến MongoDB. Tính năng thống kê sẽ không hoạt động.")
                self.mongo_client = None
            except Exception as e:
                logger.error(f"UserDataManager: Đã xảy ra lỗi không mong muốn khi kết nối MongoDB: {e}")
                self.mongo_client = None
    
    def is_connected(self) -> bool:
        """Kiểm tra trạng thái kết nối MongoDB."""
        return self.collection is not None
    
    def get_user_data(self, username: str) -> Dict:
        """
        Truy xuất toàn bộ dữ liệu người dùng theo username.
        
        Args:
            username: Tên người dùng
            
        Returns:
            Dict: Dữ liệu người dùng hoặc dict rỗng nếu không tìm thấy
        """
        if not self.is_connected():
            logger.warning("UserDataManager: Không thể truy xuất dữ liệu người dùng, MongoDB không kết nối.")
            return {}
            
        try:
            user_data = self.collection.find_one({"_id": username})
            return user_data or {}
        except Exception as e:
            logger.exception(f"UserDataManager: Lỗi khi truy xuất dữ liệu người dùng '{username}': {e}")
            return {}
    
    def get_user_stats(self, username: str, subject: Optional[str] = None) -> Dict:
        """
        Truy xuất thống kê học tập của người dùng, có thể theo môn học cụ thể.
        
        Args:
            username: Tên người dùng
            subject: Tên môn học (tùy chọn, nếu None thì trả về tất cả)
            
        Returns:
            Dict: Dữ liệu thống kê học tập
        """
        user_data = self.get_user_data(username)
        stats = user_data.get("stats", {})
        
        if subject:
            return {subject: stats.get(subject, {})}
        return stats
    
    def update_progress(self, username: str, subject: str, progress: int) -> bool:
        """
        Cập nhật tiến độ học tập cho một môn học.
        
        Args:
            username: Tên người dùng
            subject: Tên môn học
            progress: Tiến độ (0-100)
            
        Returns:
            bool: True nếu cập nhật thành công, False nếu thất bại
        """
        if not self.is_connected():
            logger.warning(f"UserDataManager: Không thể cập nhật tiến độ, MongoDB không kết nối.")
            return False
            
        try:
            now_utc = datetime.now(timezone.utc)
            update_result = self.collection.update_one(
                {"_id": username},
                {
                    "$set": {
                        f"stats.{subject}.progress": progress,
                        f"stats.{subject}.progress_updated_at": now_utc,
                        "last_login": now_utc
                    },
                    "$push": {
                        "recent_activities": {
                            "action": "update_progress",
                            "subject": subject,
                            "timestamp": now_utc,
                            "progress": progress
                        }
                    },
                    "$setOnInsert": {
                        "_id": username,
                        "username": username,
                        "created_at": now_utc
                    }
                },
                upsert=True
            )
            
            # Đảm bảo subject tồn tại với các trường cần thiết
            self.collection.update_one(
                {"_id": username, f"stats.{subject}.documents": {"$exists": False}},
                {"$set": {f"stats.{subject}.documents": []}}
            )
            
            success = update_result.upserted_id is not None or update_result.modified_count > 0
            
            if success:
                logger.info(f"UserDataManager: Đã cập nhật tiến độ cho '{username}', môn '{subject}'.")
            else:
                logger.warning(f"UserDataManager: Có thể không cập nhật được tiến độ cho '{username}', môn '{subject}'.")
                
            return success
        except Exception as e:
            logger.exception(f"UserDataManager: Lỗi khi cập nhật tiến độ cho '{username}', môn '{subject}': {e}")
            return False
    
    def add_document(self, username: str, subject: str, filename: str, 
                    page_count: Optional[int] = None, size_bytes: Optional[int] = None,
                    document_path: Optional[str] = None) -> Optional[str]:
        """
        Thêm tài liệu mới vào hồ sơ người dùng.
        
        Args:
            username: Tên người dùng
            subject: Môn học liên quan
            filename: Tên file
            page_count: Số trang (tùy chọn)
            size_bytes: Kích thước file (tùy chọn)
            document_path: Đường dẫn file (tùy chọn)
            
        Returns:
            Optional[str]: ID của tài liệu nếu thành công, None nếu thất bại
        """
        if not self.is_connected():
            logger.warning(f"UserDataManager: Không thể thêm tài liệu, MongoDB không kết nối.")
            return None
            
        try:
            # Tạo document_id duy nhất
            document_id = hashlib.md5(f"{filename}_{datetime.now().isoformat()}".encode()).hexdigest()
            
            # Đường dẫn mặc định nếu không được cung cấp
            path = document_path or f"uploads/{filename}"
            
            # Thời gian hiện tại
            now_utc = datetime.now(timezone.utc)
            
            # Tạo dữ liệu tài liệu
            doc_data = {
                "document_id": document_id,
                "filename": filename,
                "upload_date": now_utc,
                "path": path,
                "last_accessed": now_utc
            }
            
            # Thêm thông tin tùy chọn
            if page_count is not None:
                doc_data["page_count"] = page_count
            if size_bytes is not None:
                doc_data["size_bytes"] = size_bytes
            
            # Cập nhật vào database
            update_result = self.collection.update_one(
                {"_id": username},
                {
                    "$push": {
                        f"stats.{subject}.documents": doc_data,
                        "recent_activities": {
                            "action": "upload",
                            "document": filename,
                            "timestamp": now_utc,
                            "subject": subject
                        }
                    },
                    "$setOnInsert": {
                        "_id": username,
                        "username": username,
                        "created_at": now_utc
                    },
                    "$set": {
                        "last_login": now_utc
                    }
                },
                upsert=True
            )
            
            # Đảm bảo subject tồn tại
            self.collection.update_one(
                {"_id": username, f"stats.{subject}": {"$exists": False}},
                {"$set": {f"stats.{subject}": {"documents": []}}}
            )
            
            if update_result.upserted_id or update_result.modified_count > 0:
                logger.info(f"UserDataManager: Đã thêm tài liệu '{filename}' cho '{username}', môn '{subject}'.")
                return document_id
            else:
                logger.warning(f"UserDataManager: Có thể không thêm được tài liệu '{filename}' cho '{username}', môn '{subject}'.")
                return None
                
        except Exception as e:
            logger.exception(f"UserDataManager: Lỗi khi thêm tài liệu '{filename}' cho '{username}', môn '{subject}': {e}")
            return None
    
    def update_study_plan(self, username: str, subject: str, plan_content: str) -> bool:
        """
        Cập nhật kế hoạch học tập cho một môn học.
        
        Args:
            username: Tên người dùng
            subject: Môn học
            plan_content: Nội dung kế hoạch học tập
            
        Returns:
            bool: True nếu thành công, False nếu thất bại
        """
        if not self.is_connected():
            logger.warning(f"UserDataManager: Không thể cập nhật kế hoạch học tập, MongoDB không kết nối.")
            return False
            
        try:
            now_utc = datetime.now(timezone.utc)
            update_result = self.collection.update_one(
                {"_id": username},
                {
                    "$set": {
                        f"stats.{subject}.plan": plan_content,
                        f"stats.{subject}.plan_created_at": now_utc,
                        "last_login": now_utc
                    },
                    "$push": {
                        "recent_activities": {
                            "action": "create_plan",
                            "subject": subject,
                            "timestamp": now_utc
                        }
                    },
                    "$setOnInsert": {
                        "_id": username,
                        "username": username,
                        "created_at": now_utc,
                        f"stats.{subject}.progress": 0  # Khởi tạo tiến độ nếu chưa có
                    }
                },
                upsert=True
            )
            
            success = update_result.upserted_id is not None or update_result.modified_count > 0
            
            if success:
                logger.info(f"UserDataManager: Đã cập nhật kế hoạch học tập cho '{username}', môn '{subject}'.")
            else:
                logger.warning(f"UserDataManager: Có thể không cập nhật được kế hoạch học tập cho '{username}', môn '{subject}'.")
                
            return success
        except Exception as e:
            logger.exception(f"UserDataManager: Lỗi khi cập nhật kế hoạch học tập cho '{username}', môn '{subject}': {e}")
            return False
    
    def record_learning_activity(self, username: str, subject: str, document_id: Optional[str] = None,
                              duration_minutes: int = 0, topics: List[str] = None) -> bool:
        """
        Ghi lại hoạt động học tập của người dùng.
        
        Args:
            username: Tên người dùng
            subject: Môn học
            document_id: ID của tài liệu (tùy chọn)
            duration_minutes: Thời gian học (phút)
            topics: Danh sách chủ đề đã học
            
        Returns:
            bool: True nếu thành công, False nếu thất bại
        """
        if not self.is_connected():
            logger.error("UserDataManager: Không thể ghi lại hoạt động học tập, MongoDB không kết nối.")
            return False
            
        try:
            now_utc = datetime.now(timezone.utc)
            topics = topics or []
            
            # Tìm thông tin document nếu có document_id
            document_name = None
            if document_id:
                user_data = self.collection.find_one({"_id": username})
                if user_data and "stats" in user_data:
                    for subject_data in user_data["stats"].values():
                        for doc in subject_data.get("documents", []):
                            if doc.get("document_id") == document_id:
                                document_name = doc.get("filename")
                                # Cập nhật last_accessed
                                self.collection.update_one(
                                    {"_id": username, "stats.*.documents.document_id": document_id},
                                    {"$set": {"stats.$.documents.$.last_accessed": now_utc}}
                                )
                                break
            
            # Tạo activity entry
            activity = {
                "action": "learn",
                "subject": subject,
                "timestamp": now_utc,
                "duration_minutes": duration_minutes
            }
            
            if document_name:
                activity["document"] = document_name
                
            # Cập nhật learning history
            learning_entry = {
                "date": now_utc,
                "duration_minutes": duration_minutes,
                "topics": topics
            }
            
            if document_id:
                learning_entry["document_id"] = document_id
                
            # Cập nhật vào database
            result = self.collection.update_one(
                {"_id": username},
                {
                    "$push": {
                        f"stats.{subject}.learning_history": learning_entry,
                        "recent_activities": activity
                    },
                    "$set": {"last_login": now_utc},
                    "$setOnInsert": {
                        "_id": username,
                        "username": username,
                        "created_at": now_utc
                    }
                },
                upsert=True
            )
            
            return result.modified_count > 0 or result.upserted_id is not None
            
        except Exception as e:
            logger.exception(f"UserDataManager: Lỗi khi ghi lại hoạt động học tập cho '{username}': {e}")
            return False
    
    def get_documents(self, username: str, subject: Optional[str] = None) -> List[Dict]:
        """
        Lấy danh sách tài liệu của người dùng.
        
        Args:
            username: Tên người dùng
            subject: Môn học cụ thể (tùy chọn, nếu None thì lấy tất cả)
            
        Returns:
            List[Dict]: Danh sách các tài liệu
        """
        user_data = self.get_user_data(username)
        stats = user_data.get("stats", {})
        documents = []
        
        if subject:
            # Lấy tài liệu của một môn học cụ thể
            subject_data = stats.get(subject, {})
            return subject_data.get("documents", [])
        else:
            # Lấy tất cả tài liệu từ tất cả các môn học
            for subject_name, subject_data in stats.items():
                subject_docs = subject_data.get("documents", [])
                for doc in subject_docs:
                    doc_with_subject = doc.copy()
                    doc_with_subject["subject"] = subject_name
                    documents.append(doc_with_subject)
                    
            return documents
    
    def get_recent_activities(self, username: str, limit: int = 10) -> List[Dict]:
        """
        Lấy danh sách hoạt động gần đây của người dùng.
        
        Args:
            username: Tên người dùng
            limit: Số lượng hoạt động tối đa muốn lấy
            
        Returns:
            List[Dict]: Danh sách hoạt động gần đây
        """
        user_data = self.get_user_data(username)
        activities = user_data.get("recent_activities", [])
        
        # Lấy {limit} hoạt động gần nhất
        return activities[-limit:] if activities else []
    
    def __del__(self):
        """Đảm bảo đóng kết nối MongoDB khi đối tượng bị hủy."""
        if hasattr(self, 'mongo_client') and self.mongo_client:
            self.mongo_client.close()
            logger.info("UserDataManager: Đã đóng kết nối MongoDB.")