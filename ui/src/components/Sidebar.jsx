import { useLocation, useNavigate } from 'react-router-dom'; // Import useNavigate
import { useState, useEffect, useMemo } from 'react'; // Import useMemo
import { FiMessageSquare, FiFile, FiTrash2, FiCalendar, FiPlus, FiEdit } from "react-icons/fi"; // Added FiEdit
import edubotLogo from "../assets/duu.png";
import { useAuth } from '../contexts/AuthContext';
import { getChatHistory, renameConversation, deleteConversation } from '../services/api'; // Import new functions
import { format, isToday, isYesterday, differenceInDays, parseISO } from 'date-fns'; // Import date-fns helpers
import { vi } from 'date-fns/locale';

// Helper function to determine date group
const getDateGroup = (date) => {
  const now = new Date();
  if (isToday(date)) return 'Hôm nay';
  if (isYesterday(date)) return 'Hôm qua';
  const daysDiff = differenceInDays(now, date);
  if (daysDiff <= 7) return '7 ngày trước';
  // Add more groups if needed (e.g., 'This Month')
  return 'Cũ hơn';
};


const Sidebar = ({ handleQuickQuestion, onSelectConversation }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { currentUser, token } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState(null);
  const navigate = useNavigate(); // Initialize useNavigate
  
  // Fetch chat history from MongoDB
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!currentUser || !token) return;

      setLoading(true);
      setError(null);
      try {
        // API returns { username: "...", history: [...] }
        const apiResponse = await getChatHistory(currentUser.username, token);

        // Check if the response has the 'history' array
        if (!apiResponse || !Array.isArray(apiResponse.history) || apiResponse.history.length === 0) {
          setConversations([]);
          return; // Exit if no history data
        }

        // Use the history array from the response, sort oldest first for grouping
        const sortedHistory = apiResponse.history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const groupedConversations = [];
        let currentConversation = null;
        const timeThreshold = 60 * 60 * 1000; // 1 hour in milliseconds

        sortedHistory.forEach((entry, index) => {
          const currentTimestamp = new Date(entry.timestamp);
          const userMessage = entry.user || "";
          const assistantMessage = entry.assistant || "";

          // Ensure we have something to add (either user or assistant message)
          if (!userMessage?.trim() && !assistantMessage?.trim()) {
             console.warn("Skipping empty history entry:", entry);
             return; // Skip empty entries more robustly
          }

          // Determine the title for a new conversation (first user message)
          const getInitialTitle = (firstEntry) => {
            const firstUserMsg = firstEntry.user?.trim();
            if (firstUserMsg) {
              return firstUserMsg.length > 60 ? `${firstUserMsg.slice(0, 60)}...` : firstUserMsg;
            }
            // Fallback if the first message is from the assistant
            return 'Cuộc trò chuyện';
          };

          if (!currentConversation) {
            // Start the first conversation
            currentConversation = {
              id: `conv_${currentTimestamp.getTime()}_${index}`, // More unique ID
              title: getInitialTitle(entry),
              timestamp: currentTimestamp, // Timestamp of the *first* message in the group
              messages: [entry],
              lastMessageTimestamp: currentTimestamp,
            };
          } else {
            // Check time gap with the last message of the current conversation
            const timeDiff = currentTimestamp - currentConversation.lastMessageTimestamp;

            if (timeDiff < timeThreshold) {
              // Add to the current conversation
              currentConversation.messages.push(entry);
              currentConversation.lastMessageTimestamp = currentTimestamp; // Update last message time
              // Update title ONLY if it's still the default and we just got the first user message
              if (currentConversation.title === 'Cuộc trò chuyện' && userMessage?.trim()) {
                 currentConversation.title = userMessage.trim().length > 60 ? `${userMessage.trim().slice(0, 60)}...` : userMessage.trim();
              }
            } else {
              // Time gap is too large, finalize the previous conversation and start a new one
              if (currentConversation.messages.length > 0) { // Only push if it has messages
                 groupedConversations.push(currentConversation);
              }
              currentConversation = {
                id: `conv_${currentTimestamp.getTime()}_${index}`,
                title: getInitialTitle(entry),
                timestamp: currentTimestamp,
                messages: [entry],
                lastMessageTimestamp: currentTimestamp,
              };
            }
          }
        });

        // Add the last conversation being built
        if (currentConversation) {
          groupedConversations.push(currentConversation);
        }

        // Sort conversations by the timestamp of their *first* message, newest first
        const finalSortedConversations = groupedConversations
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10) // Limit to the 10 most recent conversations
          .map(conv => ({
            ...conv,
            dateGroup: getDateGroup(conv.timestamp) // Add date group
          }));

        setConversations(finalSortedConversations);
        setError(null); // Clear previous errors on success
      } catch (err) {
        // This catch block handles errors from both fetching and processing
        console.error('Error fetching or processing chat history:', err);
        setError('Không thể tải hoặc xử lý lịch sử trò chuyện.');
        setConversations([]); // Clear conversations on error
      } finally {
        // This finally block executes regardless of success or failure
        setLoading(false);
      }
    };

    fetchChatHistory();
  }, [currentUser, token]); // Rerun when user/token changes

  // Group conversations by date using useMemo for performance
  const groupedByDate = useMemo(() => {
    return conversations.reduce((acc, conv) => {
      const group = conv.dateGroup;
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(conv);
      return acc;
    }, {});
  }, [conversations]);

  // Define the order of date groups
  const dateGroupOrder = ['Hôm nay', 'Hôm qua', '7 ngày trước', 'Cũ hơn'];


  const handleSelectChat = (conversation) => {
    setActiveConversationId(conversation.id);
    if (onSelectConversation) {
      onSelectConversation(conversation);
    }
  };

  const startNewChat = () => {
    // Reset active conversation state
    setActiveConversationId(null);
    if (onSelectConversation) {
      onSelectConversation(null); // Clear selected conversation in parent
    }
    // Navigate to the main chat route
    navigate('/chat'); 
  };

  const deleteChat = async (conversationId, e) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc muốn xóa cuộc trò chuyện này?')) return;

    try {
      setLoading(true); // Indicate loading state
      setError(null);
      await deleteConversation(conversationId, token); // Call the API

      // Update state on success
      const newConversations = conversations.filter(conv => conv.id !== conversationId);
      setConversations(newConversations);

      // If we deleted the active conversation, clear it
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        if (onSelectConversation) {
          onSelectConversation(null); // Notify parent to clear chat
        }
      }
      console.log(`Conversation ${conversationId} deleted successfully.`);

    } catch (err) {
      console.error('Error deleting conversation:', err);
      setError('Không thể xóa cuộc trò chuyện. Vui lòng thử lại.');
      // Optionally show a more specific error from err.response.data.detail
    } finally {
      setLoading(false);
    }
  };

  const renameChat = async (conversation, e) => {
    e.stopPropagation();
    const currentTitle = conversation.title;
    const newTitle = prompt('Đổi tên cuộc trò chuyện:', currentTitle);

    if (newTitle && newTitle.trim() && newTitle.trim() !== currentTitle) {
      const trimmedTitle = newTitle.trim();
      try {
        setLoading(true); // Indicate loading state
        setError(null);
        await renameConversation(conversation.id, trimmedTitle, token); // Call the API

        // Update state on success
        const updatedConversations = conversations.map(conv =>
          conv.id === conversation.id ? { ...conv, title: trimmedTitle } : conv
        );
        setConversations(updatedConversations);
        console.log(`Conversation ${conversation.id} renamed to "${trimmedTitle}" successfully.`);

      } catch (err) {
        console.error('Error renaming conversation:', err);
        setError('Không thể đổi tên cuộc trò chuyện. Vui lòng thử lại.');
        // Optionally show a more specific error from err.response.data.detail
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="h-full bg-gray-900 text-gray-300 flex flex-col border-r border-gray-800">
      {/* New Chat Button */}
      <div className="p-4">
        <button 
          onClick={startNewChat} 
          className="flex items-center justify-center w-full gap-3 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors duration-200"
        >
          <FiPlus size={18} />
          <span className="font-medium">Cuộc trò chuyện mới</span>
        </button>
      </div>
      
      {/* Chat History */}
      <div className="flex-1 overflow-hidden flex flex-col px-3">
        <div className="text-sm text-gray-500 px-2 mb-2 flex justify-between items-center">
          <span>Lịch sử trò chuyện</span>
          {conversations.length > 0 && (
            <span className="text-xs opacity-70">{conversations.length} cuộc trò chuyện</span>
          )}
        </div>
        
        <div className="overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="flex justify-center items-center h-20">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-sm text-gray-400">Đang tải...</span>
            </div>
          ) : error ? (
            <div className="text-xs text-red-400 p-3 bg-red-900/20 rounded-lg border border-red-800/50">
              {error}
            </div>
          ) : (
            <>
              {conversations.length === 0 ? (
                <div className="text-sm text-gray-500 flex flex-col items-center justify-center h-20">
                  <FiMessageSquare className="mb-2" size={16} />
                  <span>Chưa có cuộc trò chuyện nào</span>
                </div>
              ) : (
                <div className="pb-4">
                  {dateGroupOrder.map(groupName => (
                    groupedByDate[groupName] && (
                      <div key={groupName}>
                        <div className="text-xs text-gray-500 px-2 mt-4 mb-1 font-semibold sticky top-0 bg-gray-900 py-1 z-10">
                          {groupName}
                        </div>
                        <ul className="space-y-1">
                          {groupedByDate[groupName].map((conversation) => (
                            <li
                              key={conversation.id}
                              onClick={() => handleSelectChat(conversation)}
                              className={`group flex items-center justify-between text-sm rounded-md py-2 px-2.5 cursor-pointer
                              ${activeConversationId === conversation.id
                                ? 'bg-gray-800 text-white'
                                : 'text-gray-300 hover:bg-gray-800/50 hover:text-white'}`}
                            >
                              <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                <span className="mr-1"><FiMessageSquare className="inline mr-2" size={14} /></span>
                                <span>{conversation.title}</span>
                              </div>
                              <div className={`flex space-x-1 ${activeConversationId === conversation.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                <button
                                  onClick={(e) => renameChat(conversation, e)}
                                  className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400"
                                  title="Đổi tên"
                                >
                                  <FiEdit size={14} />
                                </button>
                                <button
                                  onClick={(e) => deleteChat(conversation.id, e)}
                                  className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
                                  title="Xóa"
                                >
                                  <FiTrash2 size={14} />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* User Account Section - You can add this later if needed */}
      <div className="border-t border-gray-800 p-3 mt-auto">
        <div className="flex items-center space-x-2">
          <img src={edubotLogo} alt="Logo" className="w-8 h-8" />
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{currentUser?.name || currentUser?.username || 'EduMentor User'}</p>
            <p className="text-xs text-gray-500 truncate">{currentUser?.email || ''}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
