import React, { useRef, useEffect, useState } from 'react';
import { Markmap } from 'markmap-view';
import { Transformer } from 'markmap-lib';
import { FiZoomIn, FiZoomOut, FiMaximize2, FiDownload, FiInfo } from 'react-icons/fi';

// Mẫu markdown để sử dụng khi không có dữ liệu hoặc có lỗi
const FALLBACK_MARKDOWN = `# 🧠 Mind Map Mẫu
- 📊 Nhánh 1: Khái niệm chính
  - 📌 Chi tiết 1.1: *Thông tin bổ sung*
  - 🔍 Chi tiết 1.2: **Điểm quan trọng**
- 🛠️ Nhánh 2: Công cụ
  - 📱 Ứng dụng thực tiễn
- 📝 Nhánh 3: Tổng kết`;

// Tạo transformer với các plugin cần thiết - đảm bảo chỉ tạo một lần
const transformer = new Transformer();

// ADDED: Hàm xử lý markdown để đảm bảo chỉ có một heading level 1
const preprocessMarkdown = (markdown) => {
  if (!markdown) return FALLBACK_MARKDOWN;
  
  // Tách các dòng để phân tích
  const lines = markdown.split('\n');
  let firstH1Found = false;
  const processedLines = lines.map(line => {
    // Kiểm tra xem dòng có phải là heading level 1 (bắt đầu bằng # và khoảng trắng)
    if (line.trim().match(/^#\s+/)) {
      if (!firstH1Found) {
        firstH1Found = true;
        return line; // Giữ nguyên H1 đầu tiên
      } else {
        // Chuyển H1 thứ hai trở đi thành H2
        return '#' + line;
      }
    }
    return line;
  });
  
  return processedLines.join('\n');
};

// Hàm tiện ích để tạo ảnh PNG từ SVG
const downloadAsPng = (svg, filename = 'mindmap.png') => {
  const canvas = document.createElement('canvas');
  const svgRect = svg.getBoundingClientRect();
  canvas.width = svgRect.width * 2; // Scale up for better quality
  canvas.height = svgRect.height * 2;
  
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2); // Higher resolution
  
  // Đặt nền trắng cho màu xuất ra
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Chuyển đổi SVG thành ảnh
  const data = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    // Tạo link tải xuống
    const a = document.createElement('a');
    a.download = filename;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
};

const MindMapViewer = ({ markdown }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const mmRef = useRef(null); // Ref to store the Markmap instance
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    hasMarkdown: Boolean(markdown),
    markdownLength: markdown?.length || 0,
    svgReady: false,
    renderAttempts: 0
  });

  // Xử lý vào/ra fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Lỗi chuyển sang chế độ toàn màn hình:`, err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Lắng nghe thay đổi fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Điều chỉnh lại kích thước khi vào/ra chế độ toàn màn hình
      if (mmRef.current) {
        setTimeout(() => {
          mmRef.current.fit();
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Hiển thị thông tin debug
  const toggleDebugInfo = () => {
    console.log("MindMap Debug Info:", {
      ...debugInfo,
      markdownSample: markdown ? markdown.substring(0, 200) + "..." : "None",
      svgElement: svgRef.current,
      markmapInstance: mmRef.current
    });
    
    // Thông báo đã log debug info
    alert("Đã log thông tin debug vào console. Nhấn F12 để xem.");
  };

  useEffect(() => {
    // ADDED: Log để debug
    console.log("MindMapViewer mounting with markdown:", markdown ? `${markdown.substring(0, 50)}...` : "not provided");
    
    // Cập nhật thông tin debug khi markdown thay đổi
    setDebugInfo(prev => ({
      ...prev,
      hasMarkdown: Boolean(markdown),
      markdownLength: markdown?.length || 0,
      renderAttempts: prev.renderAttempts + 1
    }));

    // Nếu không có svg ref, không làm gì cả
    if (!svgRef.current) {
      console.error("MindMapViewer: SVG ref is null");
      setError("Không thể tạo khu vực vẽ mind map");
      return;
    }
    
    // ADDED: Kiểm tra xem Markmap đã được tạo chưa
    console.log("SVG ref exists:", svgRef.current);

    // Reset error state
    setError(null);

    // Ensure previous instance is destroyed if markdown changes
    if (mmRef.current) {
      console.log("Destroying previous Markmap instance");
      mmRef.current.destroy();
      mmRef.current = null;
    }

    // Reset SVG content để tránh lỗi
    while (svgRef.current.firstChild) {
      svgRef.current.removeChild(svgRef.current.lastChild);
    }

    // ADDED: Đặt kích thước cố định cho SVG để đảm bảo hiển thị
    svgRef.current.setAttribute('width', '100%');
    svgRef.current.setAttribute('height', '100%');
    svgRef.current.setAttribute('style', 'width: 100%; height: 100%;');
    
    try {
      // MODIFIED: Xử lý markdown để đảm bảo chỉ có một nút gốc (H1)
      const mdContent = preprocessMarkdown(markdown?.trim());
      
      console.log("MindMapViewer: Rendering preprocessed markdown:", mdContent.substring(0, 100) + "...");
      
      // Transform Markdown to Markmap data structure
      const { root, features } = transformer.transform(mdContent);

      if (!root) {
        throw new Error("Failed to transform markdown to mind map structure");
      }

      // ADDED: Kiểm tra cấu trúc root để debug
      console.log("MindMapViewer: Transformed data:", { 
        rootKeys: Object.keys(root),
        rootContent: root.content,
        childrenCount: root.children?.length || 0,
        firstChildContent: root.children && root.children.length > 0 ? root.children[0].content : null
      });

      // Đánh dấu SVG đã sẵn sàng
      setDebugInfo(prev => ({ ...prev, svgReady: true }));

      // MODIFIED: Tùy chỉnh các tùy chọn với màu sắc phù hợp với giao diện tối
      const enhancedOptions = {
        autoFit: true,
        paddingX: 16,
        duration: 500,
        maxWidth: 300,
        initialExpandLevel: 999, // Mở tất cả các nhánh
        backgroundColor: 'transparent', // Đảm bảo nền trong suốt
        color: d => {
          // Bảng màu sáng hơn để hiển thị tốt trên nền tối
          const colors = [
            '#a78bfa', // Tím nhạt
            '#93c5fd', // Xanh dương nhạt
            '#f9a8d4', // Hồng nhạt
            '#fbbf24', // Vàng
            '#34d399', // Xanh lá
            '#fb923c', // Cam
            '#c4b5fd', // Tím nhạt
          ];
          return colors[d.depth % colors.length];
        },
        // ADDED: Tùy chỉnh phông chữ và nét vẽ cho rõ ràng hơn trên nền tối
        nodeFont: d => {
          const depth = d.depth || 0;
          const size = depth === 0 ? 18 : 14;
          return `${depth === 0 ? 'bold' : 'normal'} ${size}px system-ui, sans-serif`;
        },
        nodeMinHeight: 20, // Tăng chiều cao tối thiểu của node
        spacingVertical: 8, // Tăng khoảng cách dọc
        spacingHorizontal: 120, // Giữ khoảng cách ngang
        // ADDED: Tùy chỉnh style của các đường nối
        linkStyle: () => {
          return {
            stroke: '#6d6d6d', // Màu xám nhạt cho đường nối
            strokeWidth: '1.5px', // Độ dày đường nối
          };
        },
        // ADDED: Tùy chỉnh style chữ
        nodeStyle: () => {
          return {
            fill: '#e2e8f0', // Màu chữ sáng cho nền tối 
            stroke: 'none',
            'font-family': 'system-ui, sans-serif',
          };
        },
        // ADDED: Đảm bảo chỉ có một root node hiển thị
        preset: {
          wrapText: true,
          maxWidth: 300,
        }
      };

      // Thêm CSS custom vào document để cải thiện hiển thị
      if (!document.getElementById('markmap-css-fix')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'markmap-css-fix';
        styleTag.innerHTML = `
          .markmap-svg .markmap-node-text {
            fill: #e2e8f0;
            font-family: system-ui, sans-serif;
          }
          .markmap-svg .markmap-node-circle {
            stroke: rgba(255, 255, 255, 0.1);
          }
          .markmap-svg .markmap-link {
            stroke: #6d6d6d; 
            stroke-width: 1.5px;
          }
          .markmap-svg text {
            fill: #e2e8f0;
          }
          .markmap-svg .markmap-foreign {
            color: #e2e8f0;
          }
        `;
        document.head.appendChild(styleTag);
      }

      // MODIFIED: Tạo instance Markmap với cách đơn giản hơn và thêm timeout lâu hơn
      setTimeout(() => {
        try {
          console.log("Creating Markmap instance with root:", root);
          
          // ADDED: Đảm bảo chỉ có một nút gốc bằng cách kiểm tra cấu trúc dữ liệu
          let finalRoot = root;
          if (Array.isArray(root.children) && root.children.length > 0 && !root.content) {
            // Nếu root không có nội dung nhưng có con, có thể đây là một wrapper node tự động tạo ra
            // Trong trường hợp này, ta sử dụng node đầu tiên làm root
            console.log("Multiple root nodes detected, fixing to use only the first one as main root");
            finalRoot = {
              ...root.children[0],
              children: [...(root.children[0].children || []), ...(root.children.slice(1) || [])]
            };
          }
          
          // Tạo instance mới với các tùy chọn
          mmRef.current = Markmap.create(svgRef.current, enhancedOptions, finalRoot);
          
          // Thêm timeout lâu hơn để đảm bảo DOM đã được cập nhật
          setTimeout(() => {
            if (mmRef.current) {
              console.log("Fitting map to view");
              mmRef.current.fit();
              
              // ADDED: Áp dụng CSS trực tiếp vào các phần tử SVG
              if (svgRef.current) {
                const textElements = svgRef.current.querySelectorAll('text');
                textElements.forEach(el => {
                  el.style.fill = '#e2e8f0';
                  el.style.fontFamily = 'system-ui, sans-serif';
                });
              }
            }
          }, 300);
          
        } catch (err) {
          console.error("Error creating Markmap instance:", err);
          setError(`Lỗi tạo mind map: ${err.message}`);
        }
      }, 100); // Tăng timeout để đảm bảo DOM đã sẵn sàng

    } catch (error) {
      console.error("Error rendering Markmap:", error);
      setError(`Lỗi hiển thị mind map: ${error.message}`);
      
      // ADDED: Thử render với markdown mẫu nếu có lỗi
      try {
        console.log("Attempting to render fallback markdown");
        const { root } = transformer.transform(FALLBACK_MARKDOWN);
        setTimeout(() => {
          mmRef.current = Markmap.create(svgRef.current, { autoFit: true }, root);
        }, 100);
      } catch (fallbackError) {
        console.error("Even fallback markdown failed:", fallbackError);
      }
    }

    // Cleanup function to destroy Markmap instance on unmount
    return () => {
      if (mmRef.current) {
        console.log("Cleaning up Markmap instance");
        mmRef.current.destroy();
        mmRef.current = null;
      }
    };
  }, [markdown]); // Re-run effect when markdown content changes

  // Xử lý phóng to, thu nhỏ
  const handleZoomIn = () => {
    if (mmRef.current) {
      const { scale } = mmRef.current.state;
      mmRef.current.setZoom(scale * 1.25);
    }
  };

  const handleZoomOut = () => {
    if (mmRef.current) {
      const { scale } = mmRef.current.state;
      mmRef.current.setZoom(scale / 1.25);
    }
  };

  // Xử lý tải xuống ảnh PNG
  const handleDownload = () => {
    if (svgRef.current) {
      // Lấy tên chủ đề từ markdown nếu có
      let filename = 'mindmap.png';
      if (markdown) {
        const match = markdown.match(/^#\s*([^\n]+)/);
        if (match && match[1]) {
          // Làm sạch tiêu đề (loại bỏ emoji và ký tự đặc biệt)
          let title = match[1].replace(/[^\p{L}\p{N}\s]/gu, '').trim();
          if (title) filename = `${title.slice(0, 30)}.png`;
        }
      }
      downloadAsPng(svgRef.current, filename);
    }
  };

  return (
    <div className="w-full h-full flex flex-col" ref={containerRef}>
      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 mb-3 rounded-md border border-red-700 text-sm">
          <p>{error}</p>
          <p className="mt-1 text-xs">
            <button 
              className="text-blue-400 underline" 
              onClick={toggleDebugInfo}
            >
              Xem thông tin debug
            </button>
            <span className="mx-2">|</span>
            <button 
              className="text-blue-400 underline" 
              onClick={() => {
                // Thử render lại với markdown mẫu
                setError(null);
                const md = FALLBACK_MARKDOWN;
                const { root } = transformer.transform(md);
                if (mmRef.current) mmRef.current.destroy();
                mmRef.current = Markmap.create(svgRef.current, { autoFit: true }, root);
              }}
            >
              Thử hiển thị mind map mẫu
            </button>
          </p>
        </div>
      )}
      
      <div className="w-full flex-1 border border-gray-700 rounded-lg overflow-hidden bg-gray-800/50 relative">
        {/* Controls */}
        <div className="absolute top-3 right-3 z-10 bg-gray-800/80 rounded-md p-1.5 flex gap-2 backdrop-blur-sm">
          <button 
            className="bg-purple-600/70 hover:bg-purple-600 text-white p-1.5 rounded flex items-center justify-center" 
            onClick={handleZoomIn}
            title="Phóng to"
          >
            <FiZoomIn size={16} />
          </button>
          <button 
            className="bg-purple-600/70 hover:bg-purple-600 text-white p-1.5 rounded flex items-center justify-center"
            onClick={handleZoomOut}
            title="Thu nhỏ"
          >
            <FiZoomOut size={16} />
          </button>
          <button 
            className="bg-purple-600/70 hover:bg-purple-600 text-white p-1.5 rounded flex items-center justify-center"
            onClick={() => mmRef.current?.fit()}
            title="Khớp với màn hình"
          >
            <FiMaximize2 size={16} />
          </button>
          <button 
            className="bg-green-600/70 hover:bg-green-600 text-white p-1.5 rounded flex items-center justify-center"
            onClick={handleDownload}
            title="Tải xuống dưới dạng ảnh PNG"
          >
            <FiDownload size={16} />
          </button>
          <button 
            className="bg-blue-600/70 hover:bg-blue-600 text-white p-1.5 rounded flex items-center justify-center"
            onClick={toggleDebugInfo}
            title="Hiển thị thông tin debug"
          >
            <FiInfo size={16} />
          </button>
        </div>
        
        {/* MODIFIED: Điều chỉnh container SVG để đảm bảo hiển thị đúng với nền tối */}
        <div className="w-full h-full">
          <svg 
            ref={svgRef} 
            className="w-full h-full markmap-svg" 
            style={{ minHeight: '400px', display: 'block', background: 'transparent' }}
            width="100%" 
            height="100%" 
          />
        </div>
        
        {/* Help text */}
        <div className="absolute bottom-2 left-2 text-xs text-gray-300 bg-gray-800/80 p-1.5 rounded backdrop-blur-sm max-w-xs">
          <p className="mb-1"><strong>Điều khiển:</strong> Kéo để di chuyển | Scroll để phóng to/thu nhỏ</p>
          <p>Click vào nút <span className="inline-block w-2 h-2 bg-purple-400 rounded-full mx-1"></span> để mở rộng/thu gọn nhánh</p>
        </div>
      </div>
    </div>
  );
};

export default MindMapViewer;
