# --- START OF FILE tools/quiz_generator.py ---

import asyncio
import json # Import json module
import logging
from .base_tool import BaseTool
from typing import TYPE_CHECKING, Any, Dict, List # Thêm Dict, List
import re
import datetime
# --- Khối TYPE_CHECKING duy nhất và đúng ---
if TYPE_CHECKING:
    from core.learning_assistant_v2 import LearningAssistant
# --- Kết thúc khối TYPE_CHECKING ---

# Logger setup (assuming global config is sufficient)
logger = logging.getLogger(__name__)

class QuizGenerator(BaseTool):
    @property
    def name(self) -> str:
        return "Quiz_Generator"

    @property
    def description(self) -> str:
        return "Tạo câu hỏi trắc nghiệm (quiz) về một chủ đề cụ thể dưới dạng JSON."

    # needs_context defaults to True in BaseTool

    async def execute(self, assistant: 'LearningAssistant', **kwargs) -> Dict[str, Any]: # Return Dict (JSON)
        """
        Generates quiz questions in JSON format based on the provided topic and context.
        """
        topic = kwargs.get("question", "").strip()
        context_str = kwargs.get("context", "")
        options = kwargs.get("options", {})
        num_questions_str = options.get("num_questions", "5") # Get num_questions from options

        try:
            num_questions = int(num_questions_str)
        except (ValueError, TypeError):
            logger.warning(f"QuizGenerator: Invalid num_questions value '{num_questions_str}', defaulting to 5.")
            num_questions = 5
        num_questions = max(1, min(num_questions, 20)) # Limit between 1 and 20

        if not topic:
            logger.warning("QuizGenerator: Topic not provided.")
            # Return an error structure consistent with JSON output expectation
            return {"error": "Vui lòng cung cấp chủ đề cho bài kiểm tra."}

        # Retrieve context if needed and not provided
        if not context_str and self.needs_context:
            logger.warning(f"QuizGenerator: Context not provided for '{topic}', retrieving...")
            try:
                retrieved_docs = await assistant.retriever.search(topic)
                if not retrieved_docs:
                    logger.warning(f"QuizGenerator: No documents found for '{topic}'.")
                    return {"error": f"Không tìm thấy thông tin về '{topic}' để tạo bài kiểm tra."}
                context_str = "\n\n".join([doc.get('text', '') for doc in retrieved_docs])
            except Exception as e:
                logger.error(f"QuizGenerator: Error retrieving context: {e}")
                return {"error": f"Lỗi khi truy xuất thông tin cho '{topic}': {e}"}
        elif not context_str:
             logger.error(f"QuizGenerator: Context is required but missing for '{topic}'.")
             return {"error": f"Lỗi: Thiếu ngữ cảnh cần thiết để tạo quiz cho '{topic}'."}

        # Updated prompt requesting JSON output
        prompt_template = f"""Dựa trên thông tin ngữ cảnh sau đây về chủ đề "{topic}", hãy tạo một bài kiểm tra trắc nghiệm gồm {num_questions} câu hỏi.

        Ngữ cảnh:
        {context_str}

        Yêu cầu:
        - Trả về kết quả dưới dạng một đối tượng JSON duy nhất.
        - Đối tượng JSON phải có một key là "quiz_id" với giá trị là một chuỗi ID duy nhất (ví dụ: sử dụng timestamp hoặc UUID).
        - Đối tượng JSON phải có một key là "questions" chứa một danh sách (list) các đối tượng câu hỏi.
        - Mỗi đối tượng câu hỏi trong danh sách phải có các key sau:
            - "id": một số nguyên duy nhất cho câu hỏi trong quiz này (bắt đầu từ 1).
            - "question_text": chuỗi chứa nội dung câu hỏi.
            - "options": một danh sách (list) gồm 4 chuỗi, đại diện cho các lựa chọn (A, B, C, D).
            - "correct_answer_index": một số nguyên (0, 1, 2, hoặc 3) chỉ định chỉ số của đáp án đúng trong danh sách "options".
        - Câu hỏi nên bao quát các khía cạnh quan trọng của chủ đề trong ngữ cảnh.
        - Đảm bảo JSON hợp lệ và chỉ trả về đối tượng JSON, không có văn bản giải thích nào khác xung quanh nó.

        Ví dụ cấu trúc JSON mong muốn:
        {{
          "quiz_id": "quiz_1700000000",
          "questions": [
            {{
              "id": 1,
              "question_text": "Câu hỏi ví dụ 1 là gì?",
              "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
              "correct_answer_index": 0
            }},
            {{
              "id": 2,
              "question_text": "Câu hỏi ví dụ 2 liên quan đến gì?",
              "options": ["Đáp án 1", "Đáp án 2", "Đáp án 3", "Đáp án 4"],
              "correct_answer_index": 2
            }}
            // ... thêm các câu hỏi khác ...
          ]
        }}
        """

        try:
            logger.info(f"QuizGenerator: Calling LLM to generate JSON quiz for '{topic}'...")
            response_content = await assistant.llm.ainvoke(prompt_template)
            
            # Clean potential markdown code fences ```json ... ```
            cleaned_response = re.sub(r'^```json\s*|\s*```$', '', response_content, flags=re.MULTILINE).strip()

            logger.debug(f"QuizGenerator: Raw LLM response:\n{response_content}")
            logger.debug(f"QuizGenerator: Cleaned LLM response:\n{cleaned_response}")

            # Parse the JSON response
            quiz_data = json.loads(cleaned_response)
            
            # Basic validation (can be expanded)
            if not isinstance(quiz_data, dict) or "questions" not in quiz_data or not isinstance(quiz_data["questions"], list):
                 raise ValueError("Định dạng JSON trả về không hợp lệ.")
            if "quiz_id" not in quiz_data:
                 # Generate a simple ID if missing
                 quiz_data["quiz_id"] = f"quiz_{int(datetime.now().timestamp())}"
                 logger.warning("QuizGenerator: quiz_id missing from LLM response, generated one.")


            logger.info(f"QuizGenerator: Successfully generated and parsed JSON quiz for '{topic}'.")
            return quiz_data # Return the parsed dictionary

        except json.JSONDecodeError as e:
            logger.error(f"QuizGenerator: Failed to parse JSON response from LLM: {e}\nResponse: {cleaned_response}")
            return {"error": f"Lỗi khi xử lý phản hồi từ AI để tạo quiz: {e}"}
        except Exception as e:
            logger.exception(f"QuizGenerator: Error during LLM call or processing for '{topic}': {e}")
            return {"error": f"Đã xảy ra lỗi khi tạo bài kiểm tra cho '{topic}': {str(e)}"}

# --- END OF FILE tools/quiz_generator.py ---
