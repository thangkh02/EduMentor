from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
import sys

def test_mongo_connection():
    """Kiểm tra kết nối MongoDB"""
    try:
        # Kết nối đến MongoDB
        client = MongoClient("localhost", 27017, serverSelectionTimeoutMS=5000)
        
        # Kiểm tra kết nối
        client.admin.command('ismaster')
        
        # Kiểm tra database và collection
        db = client['edumentor']
        collection = db['edumentor']
        
        # Đếm số lượng documents trong collection
        count = collection.count_documents({})
        
        print(f"Kết nối MongoDB thành công!")
        print(f"Database: edumentor")
        print(f"Collection: edumentor")
        print(f"Số lượng documents: {count}")
        
        return True
    except ConnectionFailure:
        print("Không thể kết nối đến MongoDB!")
        print("Vui lòng kiểm tra MongoDB đang chạy tại localhost:27017")
        return False
    except Exception as e:
        print(f"Lỗi: {e}")
        return False

if __name__ == "__main__":
    if test_mongo_connection():
        sys.exit(0)  # Kết nối thành công
    else:
        sys.exit(1)  # Kết nối thất bại