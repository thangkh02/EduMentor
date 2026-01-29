import React, { useState } from 'react';
import { FiShare2, FiCopy, FiCheck, FiDownload, FiMail } from 'react-icons/fi';

const ShareableContent = ({ content, title, type }) => {
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // In a real app, this would generate a shareable link via your backend
  const generateShareableLink = () => {
    // Simulate creating a shareable link
    const contentId = Math.random().toString(36).substring(2, 15);
    const url = `https://edumentor.example.com/shared/${type}/${contentId}`;
    setShareUrl(url);
    return url;
  };

  const handleShare = () => {
    setShowShareOptions(!showShareOptions);
    if (!shareUrl) {
      generateShareableLink();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadContent = () => {
    // Create a blob with the content
    const blob = new Blob([JSON.stringify({
      title,
      content,
      type,
      exportedAt: new Date().toISOString()
    }, null, 2)], { type: 'application/json' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_').toLowerCase()}_${type}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  const shareByEmail = () => {
    const subject = encodeURIComponent(`EduMentor AI: ${title}`);
    const body = encodeURIComponent(`Check out this ${type} I created with EduMentor AI:\n\n${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
      >
        <FiShare2 className="mr-2" /> Share
      </button>
      
      {showShareOptions && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-10">
          <div className="p-3 border-b border-gray-700">
            <h3 className="font-bold">Share {type}</h3>
            <p className="text-sm text-gray-400 mt-1">"{title}"</p>
          </div>
          
          <div className="p-3">
            <div className="flex items-center mb-3">
              <input 
                type="text" 
                value={shareUrl} 
                readOnly
                className="flex-1 bg-gray-700 border border-gray-600 rounded-l-lg p-2 text-sm text-gray-300"
              />
              <button 
                onClick={copyToClipboard}
                className="bg-gray-600 hover:bg-gray-500 p-2 rounded-r-lg"
                title="Copy to clipboard"
              >
                {copied ? <FiCheck className="text-green-400" /> : <FiCopy />}
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={downloadContent}
                className="bg-gray-700 hover:bg-gray-600 p-2 rounded-lg flex items-center justify-center"
              >
                <FiDownload className="mr-2" /> Download
              </button>
              <button 
                onClick={shareByEmail}
                className="bg-gray-700 hover:bg-gray-600 p-2 rounded-lg flex items-center justify-center"
              >
                <FiMail className="mr-2" /> Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareableContent;