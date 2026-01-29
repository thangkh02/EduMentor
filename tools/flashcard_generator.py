from datetime import datetime, timezone
import json
import re  # Thêm import re cho regular expressions
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from .base_tool import BaseTool

# MongoDB Configuration (Consistent with other tools)
MONGO_HOST = "localhost"
MONGO_PORT = 27017
MONGO_DB_NAME = "edumentor"
MONGO_COLLECTION_NAME = "edumentor"  # User requested collection name

class FlashcardGeneratorTool(BaseTool):
    def __init__(self):
        super().__init__()
        self.mongo_client = None
        self.db = None
        self.collection = None
        self._connect_mongo()

    def _connect_mongo(self):
        """Establishes connection to MongoDB."""
        if not self.mongo_client:
            try:
                self.mongo_client = MongoClient(MONGO_HOST, MONGO_PORT, serverSelectionTimeoutMS=5000)
                self.mongo_client.admin.command('ismaster') 
                self.db = self.mongo_client[MONGO_DB_NAME]
                self.collection = self.db[MONGO_COLLECTION_NAME]
                print(f"FlashcardGeneratorTool: Successfully connected to MongoDB.")
            except ConnectionFailure:
                print(f"FlashcardGeneratorTool: Failed to connect to MongoDB. Stats feature will be unavailable.")
                self.mongo_client = None
            except Exception as e:
                print(f"FlashcardGeneratorTool: An unexpected error occurred during MongoDB connection: {e}")
                self.mongo_client = None
    
    @property
    def name(self) -> str:
        return "Flashcard_Generator"
    
    @property
    def description(self) -> str:
        return "Tạo flashcards cho một chủ đề."
    
    async def execute(self, assistant, **kwargs):
        topic = kwargs.get("question", "")
        options = kwargs.get("options", {})
        username = options.get("username", "").strip()
        
        if not topic.strip():
            return "Vui lòng cung cấp chủ đề để tạo flashcard."
        
        try:
            context = await assistant.retriever.search(topic)
            if not context:
                return f"Không tìm thấy thông tin về '{topic}' để tạo flashcard."
            
            context_text = "\n\n".join([f"Slide {doc.get('slide_number', 'N/A')}: {doc['text']}" for doc in context])
            prompt = f"""Dựa trên thông tin sau, tạo bộ flashcard học tập cho chủ đề "{topic}".
            Thông tin: {context_text}
            
            Tạo 10 flashcard, mỗi flashcard có định dạng:
            FLASHCARD #[số]:
            Mặt trước: [Câu hỏi hoặc thuật ngữ]
            Mặt sau: [Câu trả lời hoặc định nghĩa, kèm số slide nếu có]

            Yêu cầu:
            - Trả về kết quả dưới dạng một đối tượng JSON duy nhất.
            - Đối tượng JSON phải có một key là "deck_id" với giá trị là một chuỗi ID duy nhất (ví dụ: flashcard_{topic}_timestamp).
            - Đối tượng JSON phải có một key là "topic" chứa tên chủ đề đã cho.
            - Đối tượng JSON phải có một key là "cards" chứa một danh sách (list) các đối tượng flashcard.
            - Mỗi đối tượng flashcard trong danh sách "cards" phải có các key:
                - "id": một số nguyên duy nhất cho thẻ trong bộ này (bắt đầu từ 1).
                - "front": chuỗi chứa nội dung mặt trước (câu hỏi/thuật ngữ).
                - "back": chuỗi chứa nội dung mặt sau (câu trả lời/định nghĩa).
                - "source_slide": (Tùy chọn) số slide nguồn nếu có thể xác định.
            - Đảm bảo JSON hợp lệ và chỉ trả về đối tượng JSON, không có văn bản giải thích nào khác xung quanh nó.

            Ví dụ cấu trúc JSON mong muốn:
            {{
              "deck_id": "flashcard_bayesnet_1700000000",
              "topic": "Bayesian Networks",
              "cards": [
                {{
                  "id": 1,
                  "front": "What is a Bayesian Network?",
                  "back": "A probabilistic graphical model representing variables and their conditional dependencies via a directed acyclic graph.",
                  "source_slide": 2
                }},
                {{
                  "id": 2,
                  "front": "What are the two main components?",
                  "back": "1. A Directed Acyclic Graph (DAG). 2. A set of Conditional Probability Tables (CPTs).",
                   "source_slide": 3
                }}
                // ... thêm các thẻ khác ...
              ]
            }}
            """

            # Use asynchronous invoke for LLM
            response_content = await assistant.llm.ainvoke(prompt)
            # Clean potential markdown code fences ```json ... ```
            cleaned_response = re.sub(r'^```json\s*|\s*```$', '', response_content, flags=re.MULTILINE).strip()

            # Parse the JSON response
            try:
                flashcard_data = json.loads(cleaned_response)
                 # Basic validation
                if not isinstance(flashcard_data, dict) or "cards" not in flashcard_data or not isinstance(flashcard_data["cards"], list):
                     raise ValueError("Invalid JSON format for flashcards.")
                if "deck_id" not in flashcard_data:
                    flashcard_data["deck_id"] = f"flashcard_{topic.replace(' ','_')}_{int(datetime.now().timestamp())}"
                if "topic" not in flashcard_data:
                    flashcard_data["topic"] = topic

            except json.JSONDecodeError as e:
                 print(f"Error parsing flashcard JSON: {e}\nResponse: {cleaned_response}")
                 return {"error": f"Lỗi khi xử lý phản hồi JSON từ AI: {e}"} # Return error dict

            # Lưu flashcards (dưới dạng dict) vào MongoDB nếu có username
            if username:
                 try:
                     # Pass the parsed dictionary directly
                     self._save_flashcards_to_mongodb(username, topic, flashcard_data)
                 except Exception as e:
                     print(f"Error saving flashcards to MongoDB: {str(e)}")
                     # Add warning to the dict to be returned
                     flashcard_data["warning"] = "Không thể lưu flashcards vào hồ sơ người dùng."
            # else: # No local history saving for now if not logged in
            #     pass

            return flashcard_data # Return the parsed dictionary
        except Exception as e:
            print(f"Error generating flashcards for '{topic}': {str(e)}")
            return {"error": f"Lỗi khi tạo flashcard cho '{topic}': {str(e)}"} # Return error dict

    # Modify save function to accept the dictionary
    def _save_flashcards_to_mongodb(self, username: str, topic: str, flashcard_data: dict):
        """Lưu flashcards (dưới dạng dict) vào MongoDB"""
        if not self.collection:
            print("MongoDB connection not available. Flashcards not saved to database.")
            return # Corrected indentation

        try:
             now_utc = datetime.now(timezone.utc)
             # Store the entire flashcard_data object under the topic key
             update_result = self.collection.update_one(
                 {"_id": username},
                 {
                     "$set": {
                         f"flashcards.{topic}": flashcard_data, # Store the whole dict
                         f"flashcards.{topic}.saved_at": now_utc, # Add a saved timestamp
                     },
                     "$setOnInsert": {
                         "_id": username,
                         "username": username
                     }
                 },
                 upsert=True
             )

             if update_result.upserted_id or update_result.modified_count > 0:
                 print(f"Successfully saved flashcards object for user '{username}', topic '{topic}'.")
             else:
                 print(f"Flashcards object for user '{username}', topic '{topic}' might not have been saved correctly.")

        except Exception as e:
             print(f"Error saving flashcards object to MongoDB: {str(e)}")
             raise # Re-raise the exception

    # Remove local history saving for now
    # def _save_flashcards_history(self, topic: str, content: str): ...

    def __del__(self):
        """Ensure MongoDB client is closed when the object is destroyed."""
        if self.mongo_client:
            self.mongo_client.close()
            print("MongoDB client closed for FlashcardGeneratorTool.")
