import os
import argparse
import asyncio
import signal
import sys
import uvicorn
from dotenv import load_dotenv
from config.settings import API_RELOAD, API_HOST, API_PORT
from api.main import app  # Import app từ file backend

load_dotenv()

# Biến toàn cục để truy cập server và kiểm soát shutdown
server = None

async def shutdown():
    """Đóng tài nguyên và dừng server một cách an toàn"""
    print("\nĐang thoát ứng dụng một cách an toàn...")
    if server:
        await server.shutdown()
    sys.exit(0)

def handle_exit(signum, frame):
    """Xử lý tín hiệu thoát"""
    asyncio.create_task(shutdown())

async def main():
    parser = argparse.ArgumentParser(description="Learning Assistant API Server")
    parser.add_argument("--collection", type=str, 
                        default=os.getenv("MILVUS_COLLECTION_NAME", "learning_docs"),
                        help="Collection name for document retrieval")
    parser.add_argument("--port", type=int, default=API_PORT,
                        help="Port to run the API server on")
    parser.add_argument("--host", type=str, default=API_HOST,
                        help="Host to run the API server on")
    parser.add_argument("--reload", action="store_true", default=API_RELOAD,
                        help="Enable auto-reload for development")
    args = parser.parse_args()

    # Đặt biến môi trường cho Milvus collection
    os.environ["MILVUS_COLLECTION_NAME"] = args.collection

    # Đăng ký signal handler
    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    # Cấu hình uvicorn
    config = uvicorn.Config(
        app,  # Sử dụng app từ file backend
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
        timeout_keep_alive=120,
        loop="asyncio",
    )

    # Khởi tạo server
    global server
    server = uvicorn.Server(config)

    try:
        print(f"Khởi động EduMentor API trên {args.host}:{args.port}")
        await server.serve()  # Chạy server async
    except Exception as e:
        print(f"Lỗi khi khởi động server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Chạy async main trong event loop
    asyncio.run(main())