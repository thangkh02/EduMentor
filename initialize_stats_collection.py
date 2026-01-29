from pymongo import MongoClient
import logging
from datetime import datetime, timezone

# Cấu hình logging để xem các thông báo
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Cấu hình kết nối MongoDB
MONGO_HOST = "localhost"
MONGO_PORT = 27017
MONGO_DB_NAME = "edumentor"
MONGO_COLLECTION_NAME = "stats"  # Tên collection mới

def initialize_stats_collection():
    """Khởi tạo collection stats trong database edumentor"""
    try:
        # Kết nối đến MongoDB
        client = MongoClient(MONGO_HOST, MONGO_PORT, serverSelectionTimeoutMS=5000)
        
        # Kiểm tra kết nối
        client.admin.command('ismaster')
        logger.info("Kết nối MongoDB thành công!")
        
        # Truy cập database
        db = client[MONGO_DB_NAME]
        
        # Kiểm tra nếu collection đã tồn tại
        collection_list = db.list_collection_names()
        if MONGO_COLLECTION_NAME in collection_list:
            logger.info(f"Collection '{MONGO_COLLECTION_NAME}' đã tồn tại!")
        else:
            # Tạo collection mới
            stats_collection = db.create_collection(MONGO_COLLECTION_NAME)
            logger.info(f"Đã tạo collection '{MONGO_COLLECTION_NAME}' thành công!")
        
        # Tạo sample data để kiểm tra
        stats_collection = db[MONGO_COLLECTION_NAME]
        
        # Tạo dữ liệu mẫu với cấu trúc mở rộng để lưu thông tin tài liệu upload
        sample_data = {
            "_id": "sample_user",
            "username": "sample_user",
            "email": "sample@example.com",  # Thêm thông tin email
            "stats": {
                "Toán học": {
                    "progress": 75,
                    "progress_updated_at": datetime.now(timezone.utc),
                    "documents": [  # Danh sách tài liệu liên quan đến môn học
                        {
                            "document_id": "doc123",
                            "filename": "dai_so.pdf",
                            "upload_date": datetime.now(timezone.utc),
                            "path": "uploads/dai_so.pdf",
                            "size_bytes": 1024000,
                            "page_count": 45,
                            "last_accessed": datetime.now(timezone.utc)
                        }
                    ],
                    "learning_history": [  # Lịch sử học tập
                        {
                            "date": datetime.now(timezone.utc),
                            "duration_minutes": 60,
                            "topics": ["Phương trình bậc hai", "Hàm số"]
                        }
                    ]
                },
                "Vật lý": {
                    "progress": 60,
                    "progress_updated_at": datetime.now(timezone.utc),
                    "documents": [
                        {
                            "document_id": "doc456",
                            "filename": "co_hoc.pdf",
                            "upload_date": datetime.now(timezone.utc),
                            "path": "uploads/co_hoc.pdf",
                            "size_bytes": 2048000,
                            "page_count": 30,
                            "last_accessed": datetime.now(timezone.utc)
                        }
                    ]
                }
            },
            "recent_activities": [  # Hoạt động gần đây của người dùng
                {
                    "action": "upload",
                    "document": "dai_so.pdf",
                    "timestamp": datetime.now(timezone.utc),
                    "subject": "Toán học"
                },
                {
                    "action": "learn",
                    "document": "co_hoc.pdf",
                    "timestamp": datetime.now(timezone.utc),
                    "subject": "Vật lý",
                    "duration_minutes": 45
                }
            ],
            "created_at": datetime.now(timezone.utc),
            "last_login": datetime.now(timezone.utc)
        }
        
        # Thêm hoặc cập nhật dữ liệu mẫu
        result = stats_collection.replace_one({"_id": "sample_user"}, sample_data, upsert=True)
        
        if result.upserted_id:
            logger.info("Đã thêm dữ liệu mẫu thành công!")
        else:
            logger.info("Đã cập nhật dữ liệu mẫu thành công!")
            
        # In thông tin collection
        count = stats_collection.count_documents({})
        logger.info(f"Collection '{MONGO_COLLECTION_NAME}' có {count} documents")
        
        return True
    except Exception as e:
        logger.error(f"Lỗi: {str(e)}")
        return False
    finally:
        client.close() if 'client' in locals() else None
        logger.info("Đã đóng kết nối MongoDB")

if __name__ == "__main__":
    initialize_stats_collection()