from datetime import datetime
import re  # Thêm import re để sử dụng regular expressions
import logging  # Thêm logging để dễ debug
from .base_tool import BaseTool

# Tạo logger
logger = logging.getLogger(__name__)

class MindMapCreatorTool(BaseTool):
    @property
    def name(self) -> str:
        return "Mind_Map_Creator"
    
    @property
    def description(self) -> str:
        return "Tạo sơ đồ tư duy cho một chủ đề."
    
    async def execute(self, assistant, **kwargs):
        topic = kwargs.get("question", "")
        if not topic.strip():
            return "Vui lòng cung cấp chủ đề để tạo sơ đồ tư duy."
        
        try:
            logger.info(f"Mind Map Creator: Retrieving context for '{topic}'...")
            context = await assistant.retriever.search(topic)
            if not context:
                logger.warning(f"Mind Map Creator: No documents found for '{topic}'.")
                return f"Không tìm thấy thông tin về '{topic}' để tạo sơ đồ tư duy."
            
            # Thêm thông tin slide vào context nếu có
            context_text = "\n\n".join([f"Slide {doc.get('slide_number', 'N/A')}: {doc['text']}" for doc in context])
            logger.info(f"Mind Map Creator: Retrieved {len(context)} chunks for '{topic}'.")
            
            prompt = f"""Dựa trên thông tin sau, tạo sơ đồ tư duy trực quan và phong phú cho chủ đề "{topic}".
            Thông tin: {context_text}
            
            Sơ đồ tư duy nên có:
            1. Chủ đề chính ở trung tâm với emoji đại diện phù hợp
            2. Các nhánh chính (khái niệm chính) với icon/emoji phù hợp với mỗi nhánh
            3. Các nhánh phụ (khái niệm phụ, kèm số slide nếu có)
            4. Mối quan hệ giữa các khái niệm (thể hiện qua cấu trúc lồng nhau)
            5. Thông tin ngắn gọn, súc tích về mỗi khái niệm
            
            Yêu cầu định dạng:
            - Trả về kết quả dưới dạng một chuỗi Markdown hợp lệ cho Markmap.
            - Sử dụng dấu `#` cho chủ đề chính và PHẢI kèm emoji phù hợp.
            - Sử dụng dấu `-` hoặc `*` và thụt lề (2 dấu cách) để thể hiện các cấp độ nhánh.
            - Thêm emoji hoặc icon phù hợp trước mỗi nhánh chính để tăng tính trực quan.
            - Thêm các mô tả ngắn gọn cho mỗi nhánh để làm rõ khái niệm (nên viết sau dấu `:` hoặc trong ngoặc).
            - Thêm định dạng in đậm hoặc in nghiêng cho các khái niệm quan trọng.
            - Sử dụng liên kết Markdown (nếu có thông tin slide) cho các tham chiếu: [Tên khái niệm](Slide X).
            
            Ví dụ định dạng Markdown (PHẢI theo chính xác định dạng này, với emoji/icon cho mỗi nhánh):
            ```markdown
            # 🧠 Chủ đề chính
            - 📊 Nhánh chính 1: Khái niệm cốt lõi
              - 📌 Nhánh phụ 1.1: *Giải thích súc tích*
              - 🔍 Nhánh phụ 1.2: **Điểm quan trọng**
                - Chi tiết bổ sung (Slide 3)
            - 🛠️ Nhánh chính 2: Công cụ và ứng dụng
              - 📱 Nhánh phụ 2.1: Ứng dụng thực tiễn
                - 📘 [Tham khảo thêm](Slide 5)
            - 📝 Nhánh chính 3: Tóm tắt và kết luận
            ```
            
            Định dạng này sẽ tạo ra sơ đồ tư duy trực quan với các emoji giúp người dùng dễ dàng hiểu và nhớ các khái niệm.
            Chỉ trả về markdown thuần túy, không kèm theo text giới thiệu hay giải thích khác.
            """

            logger.info(f"Mind Map Creator: Calling LLM for '{topic}'...")
            response = await assistant.llm.ainvoke(prompt)  # Use async invoke
            markdown_content = response  # Assuming model returns content directly
            logger.info(f"Mind Map Creator: Mind map generated for '{topic}'.")
            # Basic check if it looks like markdown
            if not markdown_content.strip().startswith("#"):
                logger.warning(f"Mind Map Creator: Output for '{topic}' doesn't start with #. May not be valid Markmap Markdown.")
            
            # Clean potential markdown code fences ```markdown ... ```
            cleaned_markdown = re.sub(r'^```markdown\s*|\s*```$', '', markdown_content, flags=re.MULTILINE).strip()
            print(cleaned_markdown)
            
            # Return an object with necessary information for rendering
            return {
                "topic": topic,
                "markdown": cleaned_markdown,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.exception(f"Mind Map Creator: Error generating mind map for '{topic}': {e}")
            return f"Lỗi khi tạo sơ đồ tư duy cho '{topic}': {str(e)}"
