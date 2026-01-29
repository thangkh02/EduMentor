import { useState, useEffect } from 'react';
import { 
  FiClock, FiLoader, FiBarChart2, FiCheckCircle, FiAlertTriangle, 
  FiActivity, FiBook, FiCalendar, FiPieChart, FiArrowUp, FiUser,
  FiAward
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

const ProgressTracker = ({ onSubmit, result, loading, error }) => {
  const [subjectInput, setSubjectInput] = useState('');
  const [progressInput, setProgressInput] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const { user, token } = useAuth();

  // Xử lý khi nhận được kết quả từ backend
  useEffect(() => {
    console.log('Progress tracker received result:', result);
    
    // Reset thông báo thành công và dữ liệu đã phân tích
    setSuccessMessage('');
    setParsedData(null);
    
    // Nếu không có kết quả, không cần xử lý gì
    if (!result) return;
    
    // Process the result based on its type
    try {
      if (typeof result === 'string') {
        // Check if it's a success message
        if (result.includes('Đã cập nhật tiến độ cho')) {
          setSuccessMessage(result);
        } else {
          // Try to parse as JSON
          try {
            const jsonData = JSON.parse(result);
            setParsedData(jsonData);
            
            // Check for success message in the parsed JSON
            if (jsonData.message && jsonData.message.includes('Đã cập nhật tiến độ cho')) {
              setSuccessMessage(jsonData.message);
            }
          } catch (e) {
            console.error("Failed to parse JSON string:", e);
            // Still display the result as a string
          }
        }
      } else if (typeof result === 'object') {
        // Handle direct object result
        if (result.response && typeof result.response === 'object') {
          // API wrapper format - object inside response property
          setParsedData(result.response);
          
          if (result.response.message && result.response.message.includes('Đã cập nhật tiến độ cho')) {
            setSuccessMessage(result.response.message);
          }
        } else if (result.response && typeof result.response === 'string') {
          // API wrapper format - string inside response property
          if (result.response.includes('Đã cập nhật tiến độ cho')) {
            setSuccessMessage(result.response);
          } else {
            // Try to parse the response string as JSON
            try {
              const jsonData = JSON.parse(result.response);
              setParsedData(jsonData);
              
              if (jsonData.message && jsonData.message.includes('Đã cập nhật tiến độ cho')) {
                setSuccessMessage(jsonData.message);
              }
            } catch (e) {
              console.error("Failed to parse response JSON string:", e);
            }
          }
        } else {
          // Direct object format
          setParsedData(result);
          
          if (result.message && result.message.includes('Đã cập nhật tiến độ cho')) {
            setSuccessMessage(result.message);
          }
        }
      }
      
      // Debug the final parsed data
      console.log('Parsed data:', parsedData);
    } catch (e) {
      console.error("Error processing progress tracker result:", e);
    }
  }, [result]);

  // Xử lý khi người dùng cập nhật tiến độ
  const handleUpdateProgress = (e) => {
    e.preventDefault();
    if (!user || !token) return;
    
    const subjectToUpdate = subjectInput.trim();
    const progressToUpdate = progressInput.trim();

    if (!subjectToUpdate || !progressToUpdate) return;
    
    const progressValue = parseInt(progressToUpdate, 10);
    if (isNaN(progressValue) || progressValue < 0 || progressValue > 100) return;
    
    const updateInputString = `${subjectToUpdate}: ${progressValue}`;
    onSubmit(updateInputString);
    
    // Sau khi cập nhật, tự động gửi yêu cầu hiển thị tất cả tiến độ
    if (successMessage) {
      setTimeout(() => {
        onSubmit("");  // Gửi yêu cầu trống để lấy tất cả tiến độ
      }, 1000);
    }
  };

  // Lấy màu dựa trên phần trăm tiến độ
  const getProgressColor = (percent) => {
    const progress = parseInt(percent, 10);
    if (isNaN(progress) || progress === 'N/A') return 'bg-gray-500';
    if (progress < 30) return 'bg-red-500';
    if (progress < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Lấy màu cho văn bản hiển thị tiến độ
  const getProgressTextColor = (percent) => {
    const progress = parseInt(percent, 10);
    if (isNaN(progress) || percent === 'N/A') return 'text-gray-400';
    if (progress < 30) return 'text-red-400';
    if (progress < 70) return 'text-yellow-400';
    return 'text-green-400';
  };

  // Format thời gian từ ISO string
  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return format(date, 'dd/MM/yyyy HH:mm');
    } catch (e) {
      console.error("Error formatting date:", e, isoString);
      return isoString;
    }
  };

  // Hiển thị danh sách môn học
  const renderSubjects = () => {
    if (!parsedData || !parsedData.subjects || !parsedData.subjects.length) {
      return (
        <div className="text-gray-400 text-center p-4 bg-gray-800/40 rounded-lg">
          Không có dữ liệu môn học nào.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {parsedData.subjects.map((subject, index) => (
          <div 
            key={`subject-${index}`} 
            className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-blue-500 transition-all shadow-md"
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full ${getProgressColor(subject.progress)} bg-opacity-20 flex items-center justify-center mr-3`}>
                  <FiBook className="text-white" size={16} />
                </div>
                <span className="font-medium text-white text-lg">{subject.name}</span>
              </div>
              <div className={`px-3 py-1.5 rounded-full border border-gray-700 ${subject.progress === 100 ? 'bg-green-900/30' : 'bg-gray-900/70'}`}>
                <span className={`font-bold ${getProgressTextColor(subject.progress)} text-sm`}>
                  {subject.progress || 0}%
                </span>
              </div>
            </div>
            
            {/* Thanh tiến độ */}
            <div className="w-full bg-gray-900/70 rounded-full h-2 mb-3 overflow-hidden">
              <div
                className={`${getProgressColor(subject.progress)} h-full rounded-full transition-all duration-500`}
                style={{ width: `${subject.progress || 0}%` }}
              >
                <div className="h-full w-full bg-opacity-40 bg-white animate-pulse"></div>
              </div>
            </div>
            
            {/* Thông tin chi tiết */}
            <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-400">
              {subject.updated_at && (
                <div className="flex items-center mr-3 bg-gray-900/30 px-2 py-1 rounded">
                  <FiClock className="mr-1.5 text-blue-400" size={14} />
                  <span>Cập nhật: {formatDate(subject.updated_at)}</span>
                </div>
              )}
              
              <div className="flex items-center bg-gray-900/30 px-2 py-1 rounded">
                <FiPieChart className="mr-1.5 text-yellow-400" size={14} />
                <span>{subject.doc_count || 0} tài liệu</span>
              </div>
              
              {subject.plan_created_at && (
                <div className="flex items-center bg-gray-900/30 px-2 py-1 rounded">
                  <FiCalendar className="mr-1.5 text-green-400" size={14} />
                  <span>Kế hoạch: {formatDate(subject.plan_created_at)}</span>
                </div>
              )}
              
              {subject.progress === 100 && (
                <div className="flex items-center bg-green-900/20 px-2 py-1 rounded border border-green-800">
                  <FiAward className="mr-1.5 text-green-400" size={14} />
                  <span className="text-green-300">Hoàn thành</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Hiển thị hoạt động gần đây
  const renderActivities = () => {
    if (!parsedData || !parsedData.activities || !parsedData.activities.length) {
      return null; // Không hiển thị phần hoạt động nếu không có dữ liệu
    }

    return (
      <div className="mt-6 bg-gray-800/30 p-4 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-gray-200 mb-3 flex items-center">
          <FiActivity className="mr-2 text-blue-400" />
          Hoạt động gần đây
        </h3>
        
        <div className="space-y-2">
          {parsedData.activities.map((activity, index) => (
            <div 
              key={`activity-${index}`} 
              className="flex items-start py-2 px-3 border-b border-gray-700 last:border-b-0 hover:bg-gray-800/40 rounded transition-colors"
            >
              <div className="bg-blue-900/30 h-6 w-6 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs text-blue-300 font-medium">{index + 1}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs">{formatDate(activity.timestamp)}: </span>
                <span className="text-gray-200 text-sm">{activity.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Hiển thị thông báo nếu có
  const renderMessage = () => {
    if (!parsedData || !parsedData.message) return null;
    
    return (
      <div className="bg-gray-800/70 border border-gray-600 rounded-lg p-3 mb-4">
        <p className="text-gray-300">{parsedData.message}</p>
      </div>
    );
  };

  // Kiểm tra xem có kết quả để hiển thị không
  const hasDisplayableResult = () => {
    if (!parsedData) return false;
    
    // Kiểm tra xem có dữ liệu có ý nghĩa hay không
    return (
      (parsedData.subjects && parsedData.subjects.length > 0) || 
      (parsedData.activities && parsedData.activities.length > 0) ||
      parsedData.message
    );
  };

  // For debugging - display raw data
  const renderDebugInfo = () => {
    if (!result) return null;
    
    return (
      <div className="mt-4 bg-gray-900 rounded-lg p-3 border border-yellow-700 overflow-x-auto">
        <h4 className="text-yellow-500 text-xs font-mono mb-2">Debug Raw Data:</h4>
        <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap">
          {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
        </pre>
      </div>
    );
  };

  // Khi component mount, tự động load tất cả tiến độ
  useEffect(() => {
    if (user && token && !loading && !result) {
      // Gửi yêu cầu trống để lấy tất cả tiến độ khi component khởi tạo
      onSubmit("");
    }
  }, [user, token]);

  return (
    <div className="h-full flex flex-col p-4 md:p-6">
      <div className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4 flex items-center text-gray-100">
          <FiBarChart2 className="mr-2 text-green-400" />
          Theo dõi & Cập nhật Tiến độ Học tập
        </h2>
        <p className="text-gray-300 mb-5 text-sm">
          Theo dõi tiến độ học tập của bạn qua thời gian và cập nhật mức hoàn thành cho từng môn học.
        </p>

        {/* Mẫu để cập nhật tiến độ */}
        <form onSubmit={handleUpdateProgress}>
          <label htmlFor="updateSubject" className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
            <FiArrowUp className="mr-1.5 text-yellow-400" />
            Cập nhật tiến độ môn học
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow">
              <input
                id="updateSubject"
                type="text"
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                placeholder="Tên môn học cần cập nhật"
                className="w-full bg-gray-700 text-white rounded-md pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent placeholder-gray-500 text-sm"
                disabled={loading || !token}
                required
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                <FiBook size={16} />
              </div>
            </div>
            <div className="relative w-full sm:w-40">
              <input
                type="number"
                value={progressInput}
                onChange={(e) => setProgressInput(e.target.value)}
                placeholder="% Hoàn thành"
                min="0"
                max="100"
                className="w-full bg-gray-700 text-white rounded-md pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent placeholder-gray-500 text-sm"
                disabled={loading || !token}
                required
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                %
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !token || !subjectInput.trim() || !progressInput.trim()}
              className={`bg-yellow-600 text-white rounded-md px-5 py-2.5 flex items-center justify-center transition duration-150 ease-in-out text-sm ${loading || !token || !subjectInput.trim() || !progressInput.trim() ? 'opacity-60 cursor-not-allowed' : 'hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 focus:ring-offset-gray-800'}`}
            >
              {loading ? <FiLoader className="animate-spin" /> : 'Cập nhật'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Cập nhật phần trăm hoàn thành cho một môn học cụ thể trong khoảng từ 0-100%.
          </p>
        </form>

        {!token && (
          <div className="mt-4 bg-gray-900/50 border border-gray-700 rounded-md p-4 text-center">
            <FiAlertTriangle className="text-yellow-400 mx-auto mb-2" size={20} />
            <p className="text-sm text-yellow-400">Vui lòng đăng nhập để sử dụng tính năng theo dõi tiến độ học tập.</p>
          </div>
        )}

        {/* Hiển thị lỗi hoặc thông báo thành công */}
        {error && !loading && (
          <div className="mt-6 text-red-400 bg-red-900/30 p-4 rounded-md flex items-center text-sm border border-red-700">
            <FiAlertTriangle className="mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {successMessage && !loading && !error && (
          <div className="mt-6 text-green-300 bg-green-900/30 p-4 rounded-md flex items-center text-sm border border-green-700">
            <FiCheckCircle className="mr-2 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        
        {/* Debug info */}
        {result && (
          renderDebugInfo()
        )}
      </div>

      {/* Khu vực hiển thị tiến độ đã lấy */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
            <FiLoader className="animate-spin h-10 w-10 mb-3" />
            <span>Đang tải dữ liệu tiến độ...</span>
          </div>
        )}
        
        {!loading && !error && hasDisplayableResult() && (
          <div className="bg-gray-800/40 rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-700 bg-gray-800/70">
              <h3 className="text-lg font-semibold text-gray-200 flex items-center">
                <FiBarChart2 className="mr-2 text-blue-400" />
                Thông tin tiến độ học tập
              </h3>
              <div className="flex items-center text-sm text-gray-400 mt-1">
                <FiUser className="mr-1" size={14} />
                <span>{user?.username || user?.name || 'Người dùng'}</span>
              </div>
            </div>
            
            <div className="p-5">
              {/* Hiển thị thông báo nếu có */}
              {renderMessage()}
              
              {/* Hiển thị danh sách môn học */}
              {renderSubjects()}
              
              {/* Hiển thị hoạt động gần đây */}
              {renderActivities()}
            </div>
          </div>
        )}
        
        {!loading && !error && !successMessage && !hasDisplayableResult() && (
           <div className="flex flex-col items-center justify-center h-full text-gray-500 py-10">
             <FiBarChart2 className="text-6xl opacity-30 mb-4" />
            <p className="text-lg opacity-70">Cập nhật tiến độ học tập của bạn</p>
            <p className="text-sm opacity-50 mt-2">Dữ liệu tiến độ sẽ hiển thị ở đây</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressTracker;
