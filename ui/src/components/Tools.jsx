import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiFileText, FiBookOpen, FiMap, FiList, FiCpu, FiLayers, FiClock, FiBarChart2, FiAlertTriangle, FiDatabase } from "react-icons/fi";
import { useAuth } from '../contexts/AuthContext';
import { handleToolAction } from '../services/api';

// Import all tool components explicitly
import StudyPlanCreator from "./StudyPlanCreator";
import ProgressTracker from "./ProgressTracker";
import FlashcardGenerator from "./FlashcardGenerator";
import ConceptExplainer from "./ConceptExplainer";
import SummaryGenerator from "./SummaryGenerator";
import MindMapCreator from "./MindMapCreator";
import QuizGenerator from "./QuizGenerator";
import FileManager from "./FileManager"; // Import FileManager

const Tools = () => {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [activeToolId, setActiveToolId] = useState(toolId || "");

  // Thêm state để quản lý trạng thái của công cụ đang hoạt động
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Define tools with their components
  const tools = [
    { id: "quiz_generator", icon: <FiFileText />, name: "Quiz Generator", description: "Tạo bài kiểm tra từ tài liệu học tập", component: QuizGenerator },
    { id: "flashcard_generator", icon: <FiLayers />, name: "Flashcard Generator", description: "Tạo thẻ ghi nhớ từ khái niệm", component: FlashcardGenerator },
    { id: "study_plan_creator", icon: <FiClock />, name: "Study Plan Creator", description: "Lập kế hoạch học tập hiệu quả", component: StudyPlanCreator },
    { id: "progress_tracker", icon: <FiBarChart2 />, name: "Progress Tracker", description: "Theo dõi tiến độ học tập", component: ProgressTracker },
    { id: "concept_explainer", icon: <FiBookOpen />, name: "Concept Explainer", description: "Giải thích khái niệm phức tạp", component: ConceptExplainer },
    { id: "summary_generator", icon: <FiList />, name: "Summary Generator", description: "Tóm tắt nội dung tài liệu", component: SummaryGenerator },
    { id: "mind_map_creator", icon: <FiMap />, name: "Mind Map Creator", description: "Tạo sơ đồ tư duy từ chủ đề", component: MindMapCreator },
    { id: "file_manager", icon: <FiDatabase />, name: "File Manager", description: "Quản lý và tải lên tài liệu học tập cá nhân", component: FileManager },
  ];

  // Ref để theo dõi activeToolId hiện tại, giúp tránh race condition
  const activeToolIdRef = useRef(activeToolId);

  // Update ref when activeToolId changes
  useEffect(() => {
    activeToolIdRef.current = activeToolId;
  }, [activeToolId]);

  // Hàm xử lý khi người dùng gửi yêu cầu từ công cụ
  const handleToolSubmit = (input) => {
    // Capture the toolId that initiated the request
    const requestingToolId = activeToolId;
    console.log(`Submit from tool ${requestingToolId}:`, input);

    // Reset result trước khi gửi yêu cầu mới
    setResult(null);
    setError(null);
    setLoading(true);

    // Gọi API thông qua handleToolAction từ api.js 
    // Không cần truyền setLoading, setError, setResult vì chúng ta sẽ tự xử lý
    handleToolAction(requestingToolId, input,
      // Truyền các hàm callback trống để tránh setState trong handleToolAction
      () => { },
      () => { },
      () => { },
      {})
      .then(response => {
        // RACE CONDITION CHECK:
        // Nếu tool hiện tại đã thay đổi so với lúc gửi request, bỏ qua kết quả này
        if (activeToolIdRef.current !== requestingToolId) {
          console.log(`Ignoring result from ${requestingToolId} because active tool is now ${activeToolIdRef.current}`);
          return;
        }

        console.log("Tools.jsx: handleToolAction response:", response);
        console.log("Tools.jsx: response type:", typeof response);

        // Debug log để kiểm tra cấu trúc response
        if (typeof response === 'object') {
          console.log("Response keys:", Object.keys(response));

          if (response.response) {
            console.log("Response.response type:", typeof response.response);
            console.log("Response.response value:", response.response);
          }
        }

        // Cập nhật state result sau khi nhận được phản hồi từ API
        if (response) {
          setResult(response);
        } else {
          setError("Không nhận được dữ liệu từ API");
        }
      })
      .catch(err => {
        // Cũng kiểm tra race condition cho error
        if (activeToolIdRef.current !== requestingToolId) {
          console.log(`Ignoring error from ${requestingToolId} because active tool is now ${activeToolIdRef.current}`);
          return;
        }

        console.error("Tools.jsx: handleToolAction error:", err);
        setError(err.message || "Đã xảy ra lỗi khi gọi API");
      })
      .finally(() => {
        // Chỉ tắt loading nếu vẫn ở tool đó
        if (activeToolIdRef.current === requestingToolId) {
          setLoading(false);
        }
      });
  };

  // Xử lý khi component được mount hoặc toolId thay đổi
  useEffect(() => {
    console.log("Tools component mounted or toolId changed:", toolId);

    // Clear result ngay lập tức để tránh hiển thị data cũ
    setResult(null);
    setError(null);

    // Nếu không có toolId (đang ở /tools), không tự động chuyển hướng
    if (!toolId) {
      setActiveToolId(""); // Không chọn công cụ nào
      return;
    }

    // Nếu có toolId, kiểm tra tính hợp lệ
    const validTool = tools.some(tool => tool.id === toolId);
    if (!validTool) {
      console.warn(`Invalid toolId: ${toolId}, navigating to /tools`);
      // Nếu toolId không hợp lệ, chuyển hướng đến trang công cụ chính
      navigate(`/tools`, { replace: true });
      return;
    }

    // Cập nhật trạng thái công cụ đang hoạt động
    setActiveToolId(toolId);

    // Reset các state khi chuyển đổi công cụ
    setLoading(false);
    setError(null);
    setResult(null);
  }, [toolId, navigate]); // Removed 'tools' from deps since it's defined inline and causes re-renders

  // Render the active tool component
  const renderToolContent = () => {
    console.log("Rendering tool content for activeToolId:", activeToolId);

    // Nếu không có công cụ nào được chọn (đang ở trang /tools), hiển thị trang tổng quan
    if (!activeToolId) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <h2 className="text-2xl font-bold mb-6 text-blue-400">Chào mừng đến với Công cụ học tập</h2>
          <p className="text-gray-300 mb-8 max-w-2xl">Vui lòng chọn một công cụ từ menu bên trái để bắt đầu sử dụng.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="bg-gray-700 rounded-lg p-5 cursor-pointer hover:bg-gray-600 transition-colors"
                onClick={() => {
                  console.log(`Clicked on tool card: ${tool.id}`);
                  setActiveToolId(tool.id);
                  navigate(`/tools/${tool.id}`);
                }}
              >
                <div className="flex items-center mb-3">
                  <span className="text-2xl mr-3 text-blue-400">{tool.icon}</span>
                  <h3 className="text-lg font-medium">{tool.name}</h3>
                </div>
                <p className="text-gray-400 text-sm">{tool.description}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const toolToRender = tools.find(t => t.id === activeToolId);

    if (!toolToRender || !toolToRender.component) {
      console.error(`Component not found for toolId: ${activeToolId}`);
      return (
        <div className="flex items-center justify-center h-full text-gray-400 p-6">
          <FiAlertTriangle className="mr-2 text-red-500" />
          <span>Tool component configuration error for '{activeToolId}'.</span>
        </div>
      );
    }

    const ActiveComponent = toolToRender.component;
    console.log(`Rendering component for ${activeToolId}:`, ActiveComponent.name);

    // Truyền props cho tất cả các component công cụ
    return (
      <ActiveComponent
        key={activeToolId}
        onSubmit={handleToolSubmit}
        loading={loading}
        error={error}
        result={result}
      />
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 p-4 md:p-6 h-full">
      {/* Sidebar */}
      <div className="lg:col-span-1 bg-gray-800 rounded-lg p-3 md:p-4 overflow-y-auto custom-scrollbar shadow-md flex flex-col">
        <h2 className="text-lg md:text-xl font-bold mb-4 text-gray-100 px-1 flex-shrink-0">Công cụ học tập</h2>
        <div className="space-y-1.5 md:space-y-2 flex-grow overflow-y-auto custom-scrollbar">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                console.log(`Clicked sidebar item: ${tool.id}`);
                setActiveToolId(tool.id);
                navigate(`/tools/${tool.id}`, { replace: true });
              }}
              className={`w-full flex items-center p-2.5 md:p-3 rounded-md transition-colors duration-150 ease-in-out ${activeToolId === tool.id
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-700/50 text-gray-300 hover:bg-gray-600/70 hover:text-white"
                }`}
              aria-current={activeToolId === tool.id ? "page" : undefined}
            >
              <span className="text-lg md:text-xl mr-3 flex-shrink-0 w-5 text-center">{tool.icon}</span>
              <div className="text-left overflow-hidden">
                <div className="font-medium text-sm md:text-base truncate">{tool.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lg:col-span-3 bg-gray-800/50 rounded-lg overflow-y-auto custom-scrollbar shadow-inner h-full min-h-0">
        {!token ? (
          <div className="flex items-center justify-center h-full text-gray-400 p-6">
            <div className="text-center">
              <FiAlertTriangle className="text-4xl mb-3 mx-auto text-yellow-500" />
              <p>Vui lòng <a href="/login" className="text-blue-400 hover:underline">đăng nhập</a> để sử dụng các công cụ học tập.</p>
            </div>
          </div>
        ) : (
          renderToolContent()
        )}
      </div>
    </div>
  );
};

export default Tools;
