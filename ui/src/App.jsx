import { useState, useCallback } from "react";
import { Routes, Route, Navigate, Link, Outlet } from "react-router-dom"; // Import Outlet
import Sidebar from "./components/Sidebar";
import ChatInterface from "./components/ChatInterface";
import Tools from "./components/Tools";
import NavBar from "./components/Navbar";
import FileUploader from "./components/FileUploader";
import Login from "./components/Login"; // Import Login
import Register from "./components/Register"; // Import Register
import ProtectedRoute from "./components/ProtectedRoute"; // Import ProtectedRoute
import UserStats from "./components/UserStats"; // Import UserStats component
import { TypeAnimation } from "react-type-animation";
import edubotLogo from "./assets/duu.png";
import { useAuth } from "./contexts/AuthContext"; // Import useAuth to check auth status
import './styles/markdown.css';
// --- HomePage Component (Moved inside App or keep separate, ensure imports are correct) ---
const HomePage = () => {
  const [showUploader, setShowUploader] = useState(false);
  const { isAuthenticated } = useAuth(); // Get auth status

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="mb-8">
        <img src={edubotLogo} alt="AI Assistant" className="w-40 h-40 mx-auto mb-4 animate-pulse" style={{animationDuration: '3s'}} />
        <TypeAnimation
          sequence={[
            'Chào mừng đến với EduMentor AI', 1000,
            'Trợ lý học tập thông minh của bạn', 1000,
            'Hãy hỏi tôi bất cứ điều gì về việc học của bạn', 1000
          ]}
          wrapper="h1"
          speed={50}
          className="text-4xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-blue-500 to-purple-600 bg-clip-text text-transparent"
          repeat={Infinity}
        />
      </div>
      <p className="text-xl text-gray-300 max-w-2xl mb-8 animate-fadeIn" style={{animationDelay: '0.5s'}}>
      Hãy để EduMentor AI đồng hành cùng bạn
      trên hành trình chinh phục tri thức suốt đời. Let's go!!
      </p>
      {/* Conditionally render cards based on auth status or keep them always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl animate-fadeIn" style={{animationDelay: '0.8s'}}>
        <FeatureCard
          title="Smart Chat"
          description="Ask questions about your learning materials and get intelligent answers"
          icon="chat"
          linkTo="/chat"
        />
        <FeatureCard
          title="Learning Tools"
          description="Create quizzes, flashcards, mind maps and more"
          icon="tools"
          linkTo="/tools"
        />
         {/* Only show upload if authenticated */}
         {isAuthenticated && (
            <FeatureCard
              title="Upload Documents"
              description="Add your learning materials to enhance your experience"
              icon="upload"
              onClick={() => setShowUploader(true)}
            />
         )}
         {!isAuthenticated && (
             <FeatureCard
              title="Login / Register"
              description="Access all features by logging in or creating an account"
              icon="auth" // Add an appropriate icon if needed
              linkTo="/login"
            />
         )}
      </div>

      {/* Upload Modal - Only shown if button is clicked (which requires auth) */}
      {showUploader && isAuthenticated && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="sticky top-0 bg-gray-900 flex justify-between items-center p-4 border-b border-gray-700 z-10">
              <h2 className="text-xl font-bold">Upload Learning Materials</h2>
              <button
                onClick={() => setShowUploader(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close uploader"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <FileUploader />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Layout for Authenticated Users ---
const MainLayout = () => {
  // Thêm state để quản lý trò chuyện được chọn
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [quickQuestion, setQuickQuestion] = useState("");

  // Hàm xử lý khi người dùng chọn một cuộc trò chuyện từ sidebar
  const handleSelectConversation = useCallback((conversation) => {
    setSelectedConversation(conversation);
  }, []);

  // Hàm xử lý khi người dùng chọn một câu hỏi nhanh từ sidebar
  const handleQuickQuestion = useCallback((question) => {
    setQuickQuestion(question);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <NavBar />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:block w-64 flex-shrink-0 bg-gray-900">
          <Sidebar 
            handleQuickQuestion={handleQuickQuestion} 
            onSelectConversation={handleSelectConversation} 
          />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto"> {/* Allow content to scroll */}
            <Outlet context={{ 
              selectedConversation, 
              quickQuestion,
              resetQuickQuestion: () => setQuickQuestion("") 
            }} /> {/* Nested routes render here with context */}
          </main>
          <footer className="bg-gray-800 bg-opacity-50 text-center text-gray-400 text-xs py-1 border-t border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-center">
              <img src={edubotLogo} alt="EduMentor" className="w-3 h-3 mr-1.5" />
              <span>EduMentor AI © 2025</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};


// --- App Component (Handles Routing) ---
function App() {
  // Keep state here if needed by multiple components within MainLayout
  const [commonQuestions, setCommonQuestions] = useState([
    "Làm thế nào để tạo bài kiểm tra?",
    "Cách tạo flashcard hiệu quả?",
    "Giải thích khái niệm Machine Learning",
    "Tóm tắt nội dung về Neural Networks",
    "Tạo sơ đồ tư duy về Data Science",
    "Lập kế hoạch học tập cho môn Toán",
  ]);

  return (
    // BrowserRouter is now in main.jsx
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        {/* Routes rendered inside MainLayout's Outlet */}
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<ChatInterface commonQuestions={commonQuestions} />} />
        <Route path="/stats" element={<UserStats />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/tools/:toolId" element={<Tools />} />
        {/* Add other protected routes here (e.g., /profile) */}
      </Route>

      {/* Fallback for unknown routes (optional: redirect to login or home) */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// --- FeatureCard Component (Sửa đổi để dùng Link, add 'auth' icon case) ---
const FeatureCard = ({ title, description, icon, linkTo, onClick }) => {
  const getIcon = () => {
    switch (icon) {
      case "chat":
        return (
          <svg className="w-12 h-12 text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
          </svg>
        );
      case "tools":
        return (
          <svg className="w-12 h-12 text-purple-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"></path>
          </svg>
        );
      case "upload":
        return (
          <svg className="w-12 h-12 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
        );
       case "auth": // Icon for Login/Register card
         return (
            <svg className="w-12 h-12 text-yellow-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
         );
      default: return null;
    }
  };

  const cardContent = (
    <div className="flex flex-col items-center">
      {getIcon()}
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-400 text-center text-sm">{description}</p>
    </div>
  );

  const commonClasses = "bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 block transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900";

  if (linkTo) {
    return (
      <Link to={linkTo} className={commonClasses}>
        {cardContent}
      </Link>
    );
  }

  return (
    <div
      className={`${commonClasses} cursor-pointer`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      {cardContent}
    </div>
  );
};

export default App;
