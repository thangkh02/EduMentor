# tools/tool_registry.py
from typing import Dict, Any, Optional, Callable, Coroutine, List, Union # Thêm Union
from .base_tool import BaseTool
import inspect
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import TYPE_CHECKING
import asyncio
from config import settings as config  


# --- Logging Setup ---
logging.basicConfig(level=config.LOGGING_LEVEL, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ToolRegistry:
    """Registers and manages tools for the Learning Assistant."""

    def __init__(self, assistant: 'LearningAssistant'):
        self.assistant = assistant
        self.tools: Dict[str, BaseTool] = {}
        logger.info("ToolRegistry initialized.")

    def register_tool(self, tool: BaseTool):
        """Registers a new tool instance."""
        if not isinstance(tool, BaseTool):
            logger.error(f"Attempted to register invalid tool type: {type(tool)}. Must inherit from BaseTool.")
            return self
        if not tool.name or not isinstance(tool.name, str):
             logger.error(f"Tool {type(tool)} has invalid or missing name.")
             return self

        if tool.name in self.tools:
            logger.warning(f"Overwriting existing tool in registry: {tool.name}")
        self.tools[tool.name] = tool
        logger.info(f"Registered tool: {tool.name} - Needs Context: {tool.needs_context}") # Log thêm needs_context
        return self

    def get_tool(self, name: str) -> Optional[BaseTool]:
        """Gets a tool instance by name."""
        return self.tools.get(name)

    def has_tool(self, name: str) -> bool:
        """Checks if a tool exists."""
        return name in self.tools

    def get_tool_description(self, name: str) -> Optional[str]:
        """Gets the description of a tool."""
        tool = self.get_tool(name)
        return tool.description if tool else None

    def get_tool_names(self) -> List[str]:
         """Gets a list of names of all registered tools."""
         return list(self.tools.keys())

    def get_tool_needs_context(self, name: str) -> bool:
        """Checks if a tool requires context."""
        tool = self.get_tool(name)
        if tool:
            # Không cần hasattr vì nó là property của BaseTool
            return tool.needs_context
        logger.warning(f"Could not determine 'needs_context' for non-existent tool '{name}'. Assuming True.")
        return True # Mặc định cần context nếu không tìm thấy tool

    def get_tool_function(self, name: str) -> Optional[Callable[..., Union[Any, Coroutine[Any, Any, Any]]]]:
        """Gets the execute method (async or sync) of a tool."""
        tool = self.get_tool(name)
        if tool and hasattr(tool, 'execute') and callable(tool.execute):
            return tool.execute
        logger.error(f"Tool '{name}' not found or has no callable 'execute' method.")
        return None

    async def execute_tool(self, name: str, **kwargs) -> Any:
        """
        Executes a tool asynchronously. Assumes all tools now have async execute.
        Ensures the 'assistant' instance is passed correctly.
        """
        tool = self.get_tool(name)
        if not tool:
            logger.error(f"Attempted to execute non-existent tool: {name}")
            raise ValueError(f"Tool '{name}' not found in registry.")

        execute_method = self.get_tool_function(name)
        if not execute_method:
             raise ValueError(f"Could not find execute method for tool '{name}'.")

        # Kiểm tra lại xem có đúng là async không (dù đã yêu cầu sửa hết)
        if not inspect.iscoroutinefunction(execute_method):
            logger.error(f"Tool '{name}' execute method is NOT async as expected! Please refactor the tool.")
            # Có thể chạy trong executor như trước, nhưng tốt nhất là báo lỗi để sửa tool
            raise TypeError(f"Tool '{name}' execute method must be async.")
            # loop = asyncio.get_running_loop()
            # with ThreadPoolExecutor() as executor:
            #     result = await loop.run_in_executor(executor, lambda: execute_method(assistant=self.assistant, **kwargs))
            # return result

        logger.info(f"Executing async tool '{name}'...")
        try:
            # Gọi trực tiếp hàm async execute
            result = await execute_method(assistant=self.assistant, **kwargs)
            logger.info(f"Tool '{name}' execution finished successfully.")
            return result
        except Exception as e:
            logger.exception(f"Error during execution of tool '{name}': {e}")
            # Trả về lỗi hoặc raise lại tùy theo cách graph xử lý
            # return f"Error executing tool '{name}': {str(e)}"
            raise # Raise lại để node trong graph có thể bắt và xử lý