import { useState, useEffect } from 'react';
import { FiMap, FiLoader, FiAlertTriangle } from 'react-icons/fi';
import MindMapViewer from './MindMapViewer';
import { useAuth } from '../contexts/AuthContext';

// Use props from parent (Tools.jsx)
const MindMapCreator = ({ onSubmit, result, loading, error }) => {
  const [topic, setTopic] = useState('');
  const [mindMapMarkdown, setMindMapMarkdown] = useState(null);
  const [localError, setLocalError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0); // For progress indicator
  const { token } = useAuth();
  
  // Loading animation effect
  useEffect(() => {
    let progressInterval;
    if (loading) {
      setLoadingProgress(0);
      
      // Simulate progress increasing over time, but never reaching 100% until complete
      progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          // Slow down as we get closer to 90%
          const increment = prev < 30 ? 5 : prev < 60 ? 3 : prev < 80 ? 1 : 0.5;
          return Math.min(prev + increment, 90);
        });
      }, 500);
    } else {
      // When loading completes, jump to 100%
      setLoadingProgress(100);
      // Then reset after animation completes
      const resetTimeout = setTimeout(() => {
        setLoadingProgress(0);
      }, 1000);
      
      return () => clearTimeout(resetTimeout);
    }
    
    return () => clearInterval(progressInterval);
  }, [loading]);

  // Process the result when it changes
  useEffect(() => {
    if (result) {
      console.log('MindMapCreator received result:', result);
      try {
        // Process result based on type
        if (typeof result === 'string') {
          // Direct markdown string
          console.log('Result is a string, setting as markdown directly');
          setMindMapMarkdown(result);
          setLocalError(null);
        } else if (typeof result === 'object') {
          // Log để debug object structure
          console.log('Result is an object with keys:', Object.keys(result));
          
          if (result.error) {
            console.error('Error from backend:', result.error);
            setLocalError(result.error);
            setMindMapMarkdown(null);
          } else if (result.markdown) {
            // Extract markdown from object structure
            console.log('Found markdown key in result:', result.markdown.substring(0, 50) + '...');
            setMindMapMarkdown(result.markdown);
            setLocalError(null);
          } else if (result.response && typeof result.response === 'string') {
            // Handle legacy response format
            console.log('Found string response:', result.response.substring(0, 50) + '...');
            setMindMapMarkdown(result.response);
            setLocalError(null);
          } else if (result.response && result.response.markdown) {
            // Handle nested response structure
            console.log('Found markdown in nested response:', result.response.markdown.substring(0, 50) + '...');
            setMindMapMarkdown(result.response.markdown);
            setLocalError(null);
          } else {
            // ADDED: Kiểm tra cấu trúc dữ liệu khác có thể chứa markdown
            const nestedData = result.data || result.content || result.result || {};
            if (nestedData.markdown || typeof nestedData === 'string') {
              const mdContent = nestedData.markdown || nestedData;
              console.log('Found markdown in data/content/result:', mdContent.substring(0, 50) + '...');
              setMindMapMarkdown(mdContent);
              setLocalError(null);
            } else {
              // Unknown format - try to stringify it for debugging
              console.error('Invalid mind map format:', result);
              console.log('Full result:', JSON.stringify(result, null, 2));
              setLocalError("Định dạng không hợp lệ từ backend");
            }
          }
        } else {
          console.log('Result is neither string nor object, converting to string');
          setMindMapMarkdown(String(result));
          setLocalError(null);
        }
      } catch (err) {
        console.error("Error processing mind map result:", err);
        setLocalError("Lỗi xử lý kết quả: " + err.message);
      }
    } else {
      console.log('No result received (result is null/undefined)');
    }
  }, [result]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!topic.trim() || !token) {
      return;
    }
    
    // Clear previous results
    setMindMapMarkdown(null);
    setLocalError(null);
    
    // Submit request
    console.log('Submitting mind map request for topic:', topic);
    onSubmit(topic);
  };

  // Combine errors from props and local state
  const displayError = error || localError;

  return (
    <div className="h-full flex flex-col p-4 md:p-6">
      <div className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4 flex items-center text-gray-100">
          <FiMap className="mr-2 text-purple-400" />
          Tạo sơ đồ tư duy
        </h2>
        <p className="text-gray-300 mb-4 text-sm">
          Nhập chủ đề bạn muốn tạo sơ đồ tư duy. Hệ thống sẽ tạo sơ đồ dựa trên tài liệu đã được tải lên.
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Nhập chủ đề (ví dụ: Bayesian Networks)"
              className="flex-grow bg-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500"
              disabled={loading || !token}
            />
            <button
              type="submit"
              disabled={loading || !topic.trim() || !token}
              className={`bg-purple-600 text-white rounded-md px-5 py-2 flex items-center justify-center transition duration-150 ease-in-out ${loading || !topic.trim() || !token ? 'opacity-60 cursor-not-allowed' : 'hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 focus:ring-offset-gray-800'}`}
            >
              {loading ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Đang tạo...
                </>
              ) : (
                'Tạo sơ đồ'
              )}
            </button>
          </div>
          {!token && <p className="text-xs text-primary-50 mt-2">Bạn cần đăng nhập để sử dụng tính năng này.</p>}
        </form>

        {displayError && !loading && (
          <div className="mt-4 text-red-400 bg-red-900/30 p-3 rounded-md flex items-center text-sm border border-red-700">
            <FiAlertTriangle className="mr-2 flex-shrink-0" />
            <span>{displayError}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-gray-700/30 rounded-lg p-4 md:p-6 border border-gray-700 relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/70 backdrop-blur-sm z-10">
            {/* Enhanced loading animation */}
            <div className="relative">
              <div className="w-16 h-16 border-t-4 border-b-4 border-purple-500 rounded-full animate-spin"></div>
              <div className="w-16 h-16 border-r-4 border-l-4 border-purple-300 rounded-full animate-ping absolute inset-0 opacity-30"></div>
            </div>
            <div className="mt-6 text-purple-300 text-center">
              <p className="font-semibold">Đang tạo sơ đồ tư duy...</p>
              <p className="text-sm text-purple-400/70 mt-1">Vui lòng đợi trong giây lát</p>
              
              {/* Progress bar */}
              <div className="w-64 h-1.5 bg-gray-700 rounded-full mt-4 overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {mindMapMarkdown ? (
          <div className="h-full w-full">
            {/* ADDED: Key prop để đảm bảo component được re-render khi markdown thay đổi */}
            <MindMapViewer markdown={mindMapMarkdown} key={mindMapMarkdown.substring(0, 20)} />
          </div>
        ) : !displayError ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FiMap className="text-5xl mb-4 mx-auto opacity-30" />
              <p>Nhập chủ đề và nhấn "Tạo sơ đồ" để bắt đầu.</p>
            </div>
          </div>
        ) : null /* Don't show initial message if there's an error */ }
      </div>
      
      {/* ADDED: Debugging section để hiển thị thông tin về markdown */}
      {mindMapMarkdown && (
        <div className="mt-3 text-xs bg-gray-900 p-3 rounded border border-gray-700 hidden">
          <details>
            <summary>Debug Data (click to show/hide)</summary>
            <pre className="mt-2 whitespace-pre-wrap overflow-auto max-h-40 text-gray-400">
              {mindMapMarkdown.substring(0, 300) + "..."}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default MindMapCreator;