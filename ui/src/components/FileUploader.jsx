import { useState, useRef } from "react";
import { FiUpload, FiFile, FiCheck, FiAlertTriangle, FiLoader } from "react-icons/fi";
import { uploadDocument } from '../services';

const FileUploader = () => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Chấp nhận các định dạng file được hỗ trợ
    const allowedTypes = [
      "application/pdf", // PDF
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
      "application/msword", // DOC
      "text/plain", // TXT
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // PPTX
      "application/vnd.ms-powerpoint" // PPT
    ];
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => allowedTypes.includes(file.type) || 
             // Kiểm tra phần mở rộng cho trường hợp MIME type không khớp
             ['.pdf', '.docx', '.doc', '.txt', '.pptx', '.ppt'].some(ext => 
               file.name.toLowerCase().endsWith(ext)
             )
    );
    
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setUploadStatus(null);
    
    try {
      const results = [];
      
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        
        const response = await fetch("http://localhost:5000/upload", {
          method: "POST",
          body: formData,
        });
        
        const result = await response.json();
        results.push({ file: file.name, success: response.ok, result });
      }
      
      const allSuccessful = results.every(r => r.success);
      
      setUploadStatus({
        success: allSuccessful,
        message: allSuccessful 
          ? "All files uploaded successfully!" 
          : "Some files failed to upload.",
        details: results
      });
      
      if (allSuccessful) {
        setFiles([]);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus({
        success: false,
        message: "Error uploading files: " + error.message,
        details: []
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Upload Learning Materials</h2>
      
      {/* Drag and drop area */}
      <div 
        className="border-2 border-dashed border-gray-600 rounded-lg p-8 mb-6 text-center hover:border-blue-500 transition-all duration-200 hover:bg-gray-700/30 cursor-pointer"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          accept=".pdf,.docx,.doc,.txt,.pptx,.ppt" 
          multiple 
          onChange={handleFileChange} 
        />
        
        <FiUpload className="mx-auto text-4xl text-blue-400 mb-4" />
        <p className="text-gray-300 mb-2">Kéo thả hoặc chọn tài liệu học tập</p>
        <div className="flex flex-wrap justify-center gap-2 mb-3">
          <span className="bg-blue-900/50 text-blue-300 text-xs px-2 py-1 rounded-full">PDF</span>
          <span className="bg-blue-900/50 text-blue-300 text-xs px-2 py-1 rounded-full">DOCX</span>
          <span className="bg-blue-900/50 text-blue-300 text-xs px-2 py-1 rounded-full">DOC</span>
          <span className="bg-blue-900/50 text-blue-300 text-xs px-2 py-1 rounded-full">TXT</span>
          <span className="bg-blue-900/50 text-blue-300 text-xs px-2 py-1 rounded-full">PPTX</span>
          <span className="bg-blue-900/50 text-blue-300 text-xs px-2 py-1 rounded-full">PPT</span>
        </div>
        <p className="text-gray-500 text-sm">hoặc nhấp để chọn file</p>
      </div>
      
      {/* File list */}
      {files.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Selected Files</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((file, index) => (
              <div key={index} className="flex items-center p-3 bg-gray-700 rounded-lg">
                <FiFile className="text-blue-400 mr-3" />
                <div className="flex-1 truncate">
                  <div className="font-medium">{file.name}</div>
                  <div className="text-xs text-gray-400">{(file.size / 1024).toFixed(2)} KB</div>
                </div>
                <button 
                  className="text-gray-400 hover:text-red-400"
                  onClick={() => setFiles(files.filter((_, i) => i !== index))}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Upload button */}
      <button
        className={`w-full py-3 rounded-lg flex items-center justify-center ${
          files.length === 0 || uploading
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        } transition-colors duration-200`}
        onClick={handleUpload}
        disabled={files.length === 0 || uploading}
      >
        {uploading ? (
          <>
            <FiLoader className="animate-spin mr-2" />
            Uploading...
          </>
        ) : (
          <>
            <FiUpload className="mr-2" />
            Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : ''}
          </>
        )}
      </button>
      
      {/* Status message */}
      {uploadStatus && (
        <div className={`mt-4 p-4 rounded-lg shadow-lg ${
          uploadStatus.success ? "bg-green-900/50 text-green-300 border border-green-700" : "bg-red-900/50 text-red-300 border border-red-700"
        }`}>
          <div className="flex items-center mb-2">
            {uploadStatus.success ? (
              <FiCheck className="mr-2 text-xl" />
            ) : (
              <FiAlertTriangle className="mr-2 text-xl" />
            )}
            <span className="font-medium">{uploadStatus.message}</span>
          </div>
          {uploadStatus.details.length > 0 && (
            <div className="mt-2 bg-gray-800/50 rounded-md p-3">
              <p className="text-sm font-medium mb-2">Chi tiết:</p>
              <ul className="text-sm space-y-1">
                {uploadStatus.details.map((detail, index) => (
                  <li key={index} className="flex items-center">
                    {detail.success ? (
                      <FiCheck className="mr-2 text-green-400" />
                    ) : (
                      <FiAlertTriangle className="mr-2 text-red-400" />
                    )}
                    <span className="truncate">{detail.file}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${detail.success ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"}`}>
                      {detail.success ? "Thành công" : "Thất bại"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-6 text-sm text-gray-400">
        <p>Supported file types: PDF, PPTX, DOCX, TXT</p>
        <p>Maximum file size: 10MB</p>
      </div>
    </div>
  );
};

export default FileUploader;