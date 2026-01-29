# tools/concept_explainer.py
from .base_tool import BaseTool
from typing import TYPE_CHECKING, Any
import logging

if TYPE_CHECKING:
    from core.learning_assistant_v2 import LearningAssistant # Sửa đường dẫn nếu cần

logger = logging.getLogger(__name__)

class ConceptExplainerTool(BaseTool):
    @property
    def name(self) -> str: return "Concept_Explainer"
    @property
    def description(self) -> str: return "Giải thích một khái niệm cụ thể dựa trên tài liệu."
    # needs_context mặc định là True

    async def execute(self, assistant: 'LearningAssistant', **kwargs) -> Any: # Chuyển thành async
        concept = kwargs.get("question", "") # Giả sử question chứa concept
        context_str = kwargs.get("context", "") # Lấy context từ graph nếu có

        if not concept.strip():
            return "Vui lòng cung cấp khái niệm cần giải thích."

        # Ưu tiên context từ graph
        if not context_str and self.needs_context:
            logger.info(f"Concept Explainer: Context not provided, retrieving for '{concept}'...")
            try:
                # Gọi retriever async
                context_docs = await assistant.retriever.search(concept)
                if not context_docs:
                    logger.warning(f"Concept Explainer: No documents found for '{concept}'.")
                    return f"Không tìm thấy thông tin về khái niệm '{concept}' trong tài liệu."
                context_str = "\n\n".join([doc.get('text', '') for doc in context_docs])
                logger.info(f"Concept Explainer: Retrieved {len(context_docs)} chunks.")
            except Exception as e:
                logger.exception(f"Concept Explainer: Error retrieving context for '{concept}': {e}")
                return f"Lỗi khi tìm thông tin cho khái niệm '{concept}': {str(e)}"
        elif not context_str:
             logger.warning(f"Concept Explainer: Context needed but still missing after retrieval attempt for '{concept}'.")
             # Có thể trả lỗi hoặc thử trả lời không cần context nếu muốn
             return f"Lỗi: Không thể lấy ngữ cảnh cần thiết để giải thích '{concept}'."


        prompt = f"""Dựa trên thông tin ngữ cảnh sau đây, hãy giải thích khái niệm "{concept}" một cách rõ ràng, chi tiết và dễ hiểu cho người học.

        Ngữ cảnh:
        {context_str}

        Yêu cầu giải thích:
        1.  **Định nghĩa cốt lõi:** Nêu định nghĩa chính xác và súc tích.
        2.  **Giải thích chi tiết:** Phân tích sâu hơn, làm rõ các khía cạnh quan trọng. Sử dụng cách diễn đạt đơn giản.
        3.  **Ví dụ minh họa:** Cung cấp ít nhất một ví dụ cụ thể, dễ hình dung để làm rõ khái niệm.
        4.  **Liên hệ (nếu có):** Chỉ ra mối liên hệ với các khái niệm khác đã biết hoặc trong cùng chủ đề (dựa vào ngữ cảnh).
        5.  **Điểm cần lưu ý (nếu có):** Nhấn mạnh những điểm dễ nhầm lẫn hoặc cần chú ý đặc biệt.

        Hãy trình bày câu trả lời một cách có cấu trúc, sử dụng định dạng markdown nếu cần (ví dụ: bullet points, in đậm)."""

        try:
            logger.info(f"Concept Explainer: Calling LLM for '{concept}'...")
            # Gọi LLM async
            response = await assistant.llm.ainvoke(prompt)
            content = response # Hoặc response.content tùy LLM wrapper
            logger.info(f"Concept Explainer: LLM explanation generated for '{concept}'.")
            return content
        except Exception as e:
            logger.exception(f"Concept Explainer: Error calling LLM for '{concept}': {e}")
            return f"Xin lỗi, đã xảy ra lỗi khi giải thích khái niệm '{concept}': {str(e)}"