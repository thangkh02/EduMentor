
import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from core.learning_assistant_v2 import LearningAssistant
from tools.quiz_generator import QuizGenerator
from config import settings

async def test_quiz_generator():
    print("\n--- Starting Manual Tool Test ---", flush=True)
    
    # Initialize Assistant (Mocking collection as None for this test)
    try:
        assistant = LearningAssistant(mongo_collection=None)
        print("LearningAssistant initialized.", flush=True)
    except Exception as e:
        print(f"Failed to init LearningAssistant: {e}", flush=True)
        return

    # Check if _LLMWrapper is present
    if hasattr(assistant, 'llm'):
        print(f"assistant.llm is present: {type(assistant.llm)}", flush=True)
    else:
        print("ERROR: assistant.llm is MISSING!", flush=True)
        return

    # Initialize Tool
    quiz_tool = QuizGenerator()
    print(f"Tool initialized: {quiz_tool.name}", flush=True)

    # Mock Input
    dummy_input = {
        "question": "Machine Learning basics",
        "options": {"num_questions": "2"}
    }

    print(f"\nExecuting tool with input: {dummy_input}", flush=True)
    
    try:
        # Call execute directly
        result = await quiz_tool.execute(assistant, **dummy_input)
        print("\n--- Tool Execution Result ---", flush=True)
        print(result, flush=True)
    except Exception as e:
        print(f"\n--- Tool Execution FAILED ---", flush=True)
        print(f"Error: {e}", flush=True)

if __name__ == "__main__":
    asyncio.run(test_quiz_generator())
