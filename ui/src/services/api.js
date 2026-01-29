import axios from 'axios';

// Ensure this points to your FastAPI backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'; // Default to 5000 if not set

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the token if it exists
// This is handled in AuthContext now, but could be an alternative location
// api.interceptors.request.use(config => {
//   const token = localStorage.getItem('authToken');
//   if (token) {
//     config.headers['Authorization'] = `Bearer ${token}`;
//   }
//   return config;
// }, error => {
//   return Promise.reject(error);
// });

// Optional: Add response interceptor for error handling (e.g., 401 for logout)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      // Handle unauthorized access, e.g., redirect to login
      console.error("Unauthorized access - 401");
      // Potentially call logout function from AuthContext here if accessible
      // Or emit an event that App.jsx listens to
      localStorage.removeItem('authToken'); // Force remove token
      // window.location.href = '/login'; // Force redirect (can be disruptive)
    }
    return Promise.reject(error);
  }
);

// --- Exported API Functions ---

// Chat
export const askQuestion = async (question, token) => {
  const response = await api.post('/ask', { question }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data; // Expects { response: ..., sources: ..., metadata: ... }
};

export const getChatHistory = async (username, token) => {
   const response = await api.get(`/chat_history/${username}`, {
     headers: { Authorization: `Bearer ${token}` }
   });
   return response.data; // Expects { username: ..., history: [...] }
};

// Rename Conversation
export const renameConversation = async (conversationId, newTitle, token) => {
  // Note: The backend endpoint needs to be implemented. Assuming PUT /conversations/{id}
  const response = await api.put(`/conversations/${conversationId}`, { title: newTitle }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data; // Expects updated conversation or success message
};

// Delete Conversation
export const deleteConversation = async (conversationId, token) => {
  // Note: The backend endpoint needs to be implemented. Assuming DELETE /conversations/{id}
  const response = await api.delete(`/conversations/${conversationId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data; // Expects success message or confirmation
};

// Tools (Generic and Specific)
export const callTool = async (toolName, input, options = {}, token) => {
    // Add username to options automatically if available and needed by tool
    // This logic might be better placed in the component calling this,
    // but adding here for simplicity for now.
    // const { user } = useAuth(); // Cannot use hooks here
    // if (["study_plan_creator", "progress_tracker", "flashcard_generator"].includes(toolName) && user?.username) {
    //      options.username = user.username;
    // }

    const payload = { input, options: Object.keys(options).length > 0 ? options : undefined };
    // Chuyển đổi snake_case thành path parameter theo đúng định dạng backend mong đợi
    // Ví dụ: quiz_generator -> quiz, flashcard_generator -> flashcard, study_plan_creator -> study_plan
    let toolPath;
    
    // Ánh xạ từ ID tool trong UI sang endpoint API
    const toolMapping = {
        'quiz_generator': 'quiz',
        'flashcard_generator': 'flashcard',
        'study_plan_creator': 'study_plan',
        'progress_tracker': 'progress',
        'concept_explainer': 'concept',
        'summary_generator': 'summary',
        'mind_map_creator': 'mindmap'
    };
    
    toolPath = toolMapping[toolName] || toolName.split('_')[0];
    const endpoint = `/tools/${toolPath}`;
    console.log(`Calling ${endpoint} with payload:`, payload);
    try {
        const response = await api.post(endpoint, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data; // Expects { response: ..., metadata: ... }
    } catch (error) {
        console.error(`Error calling ${endpoint}:`, error);
        // Kiểm tra lỗi kết nối
        if (!error.response) {
            throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và đảm bảo máy chủ đang hoạt động.');
        }
        // Trả về lỗi từ API nếu có
        if (error.response && error.response.data) {
            throw error;
        }
        // Lỗi khác
        throw new Error('Đã xảy ra lỗi khi gọi API. Vui lòng thử lại sau.');
    }
};

// Hàm xử lý công cụ tổng quát cho các component
export const handleToolAction = async (toolId, input, setLoading, setError, setResult, options = {}) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Chuẩn bị input dựa trên loại công cụ
      let processedInput;
      
      // Chuyển đổi tất cả input thành chuỗi để phù hợp với API
      if (typeof input === 'object') {
        // Nếu input là object, chuyển đổi thành chuỗi chủ đề/câu hỏi
        if (input.topic) {
          processedInput = input.topic;
        } else if (input.subject) {
          processedInput = input.subject;
        } else if (input.concept) {
          processedInput = input.concept;
        } else if (input.question) {
          processedInput = input.question;
        } else {
          // Nếu không có các trường trên, sử dụng trường đầu tiên
          const firstKey = Object.keys(input)[0];
          processedInput = input[firstKey] || "";
        }
      } else {
        // Nếu input đã là chuỗi, giữ nguyên
        processedInput = input;
      }
      
      console.log(`Gửi yêu cầu đến API cho công cụ: ${toolId}, input=${processedInput}`);
      
      // Lấy token từ localStorage
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Bạn cần đăng nhập để sử dụng công cụ này');
      }
      
      // Lấy thông tin người dùng từ token JWT
      const parseJwt = (token) => {
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          return JSON.parse(jsonPayload);
        } catch (e) {
          console.error('Error parsing JWT:', e);
          return null;
        }
      };
      
      // Lấy username từ token
      const tokenData = parseJwt(token);
      const username = tokenData?.sub; // JWT thường lưu username trong trường 'sub'
      
      // Chuẩn bị options với username
      const toolOptions = {...options};
      
      // Luôn thêm username vào options nếu có, đặc biệt quan trọng cho các công cụ cần username
      if (username) {
        toolOptions.username = username;
        console.log(`Thêm username: ${username} vào options cho công cụ: ${toolId}`);
      } else {
        console.warn(`Không thể lấy username từ token cho công cụ ${toolId}`);
      }

      const response = await callTool(toolId, processedInput, toolOptions, token);
      
      // Debug: Hiển thị dữ liệu trả về từ API
      console.log('Dữ liệu API gốc:', response);
      
      // Xử lý kết quả từ API
      if (response) {
        // Trường hợp đặc biệt cho progress_tracker - để đảm bảo dữ liệu phù hợp được truyền đến component
        if (toolId === 'progress_tracker') {
          console.log('Nhận được dữ liệu Progress:', response);
          setResult(response);
          return response;
        }
        
        // Kiểm tra xem response có phải là đối tượng có trường response không
        if (response.response !== undefined) {
          console.log('Kết quả từ API response field:', response.response);
          
          // ĐẶC BIỆT CHO MINDMAP: nếu là mind_map_creator và response.response có trường markdown
          if (toolId === 'mind_map_creator' && typeof response.response === 'object' && response.response.markdown) {
            console.log('Nhận được dữ liệu MindMap với markdown:', response.response);
            setResult(response.response); // Giữ nguyên cấu trúc đối tượng
            return response.response;
          }
          
          // Trường hợp chung cho các công cụ khác
          setResult(response.response);
          return response.response;
        } else {
          // Trong trường hợp API không trả về trường response thông thường
          console.log('API trả về dữ liệu không có trường response, sử dụng toàn bộ phản hồi');
          setResult(response);
          return response;
        }
      } else {
        console.error('Kết quả API không đúng định dạng hoặc rỗng:', response);
        setError('Lỗi định dạng dữ liệu từ API hoặc không nhận được dữ liệu');
        return null;
      }
    } catch (err) {
      console.error('Lỗi khi sử dụng công cụ:', err);
      setError(err.message || 'Đã xảy ra lỗi không xác định');
      return null;
    } finally {
      setLoading(false);
    }
  }


// Quiz Submission
export const submitQuiz = async (submissionData, token) => {
  const response = await api.post('/tools/quiz/submit', submissionData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data; // Expects QuizResult structure
};

// Stats
export const getStats = async (username, token) => {
    const response = await api.get(`/stats/${username}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data; // Expects StatsResponse structure
};

// User Profile
export const getProfile = async (token) => {
    const response = await api.get('/me', {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data; // Expects UserBase structure
};

export const updateProfile = async (updateData, token) => {
     const response = await api.put('/me', updateData, {
         headers: { Authorization: `Bearer ${token}` }
     });
     return response.data; // Expects UserBase structure
};


// File Upload
export const uploadDocument = async (file, token, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}` // Assuming upload needs auth
        },
        onUploadProgress: onUploadProgress // Pass the progress callback
    });
    return response.data; // Expects UploadResponse structure
};


// Default export remains the axios instance for direct use if needed
export default api;
