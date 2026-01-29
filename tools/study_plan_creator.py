import logging
from datetime import datetime, timezone # Import timezone
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from .base_tool import BaseTool
from typing import TYPE_CHECKING, Any, Dict # Import Dict
from utils.user_data_manager import UserDataManager  # Import UserDataManager

if TYPE_CHECKING:
    from core.learning_assistant_v2 import LearningAssistant

logger = logging.getLogger(__name__)

# MongoDB Configuration (Consider moving to config/settings.py later)
MONGO_HOST = "localhost"
MONGO_PORT = 27017
MONGO_DB_NAME = "edumentor"
MONGO_COLLECTION_NAME = "stats" # Thống nhất sử dụng collection stats

class StudyPlanCreatorTool(BaseTool):
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
                # The ismaster command is cheap and does not require auth.
                self.mongo_client.admin.command('ismaster') 
                self.db = self.mongo_client[MONGO_DB_NAME]
                self.collection = self.db[MONGO_COLLECTION_NAME]
                logger.info(f"Successfully connected to MongoDB: {MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}/{MONGO_COLLECTION_NAME}")
            except ConnectionFailure:
                logger.error(f"Failed to connect to MongoDB at {MONGO_HOST}:{MONGO_PORT}. Stats feature will be unavailable.")
                self.mongo_client = None # Ensure client is None if connection failed
            except Exception as e:
                 logger.error(f"An unexpected error occurred during MongoDB connection: {e}")
                 self.mongo_client = None

    @property
    def name(self) -> str:
        return "Study_Plan_Creator"

    @property
    def description(self) -> str:
        return "Tạo kế hoạch học tập cho một chủ đề và lưu vào hồ sơ người dùng (yêu cầu username)."

    @property
    def needs_context(self) -> bool:
        # Needs context about the subject to create a relevant plan
        return True

    async def execute(self, assistant: 'LearningAssistant', **kwargs) -> str:
        subject = kwargs.get("question", "").strip()
        context_str = kwargs.get("context", "") # Context from the graph
        options = kwargs.get("options", {})
        username = options.get("username", "").strip()

        if not subject:
            return "Vui lòng cung cấp chủ đề để tạo kế hoạch học tập."
            
        # Bỏ kiểm tra bắt buộc username
        # if not username:
        #     return "Vui lòng cung cấp username để lưu kế hoạch học tập."
            
        # Nếu không có username, kế hoạch vẫn được tạo nhưng không lưu vào DB
        save_to_db = bool(username)
        
        if not context_str:
             # This case should ideally be handled by the graph ensuring context is retrieved
             logger.warning(f"StudyPlanCreator: Context not provided for '{subject}'. Attempting retrieval.")
             try:
                 context_docs = await assistant.retriever.search(subject)
                 if not context_docs:
                     logger.warning(f"StudyPlanCreator: No documents found for '{subject}'. Cannot create plan without context.")
                     return f"Không tìm thấy thông tin về '{subject}' để tạo kế hoạch học tập."
                 context_str = "\n\n".join([doc.get('text', '') for doc in context_docs])
             except Exception as e:
                 logger.exception(f"StudyPlanCreator: Error retrieving context for '{subject}': {e}")
                 return f"Lỗi khi tìm thông tin cho '{subject}': {str(e)}"

        # Prompt for LLM to generate the plan
        prompt = f"""Dựa trên thông tin ngữ cảnh sau đây về chủ đề "{subject}", hãy tạo một kế hoạch học tập chi tiết.

        Ngữ cảnh:
        {context_str}

        Yêu cầu kế hoạch học tập:
        - **Mục tiêu:** Nêu rõ mục tiêu cần đạt được sau khi hoàn thành kế hoạch.
        - **Chủ đề con:** Chia nhỏ chủ đề chính thành các phần nhỏ hơn, dễ quản lý.
        - **Thời gian dự kiến:** Ước lượng thời gian cho mỗi chủ đề con (ví dụ: 2 giờ, 1 ngày).
        - **Tài nguyên đề xuất:** Gợi ý các tài liệu, video, bài viết liên quan (nếu có trong ngữ cảnh).
        - **Hoạt động/Bài tập:** Đề xuất các hoạt động thực hành hoặc bài tập để củng cố kiến thức.
        - **Đánh giá:** Gợi ý cách tự đánh giá tiến độ (ví dụ: làm quiz, hoàn thành bài tập).

        Trình bày kế hoạch một cách rõ ràng, có cấu trúc, sử dụng markdown (bullet points, bold)."""

        try:
            logger.info(f"StudyPlanCreator: Generating plan for '{subject}'...")
            # Use ainvoke for async call
            response = await assistant.llm.ainvoke(prompt)
            plan_content = response # Adjust if response structure is different (e.g., response.content)
            logger.info(f"StudyPlanCreator: Plan generated for '{subject}'.")

            # Save the plan to MongoDB only if username is provided
            if save_to_db:
                # Sử dụng UserDataManager để lưu kế hoạch học tập
                success = self.user_data_manager.update_study_plan(username, subject, plan_content)
                
                if not success:
                    logger.warning(f"StudyPlanCreator: Không thể lưu kế hoạch học tập cho '{username}', môn '{subject}'.")
                    plan_content += "\n\n(Cảnh báo: Không thể lưu kế hoạch vào hồ sơ do lỗi cơ sở dữ liệu.)"
                else:
                    logger.info(f"StudyPlanCreator: Đã lưu kế hoạch học tập cho '{username}', môn '{subject}'.")
            elif not save_to_db:
                logger.info("StudyPlanCreator: Username không được cung cấp, kế hoạch học tập đã được tạo nhưng không lưu vào database.")
            
            return plan_content

        except Exception as e:
            logger.exception(f"StudyPlanCreator: Error during execution for '{subject}': {e}")
            return f"Lỗi khi tạo kế hoạch học tập cho '{subject}': {str(e)}"

    def __del__(self):
        """Ensure MongoDB client is closed when the object is destroyed."""
        if self.mongo_client:
            self.mongo_client.close()
            logger.info("MongoDB client closed for StudyPlanCreatorTool.")
