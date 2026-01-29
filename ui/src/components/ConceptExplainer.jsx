import { useState, useEffect } from 'react';
import { FiBookOpen, FiLoader, FiAlertTriangle } from 'react-icons/fi';
import Markdown from 'react-markdown'; // Import Markdown renderer
import remarkGfm from 'remark-gfm'; // Import GFM plugin for tables, etc.
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'; // Import syntax highlighter
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAuth } from '../contexts/AuthContext';

// Use props from parent (Tools.jsx)
const ConceptExplainer = ({ onSubmit, result, loading, error }) => {
  const [concept, setConcept] = useState('');
  const [explanation, setExplanation] = useState(null);
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
      console.log('ConceptExplainer received result:', result);
      try {
        // Process result based on type
        if (typeof result === 'string') {
          setExplanation(result);
          setLocalError(null);
        } else if (typeof result === 'object') {
          if (result.error) {
            setLocalError(result.error);
            setExplanation(null);
          } else if (result.response || result.content) {
            const content = result.response || result.content;
            setExplanation(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
            setLocalError(null);
          } else {
            // Default to stringify for other objects
            setExplanation(JSON.stringify(result, null, 2));
            setLocalError(null);
          }
        } else {
          setExplanation(String(result));
          setLocalError(null);
        }
      } catch (err) {
        console.error("Error processing concept explanation:", err);
        setLocalError("Lỗi xử lý kết quả: " + err.message);
        setExplanation(typeof result === 'string' ? result : "Không thể hiển thị kết quả");
      }
    }
  }, [result]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!concept.trim() || !token) {
      return;
    }
    
    // Clear previous results
    setExplanation(null);
    setLocalError(null);
    
    // Submit request
    onSubmit(concept);
  };
  
  // Combine errors from props and local state
  const displayError = error || localError;

  // Markdown components for rendering code blocks
  const components = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={`bg-gray-700 rounded px-1 py-0.5 text-sm font-mono ${className || ''}`} {...props}>
          {children}
        </code>
      );
    },
    h1: ({node, ...props}) => <h1 className="text-2xl font-bold border-b border-gray-600 pb-2 mb-4" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-xl font-bold border-b border-gray-600 pb-1 mb-3" {...props} />,
    h3: ({node, ...props}) => <h3 className="text-lg font-semibold mb-2" {...props} />,
    p: ({node, ...props}) => <p className="mb-3 leading-relaxed" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc list-inside mb-3 pl-4" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-3 pl-4" {...props} />,
    li: ({node, ...props}) => <li className="mb-1" {...props} />,
    a: ({node, ...props}) => <a className="text-blue-400 hover:underline" {...props} />,
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6">
      <div className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4 flex items-center text-gray-100">
          <FiBookOpen className="mr-2 text-yellow-400" />
          Giải thích khái niệm
        </h2>
        <p className="text-gray-300 mb-4 text-sm">
          Nhập khái niệm bạn muốn hiểu rõ hơn. Hệ thống sẽ giải thích chi tiết dựa trên tài liệu đã được tải lên.
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Nhập khái niệm (ví dụ: Bayesian Network)"
              className="flex-grow bg-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent placeholder-gray-500"
              disabled={loading || !token}
            />
            <button
              type="submit"
              disabled={loading || !concept.trim() || !token}
              className={`bg-yellow-600 text-white rounded-md px-5 py-2 flex items-center justify-center transition duration-150 ease-in-out ${loading || !concept.trim() || !token ? 'opacity-60 cursor-not-allowed' : 'hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 focus:ring-offset-gray-800'}`}
            >
              {loading ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Đang xử lý...
                </>
              ) : (
                'Giải thích'
              )}
            </button>
          </div>
          {!token && <p className="text-xs text-yellow-400 mt-2">Bạn cần đăng nhập để sử dụng tính năng này.</p>}
        </form>

        {/* Display error message */}
        {displayError && !loading && (
          <div className="mt-4 text-red-400 bg-red-900/30 p-3 rounded-md flex items-center text-sm border border-red-700">
            <FiAlertTriangle className="mr-2 flex-shrink-0" />
            <span>{displayError}</span>
          </div>
        )}
      </div>

      {/* Display Area for Explanation */}
      <div className="flex-1 mt-6 min-h-0 overflow-y-auto bg-gray-700/30 rounded-lg p-4 md:p-6 border border-gray-700 relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/70 backdrop-blur-sm z-10">
            {/* Enhanced loading animation */}
            <div className="relative">
              <div className="w-16 h-16 border-t-4 border-b-4 border-yellow-500 rounded-full animate-spin"></div>
              <div className="w-16 h-16 border-r-4 border-l-4 border-yellow-300 rounded-full animate-ping absolute inset-0 opacity-30"></div>
            </div>
            <div className="mt-6 text-yellow-300 text-center">
              <p className="font-semibold">Đang phân tích khái niệm...</p>
              <p className="text-sm text-yellow-400/70 mt-1">Vui lòng đợi trong giây lát</p>
              
              {/* Progress bar */}
              <div className="w-64 h-1.5 bg-gray-700 rounded-full mt-4 overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {explanation ? (
          <div className="prose prose-invert max-w-none prose-sm md:prose-base">
            <Markdown remarkPlugins={[remarkGfm]} components={components}>
              {explanation}
            </Markdown>
          </div>
        ) : !displayError ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FiBookOpen className="text-5xl mb-4 mx-auto opacity-30" />
              <p>Nhập khái niệm và nhấn "Giải thích" để xem kết quả.</p>
            </div>
          </div>
        ) : null /* Don't show initial message if there's an error */ }
      </div>
    </div>
  );
};

export default ConceptExplainer;
