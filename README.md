# Sơ đồ dự kiến: 

```mermaid
flowchart TD
    subgraph Input_Processing ["Xử Lý Đầu Vào"]
        direction TB
        V["Video Bài Giảng"] -->|"Whisper (STT + Timestamps)"| TXT_A["Văn bản Audio + Timestamps"]
        S["File Slide (PDF/PPTX)"] -->|"Trích xuất Text/OCR"| TXT_S["Văn bản Slide + Slide Numbers"]
        V -->|"Vision (Keyframe + OCR)"| TXT_S_Vid["Văn bản Slide từ Video + Timestamps"]

        TXT_A -->|"Chunking & Embedding"| DB[("Vector Database + Metadata: Timestamps, Slide , Source")]
        TXT_S -->|"Chunking & Embedding"| DB
        TXT_S_Vid -->|"Chunking & Embedding"| DB
    end

    subgraph Agent_Tools ["Agent & Tool"]
        direction TB
        UM["User Message"] --> RA{"Router Agent"}
        RA -->|"RAG Query"| DB
        DB -->|"Retrieved Context"| RA

        RA -->|"Quyết định Tool"| T_RAG["/RAG Tool/"]
        RA -->|"Quyết định Tool"| T_Web["/Web Search Tool/"]
        RA -->|"Quyết định Tool"| T_Quiz["/Quiz Generator Tool/"]
        RA -->|"Quyết định Tool"| T_Sum["/Summary Tool/"]
        RA -->|"Quyết định Tool"| T_FC["/Flashcard Tool/"]
        RA -->|"Quyết định Tool"| T_Plan["/Study Plan Tool/"]
        RA -->|"Quyết định Tool"| T_Explain["/Concept Explainer Tool/"]
        
        T_RAG --> RA
        T_Web -->|"External Info"| RA
        T_Quiz --> RA
        T_Sum --> RA
        T_FC --> RA
        T_Plan --> RA
        T_Explain --> RA

        DB -->|"Analyze Content"| PA["Phân tích Chủ động"]
        PA -->|"Suggestions/Insights"| RA
    end

    subgraph Output_Generation ["OUTPUT "]
        direction TB
        RA -->|"Final Answer Generation"| LLM_Final["LLM - Generate Final Response"]
        LLM_Final --> OUT_Text["Output Text"]

        T_Sum -->|"Summary Text"| TTS["Text-to-Speech"]
        TTS --> VC["Voice Customizer"] --> OUT_Audio["Output Audio Summary"]

        RA -->|"Data for Viz"| VIZ["Tạo Trực quan hóa + Mindmap/Concept Links"]
        VIZ --> OUT_Viz["Output Hình ảnh/Interactive"]

        OUT_Text --> UserFeedback["User Feedback"]
        UserFeedback --> RA
    end




```









## Cấu trúc API

API được thiết kế với 3 endpoint chính:

### 1. `/upload` - Xử lý và lập chỉ mục tài liệu

**Quy trình:**
- Sinh viên upload file (PDF, PPTX, DOCX, v.v.)
- File được lưu vào thư mục uploads
- Xử lý file đồng bộ:
  - Trích xuất văn bản (PDF → PyMuPDF, PPTX → python-pptx, DOCX → python-docx)
  - Chia nhỏ (chunking) bằng RecursiveCharacterTextSplitter
  - Tạo embedding bằng SentenceTransformer
  - Lưu vào Milvus với metadata (slide number, source)
- Trả về kết quả (số tài liệu đã thêm)

### 2. `/ask` - Truy vấn thông tin

**Quy trình:**
- Gọi LearningAssistant.answer
- intent_analyzer_node phân tích ý định
- Nếu là câu hỏi thông thường → RAG (truy xuất từ Milvus → sinh câu trả lời)
- Nếu cần tool → định tuyến đến công cụ (quiz, flashcards, v.v.)
- Trả về response với metadata (sources, slide number)

### 3. `/tools` - Sử dụng công cụ học tập

**Quy trình:**
- Gọi công cụ trực tiếp qua ToolRegistry.execute_tool
- Công cụ cũng có thể truy xuất ngữ cảnh từ Milvus (nếu cần, ví dụ: Quiz_Generator)

## Các công cụ hỗ trợ

- **Quiz_Generator**: Tạo câu hỏi trắc nghiệm từ tài liệu
- **Flashcard_Generator**: Tạo thẻ ghi nhớ
- **Study_Plan_Creator**: Tạo kế hoạch học tập
- **Concept_Explainer**: Giải thích khái niệm
- **Summary_Generator**: Tạo tóm tắt
- **Mind_Map_Creator**: Tạo sơ đồ tư duy
- **Progress_Tracker**: Theo dõi tiến độ học tập

## Cải tiến

1. **Xử lý tài liệu đa dạng**:
   - Hỗ trợ nhiều định dạng: PDF, PPTX, DOCX, TXT
   - Trích xuất văn bản với các thư viện chuyên biệt
   - Lưu trữ metadata phong phú (slide number, source)

2. **Retrieval thông minh**:
   - EnsembleRetriever kết hợp tìm kiếm vector và BM25
   - Cải thiện độ chính xác khi truy xuất thông tin

3. **Agent Router thông minh**:
   - Phân tích ý định người dùng
   - Định tuyến đến công cụ phù hợp
   - Tích hợp RAG cho câu trả lời chính xác

 
