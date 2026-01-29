from fastapi import APIRouter, HTTPException, Depends, Query, Path
from typing import Dict, List, Optional, Any
from utils.user_data_manager import UserDataManager
from auth.utils import get_current_user_optional
import logging

router = APIRouter(
    prefix="/stats",
    tags=["stats"],
    responses={404: {"description": "Not found"}},
)

logger = logging.getLogger(__name__)

@router.get("/", summary="Lấy tổng quan thống kê người dùng")
async def get_user_stats(
    username: Optional[str] = Query(None, description="Username cụ thể. Nếu không cung cấp, sẽ lấy từ token xác thực."),
    current_user: Optional[Dict] = Depends(get_current_user_optional)
):
    """
    Truy xuất tất cả dữ liệu thống kê của người dùng.
    """
    # Sử dụng username từ query param hoặc từ token nếu có
    user_id = username
    if not user_id and current_user:
        user_id = current_user.get("username")
    
    # Nếu không có username, trả về lỗi
    if not user_id:
        return {
            "success": False,
            "message": "Bạn cần cung cấp username hoặc đăng nhập để xem thống kê.",
            "data": {}
        }
    
    try:
        user_data_manager = UserDataManager()
        stats = user_data_manager.get_user_stats(user_id)
        
        if not stats:
            return {
                "success": True,
                "message": "Không tìm thấy dữ liệu thống kê nào cho người dùng này.",
                "data": {}
            }
            
        # Tổng hợp dữ liệu
        subjects_count = len(stats)
        total_documents = sum(len(data.get("documents", [])) for data in stats.values())
        
        # Thông tin tóm tắt về từng môn học
        subjects_summary = []
        for subject, data in stats.items():
            subjects_summary.append({
                "name": subject,
                "progress": data.get("progress", 0),
                "document_count": len(data.get("documents", [])),
                "has_plan": "plan" in data and data["plan"]
            })
        
        # Lấy 5 hoạt động gần đây
        recent_activities = user_data_manager.get_recent_activities(user_id, limit=5)
            
        return {
            "success": True,
            "data": {
                "username": user_id,
                "subjects_count": subjects_count,
                "total_documents": total_documents,
                "subjects": subjects_summary,
                "recent_activities": recent_activities
            }
        }
    except Exception as e:
        logger.exception(f"Lỗi khi truy xuất thống kê người dùng: {e}")
        raise HTTPException(status_code=500, detail=f"Đã xảy ra lỗi khi truy xuất dữ liệu thống kê: {str(e)}")

@router.get("/subject/{subject}", summary="Lấy thống kê môn học cụ thể")
async def get_subject_stats(
    subject: str = Path(..., description="Tên môn học cần truy xuất"),
    username: Optional[str] = Query(None, description="Username cụ thể. Nếu không cung cấp, sẽ lấy từ token xác thực."),
    current_user: Optional[Dict] = Depends(get_current_user_optional)
):
    """
    Truy xuất thông tin chi tiết về một môn học cụ thể.
    """
    # Sử dụng username từ query param hoặc từ token nếu có
    user_id = username
    if not user_id and current_user:
        user_id = current_user.get("username")
    
    # Nếu không có username, trả về lỗi
    if not user_id:
        return {
            "success": False,
            "message": "Bạn cần cung cấp username hoặc đăng nhập để xem thống kê.",
            "data": {}
        }
    
    try:
        user_data_manager = UserDataManager()
        stats = user_data_manager.get_user_stats(user_id, subject)
        
        if not stats or subject not in stats:
            return {
                "success": False,
                "message": f"Không tìm thấy dữ liệu cho môn học '{subject}'.",
                "data": {}
            }
            
        subject_data = stats[subject]
        
        # Định dạng ngày tháng cho dễ đọc
        if "progress_updated_at" in subject_data:
            subject_data["progress_updated_at"] = subject_data["progress_updated_at"].isoformat()
            
        if "plan_created_at" in subject_data:
            subject_data["plan_created_at"] = subject_data["plan_created_at"].isoformat()
            
        # Sửa lại danh sách documents để dễ đọc
        if "documents" in subject_data:
            for doc in subject_data["documents"]:
                if "upload_date" in doc:
                    doc["upload_date"] = doc["upload_date"].isoformat()
                if "last_accessed" in doc:
                    doc["last_accessed"] = doc["last_accessed"].isoformat()
        
        return {
            "success": True,
            "data": {
                "username": user_id,
                "subject": subject,
                "details": subject_data
            }
        }
    except Exception as e:
        logger.exception(f"Lỗi khi truy xuất thông tin môn học: {e}")
        raise HTTPException(status_code=500, detail=f"Đã xảy ra lỗi khi truy xuất thông tin môn học: {str(e)}")

@router.get("/documents", summary="Lấy danh sách tất cả tài liệu của người dùng")
async def get_user_documents(
    username: Optional[str] = Query(None, description="Username cụ thể. Nếu không cung cấp, sẽ lấy từ token xác thực."),
    current_user: Optional[Dict] = Depends(get_current_user_optional)
):
    """
    Truy xuất danh sách tất cả tài liệu của người dùng.
    """
    # Sử dụng username từ query param hoặc từ token nếu có
    user_id = username
    if not user_id and current_user:
        user_id = current_user.get("username")
    
    # Nếu không có username, trả về lỗi
    if not user_id:
        return {
            "success": False,
            "message": "Bạn cần cung cấp username hoặc đăng nhập để xem danh sách tài liệu.",
            "data": {}
        }
    
    try:
        user_data_manager = UserDataManager()
        documents = user_data_manager.get_documents(user_id)
        
        if not documents:
            return {
                "success": True,
                "message": "Không có tài liệu nào được tìm thấy.",
                "data": {"documents": []}
            }
            
        # Định dạng ngày tháng
        for doc in documents:
            if "upload_date" in doc:
                doc["upload_date"] = doc["upload_date"].isoformat()
            if "last_accessed" in doc:
                doc["last_accessed"] = doc["last_accessed"].isoformat()
            
        return {
            "success": True,
            "data": {
                "username": user_id,
                "document_count": len(documents),
                "documents": documents
            }
        }
    except Exception as e:
        logger.exception(f"Lỗi khi truy xuất danh sách tài liệu: {e}")
        raise HTTPException(status_code=500, detail=f"Đã xảy ra lỗi khi truy xuất danh sách tài liệu: {str(e)}")

@router.get("/activities", summary="Lấy lịch sử hoạt động người dùng")
async def get_user_activities(
    limit: int = Query(10, description="Số lượng hoạt động tối đa cần lấy"),
    username: Optional[str] = Query(None, description="Username cụ thể. Nếu không cung cấp, sẽ lấy từ token xác thực."),
    current_user: Optional[Dict] = Depends(get_current_user_optional)
):
    """
    Truy xuất lịch sử hoạt động của người dùng.
    """
    # Sử dụng username từ query param hoặc từ token nếu có
    user_id = username
    if not user_id and current_user:
        user_id = current_user.get("username")
    
    # Nếu không có username, trả về lỗi
    if not user_id:
        return {
            "success": False,
            "message": "Bạn cần cung cấp username hoặc đăng nhập để xem lịch sử hoạt động.",
            "data": {}
        }
    
    try:
        user_data_manager = UserDataManager()
        activities = user_data_manager.get_recent_activities(user_id, limit=limit)
        
        if not activities:
            return {
                "success": True,
                "message": "Không có hoạt động nào được ghi nhận.",
                "data": {"activities": []}
            }
            
        # Định dạng ngày tháng
        for act in activities:
            if "timestamp" in act:
                act["timestamp"] = act["timestamp"].isoformat()
            
        return {
            "success": True,
            "data": {
                "username": user_id,
                "activity_count": len(activities),
                "activities": activities
            }
        }
    except Exception as e:
        logger.exception(f"Lỗi khi truy xuất lịch sử hoạt động: {e}")
        raise HTTPException(status_code=500, detail=f"Đã xảy ra lỗi khi truy xuất lịch sử hoạt động: {str(e)}")
