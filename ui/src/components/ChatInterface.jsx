import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { FiSend, FiLoader, FiCornerDownRight, FiChevronDown } from 'react-icons/fi';
import { askQuestion, getChatHistory } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { TypeAnimation } from 'react-type-animation';
import eduLogo from '../assets/duu.png';
import { useOutletContext } from 'react-router-dom';

// Memoized Message component to prevent unnecessary re-renders
const ChatMessage = memo(({ message, onTypingComplete }) => {
  const { role, content, isTyping, isLoading, isError } = message;
  
  return (
    <div
      className={`flex py-4 px-4 md:px-6 ${role === 'user' ? 'bg-gray-800' : 'bg-gray-850'} animate-fadeIn`}
    >
      <div className="flex w-full max-w-3xl mx-auto items-start space-x-4">
        {role === 'assistant' ? (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
            <img src={eduLogo} alt="EduMentor Logo" className="w-8 h-8 object-cover" />
          </div>
        ) : (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
          </div>
        )}
        <div className="flex-grow">
          {isTyping ? (
            <TypeAnimation
              sequence={[
                content,
                () => {
                  // Call the callback when typing is complete
                  if (onTypingComplete) onTypingComplete();
                }
              ]}
              wrapper="pre"
              speed={50}
              className="whitespace-pre-wrap font-sans text-sm md:text-base break-words text-white"
              cursor={false}
              repeat={1}
            />
          ) : isLoading ? (
            <div className="flex items-center">
              <span className="mr-2">{content}</span>
              <div className="animate-pulse flex space-x-1">
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              </div>
            </div>
          ) : (
            <pre className={`whitespace-pre-wrap font-sans text-sm md:text-base break-words ${isError ? 'text-red-400' : 'text-white'}`}>
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
});

function ChatInterface({ commonQuestions }) {
  const { currentUser, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isTypingInProgress, setIsTypingInProgress] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  
  // Nhận context từ App.jsx thông qua useOutletContext
  const { selectedConversation, quickQuestion, resetQuickQuestion } = useOutletContext() || {};
  
  // --- Xử lý khi người dùng chọn một cuộc trò chuyện từ sidebar ---
  useEffect(() => {
    if (selectedConversation && selectedConversation.messages) {
      try {
        // Chuyển đổi format của conversation thành messages
        const formattedMessages = [];
        
        // Với mỗi tin nhắn trong cuộc trò chuyện
        selectedConversation.messages.forEach(entry => {
          // Thêm tin nhắn người dùng trước
          if (entry.user && entry.user.trim()) {
            formattedMessages.push({ 
              role: 'user', 
              content: entry.user,
              timestamp: entry.timestamp
            });
          }
          
          // Sau đó thêm tin nhắn của assistant
          if (entry.assistant && entry.assistant.trim()) {
            formattedMessages.push({ 
              role: 'assistant',
              content: entry.assistant,
              timestamp: entry.timestamp
            });
          }
        });
        
        // Cập nhật state messages
        setMessages(formattedMessages);
        setInitialLoadComplete(true);
        // Sau khi load messages, đảm bảo scroll xuống cuối
        setTimeout(() => scrollToBottom(), 100);
      } catch (err) {
        console.error('Lỗi khi xử lý cuộc trò chuyện được chọn:', err);
        setError('Không thể hiển thị cuộc trò chuyện');
      }
    } else if (!selectedConversation && initialLoadComplete) {
      // Nếu người dùng chọn "Cuộc trò chuyện mới", xóa messages
      setMessages([]);
    }
  }, [selectedConversation]);

  // --- Fetch Chat History nếu không có cuộc trò chuyện nào được chọn ---
  useEffect(() => {
    // Chỉ tải lịch sử khi component mount và không có cuộc trò chuyện nào được chọn
    const loadHistory = async () => {
      if (!initialLoadComplete && currentUser && token && !selectedConversation) {
        try {
          setIsLoading(true);
          setError(null);
          
          // Lấy danh sách chat history từ API
          const response = await getChatHistory(currentUser.username, token);
          
          console.log("Chat history API response:", response);
          
          // Kiểm tra xem response có đúng định dạng không
          if (!response || !response.history || !Array.isArray(response.history) || response.history.length === 0) {
            console.log("No chat history found or empty history array");
            setMessages([]);
            setIsLoading(false);
            setInitialLoadComplete(true);
            return;
          }
          
          // Lấy tin nhắn mới nhất từ lịch sử
          const chatHistory = response.history;
          const latestEntry = chatHistory[chatHistory.length - 1]; // Lấy tin nhắn gần nhất
          
          console.log("Latest chat entry:", latestEntry);
          
          // Tạo tin nhắn mới từ entry gần nhất
          const formattedMessages = [];
          
          if (latestEntry.user) {
            formattedMessages.push({ 
              role: 'user', 
              content: latestEntry.user, 
              timestamp: latestEntry.timestamp 
            });
          }
          
          if (latestEntry.assistant) {
            formattedMessages.push({ 
              role: 'assistant', 
              content: latestEntry.assistant, 
              timestamp: latestEntry.timestamp 
            });
          }
          
          setMessages(formattedMessages);
          console.log("Set formatted messages:", formattedMessages);
        } catch (err) {
          console.error("Lỗi khi tải lịch sử trò chuyện:", err);
        } finally {
          setIsLoading(false);
          setInitialLoadComplete(true);
        }
      } else if (!initialLoadComplete) {
        setInitialLoadComplete(true);
      }
    };
    
    loadHistory();
  }, [currentUser, token, initialLoadComplete, selectedConversation]);

  // Xử lý khi người dùng chọn câu hỏi nhanh từ sidebar
  useEffect(() => {
    if (quickQuestion && quickQuestion.trim()) {
      setInput(quickQuestion);
      resetQuickQuestion?.(); // Reset lại quickQuestion sau khi đã set vào input
    }
  }, [quickQuestion, resetQuickQuestion]);

  // --- Track scroll position to show/hide scroll button ---
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Show button if user has scrolled up at least 100px from bottom
      const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 100;
      setShowScrollButton(!isNearBottom && messages.length > 0);
      
      // If user manually scrolled to bottom, clear the unread messages indicator
      if (isNearBottom) {
        setHasUnreadMessages(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages]);

  // --- Improved Scroll Logic ---
  const scrollToBottom = useCallback((behavior = "auto") => {
    if (!messagesEndRef.current) return;
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      messagesEndRef.current.scrollIntoView({ 
        behavior, 
        block: "end" 
      });
    });
  }, []);

  // Handle typing animation completion
  const handleTypingComplete = useCallback(() => {
    setIsTypingInProgress(false);
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  // Update messages and scroll when new messages arrive
  useEffect(() => {
    const hasTypingMessage = messages.some(msg => msg.isTyping);
    setIsTypingInProgress(hasTypingMessage);
    
    // Check if we're at the bottom before scrolling
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      const isNearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 100;
      
      if (isNearBottom || messages.some(msg => msg.isLoading)) {
        scrollToBottom();
      } else if (messages.length > 0) {
        // If user has scrolled up, show unread indicator
        setHasUnreadMessages(true);
      }
    }
  }, [messages, scrollToBottom]);

  // Scroll to bottom when initial loading completes
  useEffect(() => {
    if (initialLoadComplete) {
      scrollToBottom();
    }
  }, [initialLoadComplete, scrollToBottom]);

  // --- Textarea Height Adjustment ---
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120); // Max height of 120px
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  // --- Message Formatting ---
  const formatMessage = (content) => {
    let formattedContent = content
      .trim()
      .replace(/\n\s*\n/g, '\n')
      .replace(/```[^`]*```/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .trim();
      
    formattedContent = formattedContent.replace(/(\d+\.)\s+([^\n]+)(?=\s*(?:\d+\.|$))/g, function(match, number, content) {
      return number + ' ' + content.trim() + '\n';
    });
    
    formattedContent = formattedContent.replace(/\n\s*\n/g, '\n');
    
    return formattedContent;
  };

  // --- Send Message Handler ---
  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage = { role: 'user', content: trimmedInput };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    setHasUnreadMessages(false);

    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }

    try {
      const loadingMessage = { role: 'assistant', content: 'Đang xử lý...', isLoading: true };
      setMessages(prev => [...prev, loadingMessage]);
      scrollToBottom("smooth");

      const response = await askQuestion(userMessage.content, token);
      const aiContent = formatMessage(response.response || "Xin lỗi, tôi chưa nhận được phản hồi hợp lệ.");

      setMessages(prev => prev.map(msg =>
        (msg.isLoading) ? { role: 'assistant', content: aiContent, isTyping: true } : msg
      ));
      setIsTypingInProgress(true);
    } catch (err) {
      console.error("Lỗi khi gửi tin nhắn:", err);
      const errorDetail = err.response?.data?.detail || err.message;
      const errorMessage = errorDetail || 'Đã có lỗi xảy ra khi kết nối tới máy chủ. Vui lòng thử lại.';
      setError(errorMessage);
      
      setMessages(prev => prev.map(msg => 
        (msg.isLoading) ? { role: 'assistant', content: `Lỗi: ${errorMessage}`, isError: true } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, token, scrollToBottom]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 relative">
      {/* Messages container - each message takes the full width */}
      <div 
        ref={chatContainerRef}
        className="flex-grow overflow-y-auto custom-scrollbar scroll-smooth"
      >
        {messages.length === 0 && !isLoading && initialLoadComplete ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4 overflow-hidden">
              <img src={eduLogo} alt="EduMentor Logo" className="w-16 h-16 object-cover" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">EduMentor AI</h3>
            <p className="text-gray-400 max-w-sm">Hãy đặt câu hỏi để bắt đầu cuộc trò chuyện. Tôi sẵn sàng giúp đỡ bạn!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <ChatMessage 
              key={index} 
              message={msg} 
              onTypingComplete={msg.isTyping ? handleTypingComplete : undefined}
            />
          ))
        )}
        <div ref={messagesEndRef} className="h-0.5" />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          className={`absolute bottom-20 right-6 z-10 p-2 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 transition-all focus:outline-none ${
            hasUnreadMessages ? 'animate-bounce' : ''
          }`}
          onClick={() => {
            scrollToBottom("smooth");
            setHasUnreadMessages(false);
          }}
          aria-label="Scroll to bottom"
        >
          <FiChevronDown className="text-white text-xl" />
          {hasUnreadMessages && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full"></span>
          )}
        </button>
      )}

      {/* Error display */}
      {error && !messages.some(msg => msg.isError && msg.content.includes(error)) && (
        <div className="px-4 py-2 bg-red-900/30 border-t border-red-800">
          <p className="text-red-400 text-sm max-w-3xl mx-auto">
            {error}
          </p>
        </div>
      )}

      {/* Typing indicator when AI is generating a response */}
      {isTypingInProgress && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs rounded-full animate-pulse">
          AI đang nhập...
        </div>
      )}

      {/* Input container */}
      <div className="p-4 border-t border-gray-700 bg-gray-800">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end bg-gray-700 rounded-lg p-2 focus-within:ring-2 focus-within:ring-blue-500 shadow-lg">
            <textarea
              ref={textareaRef}
              className="flex-grow bg-transparent text-white placeholder-gray-400 focus:outline-none resize-none overflow-y-auto custom-scrollbar px-2 py-1 text-sm md:text-base"
              rows="1"
              placeholder="Nhập câu hỏi của bạn..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              style={{ height: 'auto' }}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className={`ml-2 p-2.5 rounded-lg text-white flex-shrink-0 ${
                isLoading || !input.trim()
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              } transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-700`}
              aria-label="Gửi tin nhắn"
            >
              {isLoading ? (
                <FiLoader className="h-5 w-5 animate-spin" />
              ) : (
                <FiSend className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 text-center">Nhấn Enter để gửi, Shift + Enter để xuống dòng.</p>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;
