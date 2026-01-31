
import os
import sys
from pymongo import MongoClient
import logging

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add parent directory to path to import config
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from config.settings import MONGODB_HOST, MONGODB_PORT, MONGODB_DB_NAME, MONGODB_COLLECTION, MONGODB_URI
except ImportError:
    # Fallback if config import fails (e.g. running from wrong dir)
    MONGODB_URI = "mongodb://localhost:27017" # Default fallback
    MONGODB_DB_NAME = "edumentor_db" 
    print("Could not import settings, using defaults")

def check_db():
    try:
        if MONGODB_URI:
            client = MongoClient(MONGODB_URI)
        else:
            client = MongoClient(MONGODB_HOST, MONGODB_PORT)
        
        db = client[MONGODB_DB_NAME]
        
        print(f"Connected to DB: {MONGODB_DB_NAME}")
        print("Collections:", db.list_collection_names())
        
        if "user_files" in db.list_collection_names():
            files_coll = db["user_files"]
            count = files_coll.count_documents({})
            print(f"Total documents in 'user_files': {count}")
            
            print("\n--- Recent Files ---")
            for doc in files_coll.find().limit(5):
                print(doc)
        else:
            print("'user_files' collection does not exist!")

        if "users" in db.list_collection_names():
             users_coll = db["users"]
             print(f"\nTotal users: {users_coll.count_documents({})}")
             for user in users_coll.find().limit(3):
                 print(f"User: {user.get('_id')} - {user.get('username')}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
