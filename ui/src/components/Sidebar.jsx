import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { FiMessageSquare, FiFile, FiTrash2, FiCalendar, FiPlus, FiEdit, FiArchive } from "react-icons/fi";
import edubotLogo from "../assets/duu.png";
import { useAuth } from '../contexts/AuthContext';
import { getChatHistory, deleteConversation, archiveConversation, createConversation } from '../services/api';
import api from '../services/api';
import { format, isToday, isYesterday, differenceInDays, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

// Helper function to determine date group
const getDateGroup = (dateString) => {
  try {
    const date = new Date(dateString);
    const now = new Date();

    if (isToday(date)) return 'Hôm nay';
    if (isYesterday(date)) return 'Hôm qua';

    const daysDiff = differenceInDays(now, date);
    if (daysDiff <= 7) return '7 ngày trước';
    if (daysDiff <= 30) return 'Tháng này';

    return 'Cũ hơn';
  } catch (err) {
    console.error('Error parsing date:', dateString, err);
    return 'Cũ hơn';
  }
};

const Sidebar = ({ handleQuickQuestion, onSelectConversation, refreshTrigger }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user: currentUser, token } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState(null);
  const navigate = useNavigate();

  // Fetch chat history from MongoDB - NEW FORMAT
  useEffect(() => {
    const fetchChatHistory = async () => {
      console.log('=== SIDEBAR FETCH CHAT HISTORY ===');
      console.log('currentUser:', currentUser);
      console.log('token exists:', !!token);

      if (!currentUser || !token) {
        console.log('SKIPPING: No currentUser or token');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        console.log('Calling getChatHistory for:', currentUser.username);
        // API returns NEW format: { username: "...", conversations: [...], total_conversations: ..., total_messages: ... }
        const apiResponse = await getChatHistory(currentUser.username, token);
        console.log('Chat History API Response:', apiResponse);

        // Check if the response has the 'conversations' array
        if (!apiResponse || !Array.isArray(apiResponse.conversations) || apiResponse.conversations.length === 0) {
          console.log('No conversations found in response');
          setConversations([]);
          return;
        }

        // Transform and process conversations
        const formattedConversations = apiResponse.conversations.map((conv, index) => {
          return {
            id: conv._id || `conv_${index}`, // Use MongoDB _id as unique key
            title: conv.title || 'Cuộc trò chuyện không tiêu đề',
            timestamp: new Date(conv.created_at),
            updated_at: new Date(conv.updated_at),
            message_count: conv.message_count || 0,
            is_active: conv.is_active,
            dateGroup: getDateGroup(conv.created_at),
            raw: conv // Keep raw data with messages in {role, content, timestamp} format
          };
        });

        // Sort by updated_at, newest first, limit to 50
        const sortedConversations = formattedConversations
          .sort((a, b) => b.updated_at - a.updated_at)
          .slice(0, 50);

        setConversations(sortedConversations);
        setError(null);
      } catch (err) {
        console.error('Error fetching or processing chat history:', err);
        setError('Không thể tải lịch sử trò chuyện. Vui lòng thử lại.');
        setConversations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChatHistory();
  }, [currentUser, token, refreshTrigger]); // Re-fetch when refreshTrigger changes

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
  const dateGroupOrder = ['Hôm nay', 'Hôm qua', '7 ngày trước', 'Tháng này', 'Cũ hơn'];

  const handleSelectChat = (conversation) => {
    setActiveConversationId(conversation.id);
    if (onSelectConversation) {
      // Pass the formatted conversation data
      onSelectConversation(conversation);
    }
  };

  const startNewChat = async () => {
    try {
      console.log('Starting new chat - deactivating old conversations');

      // Deactivate all active conversations
      // So backend will create a new conversation when user sends first message
      if (token) {
        await api.post('/conversations/deactivate_all', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Deactivated all active conversations');
      }

      // Clear UI
      setActiveConversationId(null);
      if (onSelectConversation) {
        onSelectConversation(null);
      }

      navigate('/chat');
    } catch (error) {
      console.error('Error starting new chat:', error);
      // Continue anyway - user can still send messages
      setActiveConversationId(null);
      if (onSelectConversation) {
        onSelectConversation(null);
      }
      navigate('/chat');
    }
  };

  const deleteChat = async (conversationId, e) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc muốn xóa cuộc trò chuyện này?')) return;

    try {
      setLoading(true);
      setError(null);

      // Call delete API
      const result = await deleteConversation(conversationId, token);

      if (result.success) {
        // Update state on success
        const newConversations = conversations.filter(conv => conv.id !== conversationId);
        setConversations(newConversations);

        // If we deleted the active conversation, clear it
        if (activeConversationId === conversationId) {
          setActiveConversationId(null);
          if (onSelectConversation) {
            onSelectConversation(null);
          }
        }
        console.log(`Conversation ${conversationId} deleted successfully.`);
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
      setError('Không thể xóa cuộc trò chuyện. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const archiveChat = async (conversation, e) => {
    e.stopPropagation();

    try {
      setLoading(true);
      setError(null);

      // Call archive API
      const result = await archiveConversation(conversation.id, token);

      if (result.success) {
        // Remove from active list
        const newConversations = conversations.filter(conv => conv.id !== conversation.id);
        setConversations(newConversations);

        // If we archived the active conversation, clear it
        if (activeConversationId === conversation.id) {
          setActiveConversationId(null);
          if (onSelectConversation) {
            onSelectConversation(null);
          }
        }

        // Show success message
        setError(null);
        console.log(`Conversation ${conversation.id} archived successfully.`);
      }
    } catch (err) {
      console.error('Error archiving conversation:', err);
      setError('Không thể lưu trữ cuộc trò chuyện. Vui lòng thử lại.');
    } finally {
      setLoading(false);
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
            <span className="text-xs opacity-70">{conversations.length} cuộc</span>
          )}
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="flex justify-center items-center h-20">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-sm text-gray-400">Đang tải...</span>
            </div>
          ) : error ? (
            <div className="text-xs text-red-400 p-3 bg-red-900/20 rounded-lg border border-red-800/50 m-2">
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
                              <div className="flex-1 overflow-hidden">
                                <div className="flex items-center truncate">
                                  <FiMessageSquare className="flex-shrink-0 mr-2" size={14} />
                                  <span className={`truncate ${activeConversationId === conversation.id ? 'font-bold' : ''}`}>
                                    {conversation.title}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 ml-6">{conversation.message_count} tin nhắn</span>
                              </div>

                              <div className={`flex space-x-1 ml-2 ${activeConversationId === conversation.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                <button
                                  onClick={(e) => archiveChat(conversation, e)}
                                  className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-yellow-400"
                                  title="Lưu trữ"
                                >
                                  <FiArchive size={14} />
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

      {/* User Account Section */}
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
