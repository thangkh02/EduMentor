import aiohttp
import logging
from typing import List, Dict, Any
from .base_tool import BaseTool
from config.settings import TAVILY_API_KEY

logger = logging.getLogger(__name__)

class WebSearchTool(BaseTool):
    @property
    def name(self) -> str:
        return "Web_Search"
    
    @property
    def description(self) -> str:
        return "Tìm kiếm thông tin trên internet."
    
    async def execute(self, assistant, **kwargs) -> str:
        """Thực hiện tìm kiếm web bất đồng bộ"""
        query = kwargs.get("question", "")
        num_results = kwargs.get("num_results", 5)
        
        if not query.strip():
            logger.warning("WebSearchTool: Từ khóa tìm kiếm không được cung cấp.")
            return "Vui lòng cung cấp từ khóa tìm kiếm."
        
        try:
            logger.info(f"WebSearchTool: Tìm kiếm '{query}' với {num_results} kết quả.")
            results = await self.search(query, num_results)
            if not results:
                logger.info(f"WebSearchTool: Không tìm thấy kết quả cho '{query}'.")
                return f"Không tìm thấy kết quả cho '{query}'."
            
            formatted_results = []
            for i, result in enumerate(results, 1):
                formatted_results.append(f"{i}. {result['title']}\n   Link: {result['link']}\n   {result['snippet']}\n")
            
            return "Kết quả tìm kiếm:\n\n" + "\n".join(formatted_results)
        except Exception as e:
            logger.error(f"WebSearchTool: Lỗi khi tìm kiếm '{query}': {str(e)}")
            return f"Lỗi khi tìm kiếm '{query}': {str(e)}"
    
    async def search(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """Thực hiện tìm kiếm qua Tavily API bất đồng bộ"""
        if not TAVILY_API_KEY:
            raise ValueError("TAVILY_API_KEY không được cấu hình")
        
        # Sử dụng Tavily API
        url = "https://api.tavily.com/search"
        headers = {"Authorization": f"Bearer {TAVILY_API_KEY}"}
        payload = {
            "query": query,
            "max_results": num_results,
            "search_depth": "basic"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as response:
                response.raise_for_status()
                search_results = await response.json()
        
        results = []
        if "results" in search_results:
            for result in search_results["results"]:
                results.append({
                    "title": result.get("title", ""),
                    "link": result.get("url", ""),
                    "snippet": result.get("content", "")
                })
        return results