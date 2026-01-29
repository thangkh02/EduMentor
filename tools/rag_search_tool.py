from .base_tool import BaseTool

class RAGSearchTool(BaseTool):
    @property
    def name(self) -> str:
        return "RAG_Search"
    
    @property
    def description(self) -> str:
        return "Tìm kiếm thông tin trong tài liệu nội bộ."
    
    async def execute(self, assistant, **kwargs):
        """Hàm tìm kiếm RAG nội bộ"""
        question = kwargs.get("question", "")
        context = kwargs.get("context", "")
        
        # Nếu đã có context, sử dụng nó
        if context:
            return context
        
        # Nếu không, thực hiện tìm kiếm
        results = await assistant.retriever.search(question)
        return "\n\n".join([doc["text"] for doc in results])