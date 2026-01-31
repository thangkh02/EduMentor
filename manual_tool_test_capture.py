
import asyncio
import os
import sys

# Redirect stdout/stderr to file
log_file = open("debug_manual.log", "w", encoding="utf-8")
sys.stdout = log_file
sys.stderr = log_file

sys.path.append(os.getcwd())

from core.learning_assistant_v2 import LearningAssistant
from tools.quiz_generator import QuizGenerator
from config import settings

async def test_quiz_generator():
    print("--- Starting Manual Tool Test ---", flush=True)
    
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

    print(f"Executing tool with input: {dummy_input}", flush=True)
    
    try:
        # Call execute directly
        result = await quiz_tool.execute(assistant, **dummy_input)
        print("--- Tool Execution Result ---", flush=True)
        print(result, flush=True)
    except Exception as e:
        print(f"--- Tool Execution FAILED ---", flush=True)
        print(f"Error: {e}", flush=True)
    
    log_file.close()

if __name__ == "__main__":
    asyncio.run(test_quiz_generator())
