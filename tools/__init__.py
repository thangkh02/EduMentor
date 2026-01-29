# tools/__init__.py

# Đảm bảo import ToolRegistry và BaseTool trước
from .tool_registry import ToolRegistry
from .base_tool import BaseTool

# Import tất cả các lớp Tool cụ thể
from .rag_search_tool import RAGSearchTool
from .web_search_tool import WebSearchTool
from .quiz_generator import QuizGenerator
from .study_plan_creator import StudyPlanCreatorTool
from .flashcard_generator import FlashcardGeneratorTool
from .concept_explainer import ConceptExplainerTool
from .progress_tracker import ProgressTrackerTool
from .summary_generator import SummaryGeneratorTool
from .mind_map_creator import MindMapCreatorTool
# Thêm các tool khác nếu có

def register_all_tools(registry: ToolRegistry):
    """Đăng ký tất cả các công cụ có sẵn vào registry."""
    if not isinstance(registry, ToolRegistry):
        raise TypeError("registry must be an instance of ToolRegistry")

    # Khởi tạo và đăng ký từng tool
    # Đảm bảo không có lỗi cú pháp ở đây
    registry.register_tool(RAGSearchTool())
    registry.register_tool(WebSearchTool()) # Đảm bảo TAVILY_API_KEY được cấu hình
    registry.register_tool(QuizGenerator())
    registry.register_tool(StudyPlanCreatorTool())
    registry.register_tool(FlashcardGeneratorTool())
    registry.register_tool(ConceptExplainerTool())
    registry.register_tool(ProgressTrackerTool())
    registry.register_tool(SummaryGeneratorTool())
    registry.register_tool(MindMapCreatorTool())
    # Thêm các lệnh register_tool cho các tool khác

    print(f"Registered tools: {', '.join(registry.get_tool_names())}")