import React, { useState, useEffect } from 'react';
import { FiBarChart2, FiBook, FiClock, FiActivity, FiFileText, FiChevronRight, FiChevronDown, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';

const UserStats = () => {
  const [stats, setStats] = useState(null);
  const [subjectStats, setSubjectStats] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [activities, setActivities] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [expandedSubjects, setExpandedSubjects] = useState({});

  // Get token from localStorage
  const token = localStorage.getItem('authToken');

  const toggleSubjectExpansion = (subject) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subject]: !prev[subject]
    }));

    if (!expandedSubjects[subject] && !subjectStats?.[subject]) {
      fetchSubjectStats(subject);
    }
  };

  // Fetch overall user stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        // Parse JWT to get username
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

        const tokenData = parseJwt(token);
        const username = tokenData?.sub;

        if (!username) {
          throw new Error('Không thể xác định người dùng. Vui lòng đăng nhập lại.');
        }

        // Fetch main stats
        const response = await api.get(`/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          setStats(response.data.data);
        } else {
          setError(response.data.message || 'Không thể tải thống kê');
        }

        // Fetch activities
        const activitiesResponse = await api.get(`/stats/activities`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (activitiesResponse.data.success) {
          setActivities(activitiesResponse.data.data.activities);
        }

        // Fetch documents
        const documentsResponse = await api.get(`/stats/documents`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (documentsResponse.data.success) {
          setDocuments(documentsResponse.data.data.documents);
        }
      } catch (error) {
        console.error("Lỗi khi tải thống kê:", error);
        setError(error.message || 'Đã xảy ra lỗi khi tải thống kê người dùng');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchStats();
    } else {
      setError('Bạn cần đăng nhập để xem thống kê');
      setLoading(false);
    }
  }, [token]);

  // Fetch detailed stats for a specific subject
  const fetchSubjectStats = async (subject) => {
    try {
      const response = await api.get(`/stats/subject/${subject}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSubjectStats(prev => ({
          ...prev,
          [subject]: response.data.data.details
        }));
      }
      
      else {
        console.error(`Lỗi khi tải thống kê môn ${subject}:`, response.data.message);
      }
    } catch (error) {
      console.error(`Lỗi khi tải thống kê môn ${subject}:`, error);
    }
  };
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4">Thống kê học tập</h2>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4">Thống kê học tập</h2>
        <div className="bg-red-900 bg-opacity-30 border border-red-500 rounded-lg p-4 text-red-200">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Chưa cập nhật';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 w-full">
      <h2 className="text-xl font-bold mb-6 flex items-center">
        <FiBarChart2 className="mr-2 text-blue-400" /> 
        Thống kê học tập
      </h2>

      {/* Thông tin tổng quan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-700 rounded-lg p-4 flex items-center">
          <div className="rounded-full bg-blue-900 bg-opacity-50 p-3 mr-4">
            <FiBook className="text-blue-400 text-xl" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Môn học</p>
            <p className="text-2xl font-bold">{stats?.subjects_count || 0}</p>
          </div>
        </div>
        
        <div className="bg-gray-700 rounded-lg p-4 flex items-center">
          <div className="rounded-full bg-green-900 bg-opacity-50 p-3 mr-4">
            <FiFileText className="text-green-400 text-xl" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Tài liệu</p>
            <p className="text-2xl font-bold">{stats?.total_documents || 0}</p>
          </div>
        </div>
        
        <div className="bg-gray-700 rounded-lg p-4 flex items-center">
          <div className="rounded-full bg-purple-900 bg-opacity-50 p-3 mr-4">
            <FiActivity className="text-purple-400 text-xl" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Hoạt động gần đây</p>
            <p className="text-2xl font-bold">{activities?.length || 0}</p>
          </div>
        </div>
      </div>

      {/* Các môn học */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <FiBook className="mr-2 text-blue-400" /> 
          Các môn học
        </h3>
        
        {stats?.subjects?.length > 0 ? (
          <div className="space-y-4">
            {stats.subjects.map((subject) => (
              <div key={subject.name} className="bg-gray-700 rounded-lg overflow-hidden">
                {/* Subject Header */}
                <div 
                  className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-600"
                  onClick={() => toggleSubjectExpansion(subject.name)}
                >
                  <div className="flex items-center">
                    <div className="mr-3 text-xl">
                      {expandedSubjects[subject.name] ? <FiChevronDown /> : <FiChevronRight />}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{subject.name}</h4>
                      <div className="flex items-center mt-1">
                        <div className="flex items-center mr-4">
                          <FiFileText className="text-gray-400 mr-1" />
                          <span className="text-sm text-gray-300">{subject.document_count} tài liệu</span>
                        </div>
                        {subject.has_plan && (
                          <span className="bg-blue-900 bg-opacity-50 text-blue-200 text-xs px-2 py-1 rounded">
                            Có kế hoạch học tập
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-40 bg-gray-600 rounded-full h-2 mr-3">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${subject.progress || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-blue-300">{subject.progress || 0}%</span>
                  </div>
                </div>
                
                {/* Subject Details (expandable) */}
                {expandedSubjects[subject.name] && (
                  <div className="p-4 bg-gray-800 border-t border-gray-600">
                    {!subjectStats?.[subject.name] ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Progress info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-gray-700 p-3 rounded-lg">
                            <p className="text-gray-400 text-sm">Cập nhật tiến độ gần nhất</p>
                            <p>{formatDate(subjectStats[subject.name]?.progress_updated_at)}</p>
                          </div>
                          
                          <div className="bg-gray-700 p-3 rounded-lg">
                            <p className="text-gray-400 text-sm">Kế hoạch học tập tạo lúc</p>
                            <p>{formatDate(subjectStats[subject.name]?.plan_created_at)}</p>
                          </div>
                        </div>
                        
                        {/* Documents list */}
                        {subjectStats[subject.name]?.documents?.length > 0 && (
                          <div>
                            <h5 className="font-semibold mb-2">Tài liệu</h5>
                            <div className="bg-gray-700 rounded-lg overflow-hidden">
                              <div className="overflow-x-auto">
                                <table className="min-w-full">
                                  <thead>
                                    <tr className="bg-gray-800">
                                      <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase">Tên tài liệu</th>
                                      <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase">Tải lên</th>
                                      <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase">Xem gần đây</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {subjectStats[subject.name].documents.map((doc, idx) => (
                                      <tr key={idx} className="border-t border-gray-600">
                                        <td className="px-4 py-2">
                                          <div className="flex items-center">
                                            <FiFileText className="mr-2 text-blue-400" />
                                            {doc.name || doc.filename || 'Tài liệu không tên'}
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-300">{formatDate(doc.upload_date)}</td>
                                        <td className="px-4 py-2 text-sm text-gray-300">{formatDate(doc.last_accessed)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Study plan if available */}
                        {subjectStats[subject.name]?.plan && (
                          <div>
                            <h5 className="font-semibold mb-2">Kế hoạch học tập</h5>
                            <div className="bg-gray-700 p-3 rounded-lg">
                              <div className="whitespace-pre-wrap markdown-content text-gray-300">
                                <ReactMarkdown>{subjectStats[subject.name].plan}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-700 rounded-lg p-4 text-center text-gray-300">
            Chưa có môn học nào được thêm vào hệ thống.
          </div>
        )}
      </div>

      {/* Hoạt động gần đây */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <FiClock className="mr-2 text-purple-400" /> 
          Hoạt động gần đây
        </h3>
        
        {activities?.length > 0 ? (
          <div className="bg-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase">Hoạt động</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase">Môn học</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity, idx) => (
                    <tr key={idx} className="border-t border-gray-600">
                      <td className="px-4 py-2">
                        <div className="flex items-center">
                          <div className="mr-2">
                            {activity.activity_type === 'complete_lesson' && <FiCheckCircle className="text-green-400" />}
                            {activity.activity_type === 'upload_document' && <FiFileText className="text-blue-400" />}
                            {activity.activity_type === 'create_plan' && <FiBook className="text-purple-400" />}
                            {!['complete_lesson', 'upload_document', 'create_plan'].includes(activity.activity_type) && 
                              <FiActivity className="text-gray-400" />}
                          </div>
                          {activity.description}
                        </div>
                      </td>
                      <td className="px-4 py-2">{activity.subject || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-gray-300">{formatDate(activity.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-gray-700 rounded-lg p-4 text-center text-gray-300">
            Chưa có hoạt động nào được ghi nhận.
          </div>
        )}
      </div>
  
      {/* Tài liệu */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <FiFileText className="mr-2 text-green-400" /> 
          Tất cả tài liệu
        </h3>
        
        {documents?.length > 0 ? (
          <div className="bg-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase">Tên tài liệu</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase">Môn học</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase">Tải lên</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase">Xem gần đây</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc, idx) => (
                    <tr key={idx} className="border-t border-gray-600">
                      <td className="px-4 py-2">
                        <div className="flex items-center">
                          <FiFileText className="mr-2 text-blue-400" />
                          {doc.name || doc.filename || 'Tài liệu không tên'}
                        </div>
                      </td>
                      <td className="px-4 py-2">{doc.subject || 'Không có môn'}</td>
                      <td className="px-4 py-2 text-sm text-gray-300">{formatDate(doc.upload_date)}</td>
                      <td className="px-4 py-2 text-sm text-gray-300">{formatDate(doc.last_accessed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-gray-700 rounded-lg p-4 text-center text-gray-300">
            Chưa có tài liệu nào được tải lên.
          </div>
        )}
      </div>
    </div>
  );
};
export default UserStats;