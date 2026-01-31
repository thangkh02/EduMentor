// Updated API service functions for new conversation structure
// File: ui/src/services/api.js (Updated functions)

// ==================== UPDATED FUNCTIONS ====================

/**
 * Get chat history with new conversations structure
 * Response format:
 * {
 *   username: "user@example.com",
 *   conversations: [
 *     {
 *       _id: "507f1f77bcf86cd799439011",
 *       username: "user@example.com",
 *       session_id: "sess_abc123",
 *       title: "Tìm hiểu về Machine Learning",
 *       created_at: "2024-01-31T10:00:00Z",
 *       updated_at: "2024-01-31T10:05:00Z",
 *       is_active: false,
 *       message_count: 4,
 *       messages: [
 *         {
 *           role: "user",
 *           content: "Câu hỏi 1?",
 *           timestamp: "2024-01-31T10:00:00Z",
 *           metadata: {}
 *         },
 *         {
 *           role: "assistant",
 *           content: "Trả lời 1...",
 *           timestamp: "2024-01-31T10:00:30Z",
 *           metadata: {
 *             route_decision: "retrieve_for_rag",
 *             selected_tool: null,
 *             sources_count: 2
 *           }
 *         }
 *       ]
 *     }
 *   ],
 *   total_conversations: 5,
 *   total_messages: 100
 * }
 */
export const getChatHistory = async (username, token) => {
  const response = await api.get(`/chat_history/${username}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

/**
 * Get list of conversations with pagination
 * Query params:
 * - limit: number (default 20)
 * - skip: number (default 0)
 * - is_active: boolean (optional, filter by active status)
 */
export const listConversations = async (limit = 20, skip = 0, isActive = null, token) => {
  let url = `/conversations?limit=${limit}&skip=${skip}`;
  if (isActive !== null) {
    url += `&is_active=${isActive}`;
  }
  
  const response = await api.get(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
  // Returns: { conversations: [...], total: number, limit: number, skip: number }
};

/**
 * Get single conversation by ID
 */
export const getConversation = async (conversationId, token) => {
  const response = await api.get(`/conversations/${conversationId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
  // Returns: conversation object with all messages
};

/**
 * Archive a conversation (don't delete, just mark as archived)
 */
export const archiveConversation = async (conversationId, token) => {
  const response = await api.post(`/conversations/${conversationId}/archive`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
  // Returns: { success: boolean, message: string }
};

/**
 * Delete a conversation permanently
 */
export const deleteConversation = async (conversationId, token) => {
  const response = await api.delete(`/conversations/${conversationId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
  // Returns: { success: boolean, message: string }
};

/**
 * NOTE: renameConversation is NOT implemented on backend yet
 * If you need to add title renaming, implement PUT /conversations/{id} endpoint on backend
 */
export const renameConversation = async (conversationId, newTitle, token) => {
  // This endpoint is NOT implemented on backend
  // TODO: Implement on backend if needed
  throw new Error('Chức năng đổi tên cuộc trò chuyện chưa được triển khai');
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Transform new conversation format to old format for backward compatibility
 * Converts: { _id, title, messages: [{role, content, timestamp}, ...] }
 * To: { id, title, timestamp, messages: [{user, assistant, timestamp}, ...] }
 */
export const transformConversationFormat = (newConversation) => {
  if (!newConversation) return null;

  const { _id, title, created_at, messages = [] } = newConversation;

  // Group messages into Q&A pairs
  const groupedMessages = [];
  for (let i = 0; i < messages.length; i += 2) {
    const userMsg = messages[i];
    const assistantMsg = messages[i + 1];

    if (userMsg && userMsg.role === 'user') {
      groupedMessages.push({
        user: userMsg.content,
        assistant: assistantMsg?.content || '',
        timestamp: userMsg.timestamp
      });
    }
  }

  return {
    id: _id,
    title: title,
    timestamp: new Date(created_at),
    messages: groupedMessages
  };
};

/**
 * Get latest active conversation for a user
 * Useful for resuming conversation
 */
export const getActiveConversation = async (token) => {
  const response = await api.get('/conversations?limit=1&is_active=true', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (response.data.conversations && response.data.conversations.length > 0) {
    return response.data.conversations[0];
  }
  return null;
};
