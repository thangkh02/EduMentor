import React, { useState, useEffect } from 'react';
import { FiUser, FiMail, FiLock, FiSave, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { currentUser, refreshUserInfo } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Khởi tạo dữ liệu form từ thông tin người dùng
  useEffect(() => {
    if (currentUser) {
      setFormData({
        full_name: currentUser.full_name || '',
        email: currentUser.email || '',
        password: '',
        confirmPassword: ''
      });
    }
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const validate = () => {
    // Kiểm tra xem có thay đổi mật khẩu không
    if (formData.password || formData.confirmPassword) {
      if (formData.password !== formData.confirmPassword) {
        setError('Mật khẩu xác nhận không khớp');
        return false;
      }
      
      if (formData.password.length < 6) {
        setError('Mật khẩu phải có ít nhất 6 ký tự');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};
    if (formData.full_name !== currentUser.full_name) {
      updateData.full_name = formData.full_name;
    }
    if (formData.email !== currentUser.email) {
      updateData.email = formData.email;
    }
    if (formData.password) {
      updateData.password = formData.password;
    }

    // Không gửi request nếu không có thay đổi
    if (Object.keys(updateData).length === 0) {
      setSuccess('Không có thông tin nào được thay đổi');
      setLoading(false);
      return;
    }

    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/me`, 
        updateData
      );
      
      setSuccess('Cập nhật thông tin thành công');
      
      // Cập nhật thông tin người dùng trong AuthContext
      await refreshUserInfo();
      
      // Reset form mật khẩu
      setFormData({
        ...formData,
        password: '',
        confirmPassword: ''
      });
      
    } catch (err) {
      console.error('Error updating profile:', err);
      if (err.response && err.response.data) {
        setError(err.response.data.detail || 'Lỗi cập nhật thông tin. Vui lòng thử lại.');
      } else {
        setError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex justify-center items-center p-6">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        <span className="ml-3">Đang tải...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 border-b border-gray-700 pb-4">Hồ sơ cá nhân</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded flex items-center">
          <FiAlertTriangle className="text-red-500 mr-2" />
          <span className="text-red-400">{error}</span>
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded flex items-center">
          <FiCheckCircle className="text-green-500 mr-2" />
          <span className="text-green-400">{success}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="username">
              Tên đăng nhập
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FiUser className="text-gray-500" />
              </div>
              <input
                type="text"
                id="username"
                name="username"
                value={currentUser.username}
                disabled
                className="w-full pl-10 py-2 px-3 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-not-allowed"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Tên đăng nhập không thể thay đổi</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="full_name">
              Họ và tên
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FiUser className="text-gray-500" />
              </div>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="w-full pl-10 py-2 px-3 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập họ tên đầy đủ"
              />
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" htmlFor="email">
            Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <FiMail className="text-gray-500" />
            </div>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full pl-10 py-2 px-3 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập địa chỉ email"
            />
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mt-6 mb-4 border-b border-gray-700 pb-2">Đổi mật khẩu</h3>
        <p className="text-gray-400 mb-4">Để trống nếu không muốn thay đổi mật khẩu</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="password">
              Mật khẩu mới
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FiLock className="text-gray-500" />
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-10 py-2 px-3 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập mật khẩu mới"
                minLength={6}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="confirmPassword">
              Xác nhận mật khẩu mới
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FiLock className="text-gray-500" />
              </div>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full pl-10 py-2 px-3 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập lại mật khẩu mới"
                minLength={6}
              />
            </div>
          </div>
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline transition"
        >
          {loading ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
              Đang xử lý...
            </>
          ) : (
            <>
              <FiSave className="mr-2" />
              Lưu thay đổi
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default Profile;