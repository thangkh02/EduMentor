
import os
import sys
from config import settings
import chromadb
from chromadb.config import Settings

def check_chroma():
    print(f"Checking ChromaDB at: {settings.CHROMA_DB_PATH}")
    print(f"Collection Name: {settings.CHROMA_COLLECTION}")
    
    try:
        client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
        print("Successfully connected to ChromaDB client.")
        
        collections = client.list_collections()
        print(f"Collections found: {[c.name for c in collections]}")
        
        try:
            collection = client.get_collection(name=settings.CHROMA_COLLECTION)
            count = collection.count()
            print(f"Collection '{settings.CHROMA_COLLECTION}' exists.")
            print(f"Document count: {count}")
            
            if count > 0:
                print("Attempting a sample query...")
                results = collection.query(
                    query_texts=["test query"],
                    n_results=1
                )
                print("Query successful.")
                print(f"Sample result ID: {results['ids']}")
            else:
                print("Collection is empty.")
                
        except Exception as e:
            print(f"Error accessing collection '{settings.CHROMA_COLLECTION}': {e}")
            
    except Exception as e:
        print(f"Error connecting to ChromaDB: {e}")

if __name__ == "__main__":
    check_chroma()
