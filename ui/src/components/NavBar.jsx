import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiMessageSquare, FiBarChart2, FiTool, FiHelpCircle, FiUser, FiLogOut, FiLogIn } from "react-icons/fi"; // Add User/Logout icons
import edubotLogo from "../assets/duu.png";
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

const NavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth(); // Get auth state and logout function

  // Filter nav items based on auth state if needed (e.g., hide Stats for guests)
  const navItems = [
    { path: '/', label: 'Trang chủ', icon: <FiHome /> },
    { path: '/chat', label: 'Trò chuyện', icon: <FiMessageSquare />, requiresAuth: true }, // Example: require auth
    { path: '/stats', label: 'Thống kê', icon: <FiBarChart2 />, requiresAuth: true },
    { path: '/tools', label: 'Công cụ', icon: <FiTool />, requiresAuth: true },
    // { path: '/faq', label: 'FAQs', icon: <FiHelpCircle /> }, // Keep or remove FAQ
  ].filter(item => !item.requiresAuth || isAuthenticated); // Filter based on auth

  const handleLogout = () => {
    logout();
    navigate('/login'); // Redirect to login after logout
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 w-full shadow-md sticky top-0 z-50"> {/* Make navbar sticky */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and brand name */}
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center group"> {/* Add group for hover effect */}
              <img src={edubotLogo} alt="EduMentor" className="w-8 h-8 md:w-9 md:h-9 mr-2 transition-transform duration-300 group-hover:rotate-[15deg]" /> {/* Subtle hover effect */}
              <span className="font-extrabold text-lg md:text-xl bg-gradient-to-r from-blue-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                EduMentor AI
              </span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center">
            <div className="flex space-x-1 lg:space-x-2"> {/* Adjust spacing */}
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center transition-colors duration-200 ${
                    // Check if the current path starts with the item path for nested routes like /tools/*
                    location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                  aria-current={location.pathname === item.path ? "page" : undefined}
                >
                  <span className="mr-1.5 text-base">{item.icon}</span> {/* Adjust icon size/margin */}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* User actions */}
          <div className="hidden md:flex items-center space-x-3">
            {isAuthenticated && user ? (
              <>
                {/* Profile Link (Optional) */}
                 <Link
                   to="/profile" // Assuming you'll add a /profile route
                   className="flex items-center text-sm text-gray-300 hover:text-white transition-colors"
                   title={user.full_name || user.username}
                 >
                   <FiUser className="mr-1" />
                   <span className="truncate max-w-[100px]">{user.full_name || user.username}</span>
                 </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-red-600 rounded-md text-sm font-medium text-white hover:bg-red-700 transition-colors duration-200 flex items-center"
                  title="Logout"
                >
                  <FiLogOut className="mr-1.5" />
                  <span>Đăng xuất</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-3 py-1.5 bg-blue-600 rounded-md text-sm font-medium text-white hover:bg-blue-700 transition-colors duration-200 flex items-center"
              >
                 <FiLogIn className="mr-1.5" />
                 <span>Đăng nhập</span>
              </Link>
            )}
          </div>

           {/* Mobile menu button (Functionality not implemented here) */}
           <div className="md:hidden flex items-center">
             {/* TODO: Implement mobile menu toggle */}
             <button className="text-gray-300 hover:text-white p-2 focus:outline-none">
               <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
             </button>
           </div>

        </div>
      </div>
       {/* TODO: Implement Mobile Menu Dropdown */}
       {/* <div className="md:hidden"> ... mobile menu items ... </div> */}
    </div>
  );
};

export default NavBar;
