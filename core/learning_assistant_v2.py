import os
import json
import re
import asyncio
import logging
from typing import List, Dict, Any, Optional, TypedDict
from langchain.memory import ConversationBufferMemory
from langchain_google_genai import GoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langgraph.graph import StateGraph, END
import os
import json
from langchain.prompts import PromptTemplate
import re
import asyncio
import logging
from typing import List, Dict, Any, Optional, TypedDict
from langchain.memory import ConversationBufferMemory # Keep for now, might remove later if fully switching to DB history
from langchain_google_genai import GoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langgraph.graph import StateGraph, END
from pymongo.collection import Collection # Import Collection type hint
from datetime import datetime, timezone # Add datetime import
from config import settings as config
from retrievers.ensemble_retriever import EnsembleRetriever
from tools.tool_registry import ToolRegistry
from tools import register_all_tools
# No longer importing MongoClient or ConnectionFailure here

logging.basicConfig(level=config.LOGGING_LEVEL, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AssistantState(TypedDict):
    question: str
    chat_history: str
    context: Optional[str]
    response: Optional[str]
    sources: Optional[List[Dict[str, Any]]]
    tool_outputs: Optional[Dict[str, Any]]
    route_decision: Optional[str]
    selected_tool_name: Optional[str]
    needs_context_for_tool: Optional[bool]
    emotion: Optional[Dict[str, Any]] 

class LearningAssistant:
    # Modify __init__ to accept mongo_collection
    def __init__(self,
                 mongo_collection: Optional[Collection], # Accept MongoDB collection object
                 collection_name: str = config.MILVUS_COLLECTION,
                 model_name: str = config.LLM_MODEL_NAME,
                 api_key: Optional[str] = config.GOOGLE_API_KEY,
                 temperature: float = config.LLM_TEMPERATURE):
        self.api_key = api_key
        self.llm = GoogleGenerativeAI(model=model_name, google_api_key=self.api_key, temperature=temperature)
        self.retriever = EnsembleRetriever(
            collection_name=collection_name,
            model_name=config.EMBEDDING_MODEL,
            host=config.MILVUS_HOST,
            port=config.MILVUS_PORT,
            vector_weight=config.VECTOR_WEIGHT,
            bm25_weight=config.BM25_WEIGHT,
            top_k=config.RETRIEVER_TOP_K
        )
        # Keep Langchain memory for now, might phase out later
        self.memory = ConversationBufferMemory(memory_key="chat_history", return_messages=False, output_key="response")
        self.tool_registry = ToolRegistry(self)
        self._register_default_tools()
        self.workflow = self._setup_workflow()
        # Store the passed-in MongoDB collection
        self.mongo_collection = mongo_collection
        # Fix: Instead of direct boolean check, compare with None
        if self.mongo_collection is None:
             logger.warning("LearningAssistant initialized without a valid MongoDB collection. Chat history saving will be disabled.")

    # Remove the _connect_mongo method entirely
    # def _connect_mongo(self, host, port, db_name, collection_name): ...

    def _register_default_tools(self):
        register_all_tools(self.tool_registry)

    def _setup_workflow(self) -> StateGraph:
        workflow = StateGraph(AssistantState)
        workflow.add_node("analyze_intent", self._analyze_intent_node)
        workflow.add_node("retrieve_context", self._retrieve_context_node)
        workflow.add_node("execute_tool", self._execute_tool_node)
        workflow.add_node("generate_response", self._generate_response_node)
        workflow.add_node("format_sources", self._format_sources_node)
        workflow.set_entry_point("analyze_intent")
        workflow.add_conditional_edges(
            "analyze_intent",
            self._route_after_intent,
            {
                "retrieve_for_rag": "retrieve_context",
                "retrieve_for_tool": "retrieve_context",
                "execute_tool_direct": "execute_tool",
                "generate_direct": "generate_response"
            }
        )
        workflow.add_conditional_edges(
            "retrieve_context",
            self._route_after_retrieval,
            {"to_tool": "execute_tool", "to_response": "generate_response"}
        )
        workflow.add_edge("execute_tool", "generate_response")
        workflow.add_edge("generate_response", "format_sources")
        workflow.add_edge("format_sources", END)
        return workflow.compile()

    def _route_after_intent(self, state: AssistantState) -> str:
        decision = state.get("route_decision")
        tool_name = state.get("selected_tool_name")
        needs_context = state.get("needs_context_for_tool", False)
        if decision == "TOOL" and tool_name:
            return "retrieve_for_tool" if needs_context else "execute_tool_direct"
        elif decision == "RAG":
            return "retrieve_for_rag"
        elif decision == "DIRECT":
            return "generate_direct"
        return "retrieve_for_rag"

    def _route_after_retrieval(self, state: AssistantState) -> str:
        return "to_tool" if state.get("route_decision") == "TOOL" else "to_response"

    async def _analyze_intent_node(self, state: AssistantState) -> Dict[str, Any]:
        question = state["question"]
        # Use the chat_history passed in the state, which will be loaded from DB if available
        chat_history = state.get("chat_history", "")
        available_tools = list(self.tool_registry.get_tool_names())
        tools_description = "\n".join([f"- {name}: {self.tool_registry.get_tool_description(name)}"
                                      for name in available_tools if self.tool_registry.get_tool_description(name)]) or "Không có công cụ nào được mô tả."

        prompt = ChatPromptTemplate.from_messages([
            ("system", f"""Bạn là một agent định tuyến thông minh. Nhiệm vụ của bạn là phân tích câu hỏi của người dùng và chọn hành động phù hợp nhất.

                Các công cụ/hành động có sẵn:
                {tools_description}
                - RAG: Truy xuất thông tin từ tài liệu nội bộ (dùng khi câu hỏi liên quan đến tài liệu, ví dụ: "Tóm tắt slide 5").
                - DIRECT: Trả lời trực tiếp không cần tài liệu hay công cụ (dùng cho lời chào, cảm ơn, hoặc câu hỏi chung chung).

                Quy trình:
                1. Phân tích ý định câu hỏi.
                2. Nếu khớp với công cụ (như "tạo quiz", "tìm trên mạng"), chọn tên công cụ.
                3. Nếu liên quan đến tài liệu, chọn "RAG".
                4. Nếu không cần tài liệu/công cụ, chọn "DIRECT".
                Ví dụ:
                - "Tạo quiz từ tài liệu" -> 'action': 'Quiz_Generator', 'confidence': 0.95, 'reasoning': 'Yêu cầu tạo quiz rõ ràng'
                - "Tìm thông tin trên web/Mai là thứ mấy" -> 'action': 'Web_Search', 'confidence': 0.9, 'reasoning': 'Yêu cầu tìm kiếm web'
                - "Giải thích khái niệm trong slide" -> 'action': 'RAG', 'confidence': 0.85, 'reasoning': 'Liên quan đến tài liệu'
                - "Xin chào" -> 'action': 'DIRECT', 'confidence': 0.99, 'reasoning': 'Lời chào đơn giản'
                Output có dạng: 
                    "action": "[Tên công cụ hoặc RAG hoặc DIRECT]", "confidence": [0.0-1.0], "reasoning": "[Lý do]"
                Lưu ý : trả về Json
                """),
            ("human", "Lịch sử hội thoại:\n{chat_history}\n\nCâu hỏi người dùng:\n{question}")
        ])

        parser = JsonOutputParser()
        chain = prompt | self.llm | parser
        input_dict = {"question": question, "chat_history": chat_history}

        try:
            result_json = await asyncio.wait_for(chain.ainvoke(input_dict), timeout=20.0)
            action = result_json.get("action")
            if action == "RAG":
                route_decision = "RAG"
                selected_tool_name = None
                needs_context = False
            elif action == "DIRECT":
                route_decision = "DIRECT"
                selected_tool_name = None
                needs_context = False
            elif self.tool_registry.has_tool(action):
                route_decision = "TOOL"
                selected_tool_name = action
                needs_context = self.tool_registry.get_tool_needs_context(action)
            else:
                route_decision = "RAG"
                selected_tool_name = None
                needs_context = False
                logger.warning(f"Invalid action '{action}', defaulting to RAG")
        except Exception as e:
            logger.exception(f"Error in intent analysis: {e}")
            route_decision = "RAG"
            selected_tool_name = None
            needs_context = False

        return {
            "route_decision": route_decision,
            "selected_tool_name": selected_tool_name,
            "needs_context_for_tool": needs_context
        }

    async def _retrieve_context_node(self, state: AssistantState) -> Dict[str, Any]:
        question = state["question"]
        try:
            results = await asyncio.wait_for(self.retriever.search(question, top_k=config.RETRIEVER_TOP_K), timeout=15.0)
            if results:
                context = "\n\n".join([f"[Nguồn {i+1}]: {doc.get('text', '').strip()}" for i, doc in enumerate(results)])
                return {"context": context, "sources": results}
            return {"context": "Không tìm thấy thông tin liên quan.", "sources": []}
        except Exception as e:
            logger.exception(f"Error retrieving context: {e}")
            return {"context": f"Lỗi khi truy xuất: {str(e)}", "sources": []}
    # Add this in the imports section


    # Add this method to the LearningAssistant class after _analyze_intent_node
    async def _analyze_emotion(self, text: str) -> Dict[str, Any]:
        """Analyzes the emotional content of user input."""
        prompt = PromptTemplate.from_template(
            """Analyze the emotional state reflected in this text:

            "{text}"

            Identify:
            1. Cảm xúc chính (ví dụ: vui, buồn, tức giận, bối rối, tò mò, thất vọng, phấn khích)
            2. Emotional intensity (scale 1-10)
            3. Key emotional triggers or concerns
            4. Suggested tone for response

            Return only a JSON with these keys:
            {{"emotion": "primary_emotion", "intensity": intensity_number, "triggers": "key_triggers", "suggested_tone": "recommended_tone"}}
            """
        )
        
        chain = prompt | self.llm | JsonOutputParser()
        
        try:
            result = await asyncio.wait_for(chain.ainvoke({"text": text}), timeout=10.0)
            return result
        except Exception as e:
            logger.warning(f"Emotion analysis failed: {e}")
            return {
                "emotion": "neutral",
                "intensity": 5,
                "triggers": "unknown",
                "suggested_tone": "balanced"
            }
    async def _execute_tool_node(self, state: AssistantState) -> Dict[str, Any]:
        tool_name = state.get("selected_tool_name")
        if not tool_name:
            return {"tool_outputs": {"error": "Không có công cụ nào được chọn."}}
        tool_kwargs = {k: v for k, v in state.items() if v is not None}
        try:
            result = await self.tool_registry.execute_tool(tool_name, **tool_kwargs)
            return {"tool_outputs": {tool_name: result}}
        except Exception as e:
            return {"tool_outputs": {tool_name: f"Lỗi khi thực thi công cụ '{tool_name}': {str(e)}"}}

    async def _generate_response_node(self, state: AssistantState) -> Dict[str, Any]:
        question = state["question"]
        context = state.get("context")
        # Use the chat_history passed in the state
        chat_history = state.get("chat_history", "")
        tool_outputs = state.get("tool_outputs")
        route_decision = state.get("route_decision", "DIRECT")
        selected_tool_name = state.get("selected_tool_name")

        emotion_data = await self._analyze_emotion(question)
        emotion = emotion_data.get("emotion", "neutral")
        emotion_intensity = emotion_data.get("intensity", 5)
        suggested_tone = emotion_data.get("suggested_tone", "balanced")

        system_message = f"""Bạn là EduMentor, một trợ lý học tập AI thông minh và thân thiện.

        Phân tích cảm xúc người dùng: Họ đang thể hiện cảm xúc "{emotion}" với mức độ {emotion_intensity}/10.
        Hãy điều chỉnh tông giọng của bạn để "{suggested_tone}" khi phản hồi.Nếu người dùng buồn chán hay chán nản với việc học,hãy tiếp thêm động lực cho người dùng.Khi người dùng vui vẻ,hãy chia vui với người dùng"""
        
        human_template_parts = ["Câu hỏi người dùng: {question}\n"]
        input_dict = {"question": question, "chat_history": chat_history}

        if route_decision == "RAG":
            system_message += "\nHãy trả lời dựa vào ngữ cảnh tài liệu dưới đây."
            human_template_parts.append("--- Ngữ cảnh ---")
            human_template_parts.append("{context}")
            human_template_parts.append("--- Kết thúc ngữ cảnh ---")
            input_dict["context"] = context or "Không có ngữ cảnh."
        elif route_decision == "TOOL" and tool_outputs and selected_tool_name:
            tool_result = tool_outputs.get(selected_tool_name, "Công cụ bị lỗi.")
            system_message += f"\nSử dụng kết quả từ công cụ '{selected_tool_name}'."
            human_template_parts.append(f"--- Kết quả từ '{selected_tool_name}' ---")
            human_template_parts.append("{tool_result}")
            human_template_parts.append("--- Kết thúc kết quả ---")
            input_dict["tool_result"] = tool_result
            if context:
                human_template_parts.append("\n--- Ngữ cảnh bổ sung ---")
                human_template_parts.append("{context}")
                human_template_parts.append("--- Kết thúc ngữ cảnh ---")
                input_dict["context"] = context
        else:
            system_message += "\nTrả lời trực tiếp và tự nhiên."

        if chat_history:
            human_template_parts.append("\n--- Lịch sử hội thoại ---")
            human_template_parts.append("{chat_history}")
            human_template_parts.append("--- Kết thúc lịch sử ---")

        human_template = "\n\n".join(human_template_parts) + "\n\nCâu trả lời của EduMentor:"
        prompt = ChatPromptTemplate.from_messages([("system", system_message), ("human", human_template)])
        chain = prompt | self.llm | StrOutputParser()

        try:
            response = await chain.ainvoke(input_dict)
            # We will save history to DB in the main answer method, not here.
            # self.memory.save_context({"question": question}, {"response": response}) # Keep Langchain memory update for now
            return {"response": response}
        except Exception as e:
            logger.exception(f"Error generating response: {e}")
            return {"response": f"Lỗi khi tạo phản hồi: {str(e)}"}

    async def _format_sources_node(self, state: AssistantState) -> Dict[str, Any]:
        response = state.get("response", "")
        sources = state.get("sources")
        route_decision = state.get("route_decision")
        tool_name = state.get("selected_tool_name")
        tool_needs_context = self.tool_registry.get_tool_needs_context(tool_name) if tool_name else False

        # Only add sources if the response exists and sources were retrieved for RAG or a context-needing tool
        if response and sources and (route_decision == "RAG" or (route_decision == "TOOL" and tool_needs_context)):
            valid_sources = []
            source_identifiers_to_ignore = {"không rõ", "unknown", "n/a", ""} # Add variations if needed

            for src in sources:
                source_file = str(src.get('source_file', '')).strip().lower()
                # Filter out sources with ignored identifiers or empty source_file
                if source_file and source_file not in source_identifiers_to_ignore:
                    valid_sources.append(src)

            if valid_sources:
                sources_info = "\n\n**Nguồn tham khảo:**\n"
                for i, src in enumerate(valid_sources[:3]): # Limit to top 3 valid sources
                    # Try to get metadata if it's a string needing parsing, otherwise access directly
                    metadata = {}
                    metadata_raw = src.get('metadata', {})
                    if isinstance(metadata_raw, str):
                        try:
                            metadata = json.loads(metadata_raw)
                        except json.JSONDecodeError:
                            metadata = {} # Keep empty if parsing fails
                    elif isinstance(metadata_raw, dict):
                        metadata = metadata_raw

                    source_display_name = metadata.get('original_filename', src.get('source_file', 'Tài liệu')) # Prefer original filename
                    line = f"{i+1}. Từ '{source_display_name}'"

                    # Add page or slide number if available in metadata
                    page_num = metadata.get('page_number')
                    slide_num = metadata.get('slide_number')
                    if slide_num:
                        line += f" (Slide {slide_num})"
                    elif page_num:
                        line += f" (Trang {page_num})"
                    sources_info += line + "\n"
                response += sources_info
            else:
                 logger.info("No valid sources found to display after filtering.")

        # Ensure the return statement is correctly indented within the method
        return {"response": response}

    async def _save_chat_history(self, username: str, question: str, response: str):
        """Saves a question-response pair to MongoDB for the user."""
        if self.mongo_collection is None or not username:
            logger.warning(f"Cannot save chat history for {username}. MongoDB connection unavailable or username missing.")
            return

        try:
            now_utc = datetime.now(timezone.utc)
            chat_entry = {
                "user": question,
                "assistant": response,
                "timestamp": now_utc
            }
            # Use $push to add to the chat_history array and $inc to count
            self.mongo_collection.update_one(
                {"_id": username},
                {
                    "$push": {"chat_history": chat_entry},
                    "$inc": {"chat_history_count": 1}, # Increment count
                    "$set": {"last_activity": now_utc}, # Update last activity
                    "$setOnInsert": {"_id": username, "username": username} # Ensure user doc exists
                },
                upsert=True
            )
            logger.info(f"Saved chat history for user: {username}")
        except Exception as e:
            logger.error(f"Failed to save chat history for user {username}: {e}")

    async def _load_chat_history(self, username: str, limit: int = 10) -> str:
        """Loads recent chat history from MongoDB for the user."""
        if self.mongo_collection is None or not username:
            return ""

        try:
            user_data = self.mongo_collection.find_one(
                {"_id": username},
                {"chat_history": {"$slice": -limit}} # Get last 'limit' entries
            )
            if user_data and "chat_history" in user_data:
                history_str = "\n".join([
                    f"User: {entry['user']}\nAssistant: {entry['assistant']}"
                    for entry in user_data["chat_history"]
                ])
                return history_str
            return ""
        except Exception as e:
            logger.error(f"Failed to load chat history for user {username}: {e}")
            return ""

    # Modify answer method to accept username
    async def answer(self, question: str, username: Optional[str] = None) -> Dict[str, Any]:
        if not question or not isinstance(question, str) or not question.strip():
            return {"response": "Vui lòng cung cấp câu hỏi hợp lệ.", "sources": [], "tool_outputs": {}, "metadata": {"error": "invalid_input"}}

        # Load chat history from MongoDB if username is provided
        chat_history_str = await self._load_chat_history(username) if username else ""
        emotion_data = await self._analyze_emotion(question)
        initial_state = AssistantState(
            question=question,
            chat_history=chat_history_str, # Use loaded history
            context=None,
            response=None,
            sources=None,
            tool_outputs=None,
            route_decision=None,
            selected_tool_name=None,
            needs_context_for_tool=None,
            emotion=emotion_data
        )

        try:
            final_state = await self.workflow.ainvoke(initial_state, config={"recursion_limit": 15})

            # Save chat history to MongoDB if username is provided and response exists
            final_response = final_state.get("response")
            if username and final_response:
                await self._save_chat_history(username, question, final_response)

            return {
                "response": final_response or "Lỗi không xác định",
                "sources": final_state.get("sources", []),
                "tool_outputs": final_state.get("tool_outputs", {}),
                "metadata": {
                    "route_decision": final_state.get("route_decision"),
                    "selected_tool": final_state.get("selected_tool_name"),
                    "emotion": final_state.get("emotion") 
                }
            }
        except Exception as e:
            logger.exception(f"Error in workflow: {e}")
            return {"response": f"Lỗi hệ thống: {str(e)}", "sources": [], "tool_outputs": {}, "metadata": {"error": "workflow_exception"}}

    def close(self):
        if hasattr(self.retriever, 'close'):
            self.retriever.close()
