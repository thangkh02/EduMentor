
import React, { useState, useEffect, useMemo } from 'react';
import {
    FiTrash2, FiFile, FiClock, FiDatabase, FiRefreshCw, FiSearch, FiFilter,
    FiUploadCloud, FiMoreVertical, FiDownload, FiCheckCircle, FiX, FiEye, FiFileText, FiImage
} from 'react-icons/fi';
import { format } from 'date-fns';
import { listFiles, deleteFile, getFileContent } from '../services/api';
import FileUploader from './FileUploader';
import { useAuth } from '../contexts/AuthContext';

const FileManager = () => {
    const { token } = useAuth();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [showUploader, setShowUploader] = useState(false);

    // Preview State
    const [previewFile, setPreviewFile] = useState(null); // { url, type, name, content (for text) }
    const [previewLoading, setPreviewLoading] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    // Fetch files
    useEffect(() => {
        const fetchFiles = async () => {
            if (!token) return;
            setLoading(true);
            try {
                const data = await listFiles(token);
                if (data.success) {
                    setFiles(data.files);
                } else {
                    setError("Không thể tải danh sách tài liệu.");
                }
            } catch (err) {
                console.error("Error loading files:", err);
                setError("Lỗi khi kết nối đến máy chủ.");
            } finally {
                setLoading(false);
            }
        };

        fetchFiles();
    }, [token, refreshKey]);

    const handleDelete = async (filename, id) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa file "${filename}"?`)) return;
        try {
            const identifier = id || filename;
            await deleteFile(identifier, token);
            setRefreshKey(old => old + 1);
        } catch (err) {
            console.error("Error deleting file:", err);
            alert("Lỗi khi xóa file: " + (err.message || "Không xác định"));
        }
    };

    const handleUploadSuccess = () => {
        setRefreshKey(old => old + 1);
        setShowUploader(false);
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Handle File Preview
    const handlePreview = async (file) => {
        setPreviewLoading(true);
        setShowPreviewModal(true);
        setPreviewFile({ name: file.name, type: 'loading' });

        try {
            const response = await getFileContent(file.id || file.filename, token);
            const blob = response.data;
            const contentType = response.headers['content-type'];
            const url = URL.createObjectURL(blob);

            let type = 'unknown';
            let content = null;

            if (contentType.includes('pdf')) {
                type = 'pdf';
            } else if (contentType.includes('image')) {
                type = 'image';
            } else if (contentType.includes('text') || file.name.endsWith('.txt')) {
                type = 'text';
                content = await blob.text();
            } else {
                type = 'other';
            }

            setPreviewFile({
                url,
                type,
                name: file.name,
                content,
                originaltype: contentType
            });

        } catch (err) {
            console.error("Error fetching file content:", err);
            setPreviewFile({ name: file.name, type: 'error', error: "Không thể tải nội dung file." });
        } finally {
            setPreviewLoading(false);
        }
    };

    const closePreview = () => {
        setShowPreviewModal(false);
        if (previewFile?.url) {
            URL.revokeObjectURL(previewFile.url);
        }
        setPreviewFile(null);
    };

    // Download helper from preview
    const downloadFromPreview = () => {
        if (!previewFile?.url) return;
        const a = document.createElement('a');
        a.href = previewFile.url;
        a.download = previewFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };


    const filteredFiles = useMemo(() => {
        return files.filter(file =>
            file.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [files, searchQuery]);


    return (
        <div className="h-full flex flex-col space-y-4 animate-fadeIn relative">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-800/60 backdrop-blur-md p-4 rounded-xl border border-gray-700/50 shadow-lg">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><FiDatabase /></span>
                        Thư viện tài liệu
                    </h2>
                    <p className="text-gray-400 text-sm mt-1 ml-11">Quản lý và xem trước tài liệu của bạn</p>
                </div>

                <div className="flex items-center gap-3 mt-4 md:mt-0 w-full md:w-auto">
                    <button
                        onClick={() => setShowUploader(!showUploader)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-lg hover:shadow-blue-500/30"
                    >
                        <FiUploadCloud />
                        <span>Tải lên</span>
                    </button>
                    <button
                        onClick={() => setRefreshKey(k => k + 1)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        title="Làm mới"
                    >
                        <FiRefreshCw className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Upload Area (Collapsible) */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showUploader ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="bg-gray-800 rounded-xl p-1 border border-blue-500/30 shadow-xl relative">
                    <button
                        onClick={() => setShowUploader(false)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-white p-1"
                    >
                        &times;
                    </button>
                    <FileUploader onUploadSuccess={handleUploadSuccess} />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 flex flex-col overflow-hidden shadow-inner">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-700/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-72 group">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm tài liệu..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-900/50 border border-gray-600 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                            <FiRefreshCw className="animate-spin text-4xl text-blue-500/50" />
                            <p>Đang đồng bộ dữ liệu...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-400 space-y-2">
                            <FiDatabase className="text-4xl opacity-50" />
                            <p>{error}</p>
                        </div>
                    ) : filteredFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 opacity-70">
                            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4 border border-gray-700">
                                <FiUploadCloud className="text-4xl text-gray-600" />
                            </div>
                            <p className="text-lg font-medium">Chưa có tài liệu nào</p>
                        </div>
                    ) : (
                        <div className="w-full">
                            {/* Table Header */}
                            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700/50">
                                <div className="col-span-6 pl-2">Tên tài liệu</div>
                                <div className="col-span-2">Kích thước</div>
                                <div className="col-span-2">Ngày tạo</div>
                                <div className="col-span-2 text-right pr-2">Thao tác</div>
                            </div>

                            {/* Table Rows */}
                            <div className="space-y-1 mt-1">
                                {filteredFiles.map((file) => (
                                    <div
                                        key={file.id || file.name}
                                        className="group flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 p-3 rounded-lg hover:bg-gray-700/40 transition-all duration-200 border border-transparent hover:border-gray-600/30 items-center cursor-pointer"
                                        onClick={() => handlePreview(file)}
                                    >
                                        <div className="col-span-6 flex items-center w-full min-w-0">
                                            <div className="p-2 bg-gray-800 rounded-lg text-blue-400 mr-3 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                                                {file.name.endsWith('.pdf') ? <FiFileText /> : file.name.match(/\.(jpg|jpeg|png)$/i) ? <FiImage /> : <FiFile />}
                                            </div>
                                            <div className="truncate font-medium text-gray-200 group-hover:text-white transition-colors" title={file.name}>
                                                {file.name}
                                            </div>
                                        </div>

                                        <div className="col-span-2 text-sm text-gray-400 w-full pl-12 md:pl-0">
                                            {formatSize(file.size)}
                                        </div>

                                        <div className="col-span-2 text-sm text-gray-400 w-full pl-12 md:pl-0 flex items-center">
                                            <FiClock className="mr-2 md:hidden" />
                                            {file.created_at ? format(new Date(file.created_at), 'dd/MM/yyyy') : 'N/A'}
                                        </div>

                                        <div className="col-span-2 flex justify-end w-full md:w-auto gap-2" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => handlePreview(file)} // Explicit click
                                                className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                                                title="Xem trước"
                                            >
                                                <FiEye size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(file.name, file.id)}
                                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                                title="Xóa tài liệu"
                                            >
                                                <FiTrash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Preview Modal */}
            {showPreviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-gray-900 w-full max-w-5xl h-[85vh] rounded-2xl flex flex-col shadow-2xl border border-gray-700 overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800">
                            <h3 className="text-lg font-semibold text-white truncate flex items-center gap-2 max-w-[80%]">
                                <FiEye className="text-blue-400" />
                                {previewFile?.name || "Đang tải..."}
                            </h3>
                            <div className="flex items-center gap-2">
                                {(previewFile?.type !== 'loading' && previewFile?.type !== 'error') && (
                                    <button
                                        onClick={downloadFromPreview}
                                        className="p-2 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium"
                                        title="Tải xuống"
                                    >
                                        <FiDownload /> Tải xuống
                                    </button>
                                )}
                                <button
                                    onClick={closePreview}
                                    className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-gray-400 transition-colors"
                                >
                                    <FiX size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-hidden bg-gray-950 relative flex items-center justify-center">
                            {previewLoading ? (
                                <div className="text-center">
                                    <FiRefreshCw className="animate-spin text-4xl text-blue-500 mb-4 mx-auto" />
                                    <p className="text-gray-400">Đang tải nội dung...</p>
                                </div>
                            ) : previewFile?.type === 'error' ? (
                                <div className="text-center p-8">
                                    <FiDatabase className="text-5xl text-red-500 mb-4 mx-auto opacity-50" />
                                    <p className="text-red-400 text-lg mb-2">Không thể xem tài liệu này</p>
                                    <p className="text-gray-500">{previewFile.error}</p>
                                </div>
                            ) : previewFile?.type === 'pdf' ? (
                                <iframe
                                    src={previewFile.url}
                                    className="w-full h-full border-0"
                                    title="PDF Preview"
                                />
                            ) : previewFile?.type === 'image' ? (
                                <img
                                    src={previewFile.url}
                                    alt="Preview"
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : previewFile?.type === 'text' ? (
                                <div className="w-full h-full overflow-auto p-6 bg-white text-black font-mono text-sm whitespace-pre-wrap">
                                    {previewFile.content}
                                </div>
                            ) : (
                                <div className="text-center p-8 max-w-md">
                                    <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <FiFile className="text-5xl text-gray-500" />
                                    </div>
                                    <h4 className="text-xl font-bold text-white mb-2">Không hỗ trợ xem trước</h4>
                                    <p className="text-gray-400 mb-6">
                                        Định dạng file <strong>.{previewFile?.name?.split('.').pop()}</strong> chưa hỗ trợ xem trực tiếp trên trình duyệt.
                                    </p>
                                    <button
                                        onClick={downloadFromPreview}
                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-lg hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2 mx-auto"
                                    >
                                        <FiDownload /> Tải xuống để xem
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileManager;
