import logging
from datetime import datetime, timezone
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from .base_tool import BaseTool
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Union
import json
import os
import hashlib
from utils.user_data_manager import UserDataManager

if TYPE_CHECKING:
    from core.learning_assistant_v2 import LearningAssistant

logger = logging.getLogger(__name__)

# MongoDB Configuration
MONGO_HOST = "localhost"
MONGO_PORT = 27017
MONGO_DB_NAME = "edumentor"
MONGO_COLLECTION_NAME = "stats"
DEFAULT_USER_ID = "anonymous_user"

class ProgressTrackerTool(BaseTool):
    def __init__(self):
        super().__init__()
        self.mongo_client = None
        self.db = None
        self.collection = None
        self._connect_mongo()
        # Khởi tạo UserDataManager
        self.user_data_manager = UserDataManager()

    def _connect_mongo(self):
        """Establishes connection to MongoDB."""
        if not self.mongo_client:
            try:
                self.mongo_client = MongoClient(MONGO_HOST, MONGO_PORT, serverSelectionTimeoutMS=5000)
                self.mongo_client.admin.command('ismaster') 
                self.db = self.mongo_client[MONGO_DB_NAME]
                self.collection = self.db[MONGO_COLLECTION_NAME]
                logger.info(f"ProgressTrackerTool: Successfully connected to MongoDB.")
            except ConnectionFailure:
                logger.error(f"ProgressTrackerTool: Failed to connect to MongoDB. Stats feature will be unavailable.")
                self.mongo_client = None
            except Exception as e:
                 logger.error(f"ProgressTrackerTool: An unexpected error occurred during MongoDB connection: {e}")
                 self.mongo_client = None

    @property
    def name(self) -> str:
        return "Progress_Tracker"

    @property
    def description(self) -> str:
        return "Theo dõi hoặc cập nhật tiến độ học tập và tài liệu của người dùng."

    @property
    def needs_context(self) -> bool:
        """Progress tracker doesn't need document context."""
        return False

    async def execute(self, assistant: 'LearningAssistant', **kwargs) -> Dict:
        """
        Xử lý yêu cầu và trả về kết quả dưới dạng từ điển (không phải JSON string)
        """
        input_str = kwargs.get("question", "").strip()
        options = kwargs.get("options", {})
        
        # Lấy username từ options 
        username = options.get("username", "").strip()
        
        # Log để debug thông tin người dùng
        if username:
            logger.info(f"ProgressTrackerTool: Executing with authenticated user: {username}")
        else:
            logger.warning(f"ProgressTrackerTool: No username provided in options, using default: {DEFAULT_USER_ID}")
            username = DEFAULT_USER_ID
        
        # Kiểm tra xem có thể lưu dữ liệu
        save_to_db = self.user_data_manager.is_connected()
        
        if not save_to_db:
            # Thêm cảnh báo nếu không thể kết nối CSDL
            logger.warning("Database not available, operation will not persist data")
            return {"error": "Lỗi: Không thể kết nối đến cơ sở dữ liệu."}
            
        # Kiểm tra các command đặc biệt
        try:
            if input_str.startswith("upload:"):
                # Xử lý thông tin tài liệu upload
                _, params = input_str.split(":", 1)
                result = self._process_document_upload(username, params.strip())
                return {"message": result}
                
            elif input_str.startswith("documents:"):
                # Liệt kê tài liệu của một môn học hoặc tất cả các môn
                _, subject = input_str.split(":", 1)
                result = self._list_documents_dict(username, subject.strip())
                return result  # Already a dictionary
                
            elif ":" in input_str and not any(input_str.startswith(cmd) for cmd in ["upload:", "documents:"]):
                # Cập nhật tiến độ
                subject, progress_str = input_str.split(":", 1)
                subject = subject.strip()
                progress_str = progress_str.strip()
                
                if not subject:
                    return {"error": "Lỗi: Tên môn học không được để trống khi cập nhật tiến độ."}
                
                # Validate progress value
                try:
                    progress_value = int(progress_str)
                    if not (0 <= progress_value <= 100):
                        return {"error": "Lỗi: Tiến độ phải là một số từ 0 đến 100."}
                except ValueError:
                    return {"error": "Lỗi: Tiến độ cung cấp không phải là một số hợp lệ."}
                    
                # Update progress in MongoDB using UserDataManager
                success = self.user_data_manager.update_progress(username, subject, progress_value)
                if success:
                    return {
                        "success": True,
                        "message": f"Đã cập nhật tiến độ cho '{subject}' thành {progress_value}%."
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Không thể cập nhật tiến độ cho '{subject}'."
                    }
            else:
                # Retrieve progress from MongoDB
                subject_to_get = input_str  # If empty, gets all; otherwise, gets specific subject
                result = self._get_progress_from_db(username, subject_to_get)
                # Result is dictionary
                return result
                
        except Exception as e:
            logger.exception(f"ProgressTrackerTool execution error: {e}")
            return {"error": f"Lỗi khi xử lý yêu cầu: {str(e)}"}

    def _process_document_upload(self, username: str, params: str) -> str:
        """
        Xử lý thông tin tài liệu đã upload và cập nhật vào cơ sở dữ liệu
        
        Format: upload:filename.pdf|subject|page_count|size_bytes
        Ví dụ: upload:dai_so.pdf|Toán học|45|1024000
        """
        try:
            parts = params.split('|')
            if len(parts) < 2:
                return "Lỗi: Thiếu thông tin. Định dạng: upload:filename.pdf|môn học|số trang|kích thước"
            
            filename = parts[0].strip()
            subject = parts[1].strip()
            
            # Thông tin tùy chọn
            page_count = int(parts[2]) if len(parts) > 2 and parts[2].strip() else None
            size_bytes = int(parts[3]) if len(parts) > 3 and parts[3].strip() else None
            
            # Sử dụng UserDataManager để thêm tài liệu
            document_id = self.user_data_manager.add_document(
                username, subject, filename, page_count, size_bytes
            )
            
            if document_id:
                return f"Đã thêm tài liệu '{filename}' vào môn học '{subject}' thành công."
            else:
                return f"Không thể thêm tài liệu '{filename}' (có thể đã tồn tại hoặc có lỗi xảy ra)."
                
        except Exception as e:
            logger.exception(f"Error processing document upload: {e}")
            return f"Lỗi xử lý thông tin tài liệu: {str(e)}"

    def _list_documents(self, username: str, subject: str = "") -> str:
        """Liệt kê các tài liệu đã upload của người dùng dưới dạng text."""
        try:
            # Sử dụng UserDataManager để lấy danh sách tài liệu
            if subject:
                # Liệt kê tài liệu của một môn học cụ thể
                documents = self.user_data_manager.get_documents(username, subject)
                
                if not documents:
                    return f"Không có tài liệu nào trong môn học '{subject}'."
                    
                result_lines = [f"Tài liệu môn {subject}:"]
                for i, doc in enumerate(documents, 1):
                    filename = doc.get("filename", "Không có tên")
                    upload_date = doc.get("upload_date")
                    upload_date_str = upload_date.strftime("%Y-%m-%d") if upload_date else "N/A"
                    page_count = doc.get("page_count", "N/A")
                    
                    result_lines.append(f"{i}. {filename} - Ngày upload: {upload_date_str} - Số trang: {page_count}")
                
                return "\n".join(result_lines)
            else:
                # Liệt kê tài liệu của tất cả các môn học
                documents = self.user_data_manager.get_documents(username)
                
                if not documents:
                    return "Không có tài liệu nào được upload."
                    
                # Nhóm tài liệu theo môn học
                docs_by_subject = {}
                for doc in documents:
                    subject_name = doc.get("subject", "Không rõ môn học")
                    if subject_name not in docs_by_subject:
                        docs_by_subject[subject_name] = []
                    docs_by_subject[subject_name].append(doc)
                
                result_lines = ["Danh sách tất cả tài liệu:"]
                for subject_name, subject_docs in sorted(docs_by_subject.items()):
                    result_lines.append(f"\nMôn {subject_name}:")
                    for i, doc in enumerate(subject_docs, 1):
                        filename = doc.get("filename", "Không có tên")
                        upload_date = doc.get("upload_date")
                        upload_date_str = upload_date.strftime("%Y-%m-%d") if upload_date else "N/A"
                        
                        result_lines.append(f"{i}. {filename} - Ngày upload: {upload_date_str}")
                
                return "\n".join(result_lines)
                
        except Exception as e:
            logger.exception(f"Error listing documents: {e}")
            return f"Lỗi khi liệt kê tài liệu: {str(e)}"
            
    def _list_documents_dict(self, username: str, subject: str = "") -> Dict:
        """Liệt kê các tài liệu đã upload của người dùng dưới dạng từ điển."""
        try:
            # Khởi tạo structure
            result = {
                "subjects": [],
                "documents": [],
                "message": "",
                "error": None
            }
            
            # Sử dụng UserDataManager để lấy danh sách tài liệu
            if subject:
                # Liệt kê tài liệu của một môn học cụ thể
                documents = self.user_data_manager.get_documents(username, subject)
                
                if not documents:
                    result["message"] = f"Không có tài liệu nào trong môn học '{subject}'."
                    return result
                
                # Thêm tên môn học
                result["subjects"].append({"name": subject})
                
                # Thêm tài liệu
                for doc in documents:
                    upload_date = doc.get("upload_date")
                    
                    result["documents"].append({
                        "id": doc.get("document_id", ""),
                        "filename": doc.get("filename", "Không có tên"),
                        "subject": subject,
                        "upload_date": upload_date.isoformat() if upload_date else None,
                        "page_count": doc.get("page_count", 0),
                        "size_bytes": doc.get("size_bytes", 0)
                    })
            else:
                # Liệt kê tài liệu của tất cả các môn học
                documents = self.user_data_manager.get_documents(username)
                
                if not documents:
                    result["message"] = "Không có tài liệu nào được upload."
                    return result
                
                # Nhóm tài liệu theo môn học và thêm danh sách môn học
                subjects = set()
                for doc in documents:
                    subject_name = doc.get("subject", "Không rõ môn học")
                    subjects.add(subject_name)
                    
                    upload_date = doc.get("upload_date")
                    
                    result["documents"].append({
                        "id": doc.get("document_id", ""),
                        "filename": doc.get("filename", "Không có tên"),
                        "subject": subject_name,
                        "upload_date": upload_date.isoformat() if upload_date else None,
                        "page_count": doc.get("page_count", 0),
                        "size_bytes": doc.get("size_bytes", 0)
                    })
                
                # Thêm danh sách môn học
                for subject_name in sorted(subjects):
                    result["subjects"].append({"name": subject_name})
            
            return result
                
        except Exception as e:
            logger.exception(f"Error listing documents as JSON: {e}")
            return {"error": f"Lỗi khi liệt kê tài liệu: {str(e)}"}

    def _get_progress_from_db(self, username: str, subject: str = "") -> Dict:
        """
        Truy xuất tiến độ từ cơ sở dữ liệu và trả về dưới dạng từ điển.
        Lấy tất cả các môn học nếu subject rỗng.
        """
        # Initialize output_data structure
        output_data = {
            "subjects": [],
            "activities": [],
            "message": "",
            "error": None
        }
        
        try:
            if subject:
                # Lấy thông tin về một môn học cụ thể
                stats = self.user_data_manager.get_user_stats(username, subject)
                if not stats or subject not in stats or not stats[subject]:
                    output_data["message"] = f"Không tìm thấy dữ liệu tiến độ cho môn học '{subject}'."
                    return output_data

                subject_data = stats[subject]
                progress = subject_data.get("progress", 0)
                updated_at_utc = subject_data.get("progress_updated_at")
                plan_created_at_utc = subject_data.get("plan_created_at")
                documents = subject_data.get("documents", [])
                doc_count = len(documents)

                output_data["subjects"].append({
                    "name": subject,
                    "progress": progress,
                    "updated_at": updated_at_utc.isoformat() if updated_at_utc else None,
                    "plan_created_at": plan_created_at_utc.isoformat() if plan_created_at_utc else None,
                    "doc_count": doc_count
                })
            else:
                # Lấy thông tin về tất cả các môn học
                stats = self.user_data_manager.get_user_stats(username)
                if not stats:
                    output_data["message"] = f"Chưa có dữ liệu tiến độ nào được ghi nhận cho người dùng '{username}'."
                    return output_data

                for subj, data in sorted(stats.items()):
                    prog = data.get("progress", 0)
                    updated_at_utc = data.get("progress_updated_at")
                    plan_created_at_utc = data.get("plan_created_at")
                    doc_count = len(data.get("documents", []))

                    output_data["subjects"].append({
                        "name": subj,
                        "progress": prog,
                        "updated_at": updated_at_utc.isoformat() if updated_at_utc else None,
                        "plan_created_at": plan_created_at_utc.isoformat() if plan_created_at_utc else None,
                        "doc_count": doc_count
                    })

                # Thêm thông tin hoạt động gần đây
                recent_activities = self.user_data_manager.get_recent_activities(username, limit=5)
                for activity in recent_activities:
                    # Format activity for frontend
                    action = activity.get("action", "")
                    timestamp = activity.get("timestamp")
                    timestamp_str = timestamp.isoformat() if timestamp else None
                    subject_act = activity.get("subject", "")
                    document_act = activity.get("document", "")
                    progress_act = activity.get("progress", "")
                    duration_act = activity.get("duration_minutes", "")

                    activity_text = f"Hoạt động: {action}"  # Default
                    if action == "upload":
                        activity_text = f"Upload tài liệu '{document_act}' vào môn {subject_act}"
                    elif action == "update_progress":
                        activity_text = f"Cập nhật tiến độ môn {subject_act}: {progress_act}%"
                    elif action == "learn":
                        activity_text = f"Học môn {subject_act} ({duration_act} phút)"
                    elif action == "create_plan":
                        activity_text = f"Tạo kế hoạch học tập cho môn {subject_act}"

                    output_data["activities"].append({
                        "timestamp": timestamp_str,
                        "description": activity_text
                    })

            return output_data

        except Exception as e:
            logger.exception(f"Error getting progress from database: {e}")
            output_data["error"] = f"Lỗi khi truy xuất tiến độ: {str(e)}"
            return output_data

    def record_learning_activity(self, username: str, subject: str, document_id: Optional[str] = None,
                               duration_minutes: int = 0, topics: List[str] = None) -> bool:
        """
        Ghi lại hoạt động học tập của người dùng
        
        Args:
            username: Tên người dùng
            subject: Môn học
            document_id: ID của tài liệu học (tùy chọn)
            duration_minutes: Thời gian học (phút)
            topics: Danh sách các chủ đề đã học
            
        Returns:
            bool: True nếu thành công, False nếu thất bại
        """
        if not self.collection:
            logger.error("Cannot record learning activity: No database connection")
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
                    "$set": {"last_login": now_utc}
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.exception(f"Error recording learning activity: {e}")
            return False

    def __del__(self):
        """Ensure MongoDB client is closed when the object is destroyed."""
        if self.mongo_client:
            self.mongo_client.close()
            logger.info("MongoDB client closed for ProgressTrackerTool.")
