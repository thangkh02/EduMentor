# --- START OF FILE tools/base_tool.py ---

from abc import ABC, abstractmethod
from typing import Any, TYPE_CHECKING

# Use TYPE_CHECKING to avoid circular import for type hints
if TYPE_CHECKING:
    from core.learning_assistant_v2 import LearningAssistant

class BaseTool(ABC):
    """Base class for all tools in the learning assistant"""

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the unique name of the tool"""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Return a description of the tool for the router agent"""
        pass

    @property
    def needs_context(self) -> bool:
        """
        Specifies if the tool requires retrieved context to function effectively.
        Defaults to True, override in subclasses if context is not needed.
        """
        return True

    @abstractmethod
    async def execute(self, assistant: 'LearningAssistant', **kwargs) -> Any:
        """
        Execute the tool asynchronously with the given parameters.
        The assistant instance is passed to access retriever, llm, etc.
        """
        pass
