from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session
from app.utils import get_db, generate_heatmap, img_to_base64, calculate_heatmap_stats
from app.models import Session as SessionModel, User, Heatmap, GazeData, CursorData
from routes.auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import os
import io
import base64
from fastapi.responses import FileResponse
from datetime import datetime

# Router
router = APIRouter()

# Models
class HeatmapRequest(BaseModel):
    session_id: int
    url: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None

class HeatmapResponse(BaseModel):
    image: str
    stats: dict
    cursorHeatmapUrl: Optional[str] = None
    cursorStats: Optional[dict] = None
    pointCount: Optional[int] = None
    videoUrl: Optional[str] = None
    serverUrl: Optional[str] = None

class HeatmapFilterRequest(BaseModel):
    heatmap_id: int
    filter_type: str
    parameters: Optional[dict] = None

# Routes
@router.post("/heatmap", response_model=HeatmapResponse)
async def generate_session_heatmap(
    request: HeatmapRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if session exists and belongs to user
    session = db.query(SessionModel).filter(
        SessionModel.id == request.session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # For now, return a placeholder response since we're still developing this endpoint
    return {
        "image": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFdwI2QOYcNQAAAABJRU5ErkJggg==",
        "stats": {
            "focus_areas": 3,
            "attention_score": 75,
            "coverage": 0.65,
            "kld": 0.42,
            "nss": 1.85,
            "similarity": 0.65,
            "cc": 0.78,
            "auc": 0.82
        }
    }

@router.get("/placeholder.jpg")
async def get_placeholder_image():
    """Return a placeholder image for fallback"""
    placeholder_path = os.path.join("static", "images", "placeholder.jpg")
    if os.path.exists(placeholder_path):
        return FileResponse(placeholder_path)
    else:
        # If the placeholder image doesn't exist, return a 404
        raise HTTPException(status_code=404, detail="Placeholder image not found")

@router.get("/heatmaps/{heatmap_id}")
async def get_heatmap(
    heatmap_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific heatmap by ID if it belongs to the user"""
    # Find the heatmap
    heatmap = db.query(Heatmap).filter(Heatmap.id == heatmap_id).first()
    
    if not heatmap:
        raise HTTPException(status_code=404, detail="Heatmap not found")
    
    # Check if the associated session belongs to the user
    session = db.query(SessionModel).filter(
        SessionModel.id == heatmap.session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Return the heatmap data
    return {
        "id": heatmap_id,
        "title": f"Heatmap {heatmap_id}",
        "created_at": heatmap.created_at.isoformat(),
        "data_points": 1240,
        "image_url": f"/api/heatmap/image/{heatmap_id}"
    }

@router.get("/sessions/{session_id}/heatmap", response_model=HeatmapResponse)
async def get_session_heatmap(
    session_id: int,
    type: str = "combined",  # Changed default from "gaze" to "combined"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if session exists and belongs to user
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # Check if type is valid
        if type not in ["gaze", "cursor", "combined"]:
            type = "combined"  # Default to combined if invalid

        if type == "cursor":
            # Get cursor data points
            point_count = db.query(CursorData).filter(
                CursorData.session_id == session_id
            ).count()
            
            if point_count == 0:
                # Return empty response if no data available
                return {
                    "image": "",
                    "stats": {
                        "pointCount": 0,
                        "focus_areas": 0,
                        "attention_score": 0,
                        "coverage": 0,
                        "kld": 0,
                        "nss": 0,
                        "similarity": 0,
                        "cc": 0,
                        "auc": 0
                    }
                }
            
            # Get cursor data points
            cursor_data = db.query(CursorData).filter(
                CursorData.session_id == session_id
            ).order_by(CursorData.timestamp.desc()).limit(10000).all()
            
            # Transform cursor data into format needed for heatmap generation
            cursor_points = []
            for point in cursor_data:
                if point.x is not None and point.y is not None:
                    cursor_points.append({
                        'x': point.x,
                        'y': point.y,
                        'timestamp': point.timestamp.timestamp() * 1000  # Convert to milliseconds
                    })
            
            if not cursor_points:
                # Return empty response if no valid points
                return {
                    "image": "",
                    "stats": {
                        "pointCount": 0,
                        "focus_areas": 0,
                        "attention_score": 0,
                        "coverage": 0,
                        "kld": 0,
                        "nss": 0,
                        "similarity": 0,
                        "cc": 0,
                        "auc": 0
                    }
                }
            
            # Generate cursor heatmap
            heatmap_image, raw_heatmap = generate_heatmap(cursor_points, 1920, 1080)
            
            # Calculate advanced statistics
            stats = calculate_heatmap_stats(raw_heatmap, cursor_points)
            
            return {
                "image": heatmap_image,
                "stats": stats,
                "cursorHeatmapUrl": heatmap_image,  # Set cursor heatmap as the main image
                "cursorStats": stats
            }
        
        # Get screen dimensions from the session if available, or use defaults
        screen_width = 1920
        screen_height = 1080
        
        # Try to get dimensions from session if they exist
        if hasattr(session, 'screen_width') and session.screen_width:
            screen_width = session.screen_width
        if hasattr(session, 'screen_height') and session.screen_height:
            screen_height = session.screen_height
        
        # Get gaze data points
        point_count = db.query(GazeData).filter(
            GazeData.session_id == session_id
        ).count()
        
        if point_count == 0:
            # Return empty response if no data available
            return {
                "image": "",
                "stats": {
                    "pointCount": 0,
                    "focus_areas": 0,
                    "attention_score": 0,
                    "coverage": 0,
                    "kld": 0,
                    "nss": 0,
                    "similarity": 0,
                    "cc": 0,
                    "auc": 0
                }
            }
        
        # Get gaze data points
        gaze_data = db.query(GazeData).filter(
            GazeData.session_id == session_id
        ).order_by(GazeData.timestamp.desc()).limit(10000).all()
        
        # Transform gaze data into format needed for heatmap generation
        gaze_points = []
        for point in gaze_data:
            if point.x is not None and point.y is not None:
                gaze_points.append({
                    'x': point.x,
                    'y': point.y,
                    'timestamp': point.timestamp.timestamp() * 1000  # Convert to milliseconds
                })
        
        if not gaze_points:
            # Return empty response if no valid points
            return {
                "image": "",
                "stats": {
                    "pointCount": 0,
                    "focus_areas": 0,
                    "attention_score": 0,
                    "coverage": 0,
                    "kld": 0,
                    "nss": 0,
                    "similarity": 0,
                    "cc": 0,
                    "auc": 0
                }
            }
        
        # Generate heatmap
        heatmap_image, raw_heatmap = generate_heatmap(gaze_points, screen_width, screen_height)
        
        # Calculate advanced statistics using our new implementation
        stats = calculate_heatmap_stats(raw_heatmap, gaze_points)
        
        # If requesting the combined view, also get cursor data
        if type == "combined":
            # Count cursor data points
            cursor_count = db.query(CursorData).filter(
                CursorData.session_id == session_id
            ).count()
            
            cursor_stats = None
            cursor_heatmap_image = None
            
            if cursor_count > 0:
                # Get cursor data points
                cursor_data = db.query(CursorData).filter(
                    CursorData.session_id == session_id
                ).order_by(CursorData.timestamp.desc()).limit(10000).all()
                
                # Transform cursor data
                cursor_points = []
                for point in cursor_data:
                    if point.x is not None and point.y is not None:
                        cursor_points.append({
                            'x': point.x,
                            'y': point.y,
                            'timestamp': point.timestamp.timestamp() * 1000
                        })
                
                if cursor_points:
                    # Generate cursor heatmap
                    cursor_heatmap_image, cursor_raw_heatmap = generate_heatmap(cursor_points, screen_width, screen_height)
                    
                    # Calculate cursor statistics
                    cursor_stats = calculate_heatmap_stats(cursor_raw_heatmap, cursor_points)
                
            # Always return the cursor heatmap URL and stats in combined mode, even if null
            video_url = None
            if hasattr(session, 'video_url') and session.video_url:
                video_url = session.video_url
            
            return {
                "image": heatmap_image,
                "stats": stats,
                "cursorHeatmapUrl": cursor_heatmap_image,
                "cursorStats": cursor_stats,
                "videoUrl": video_url
            }
        
        # Default gaze-only response
        video_url = None
        if hasattr(session, 'video_url') and session.video_url:
            video_url = session.video_url
            
        return {
            "image": heatmap_image,
            "stats": stats,
            "videoUrl": video_url
        }
    except Exception as e:
        # Log the error for debugging
        print(f"Error generating heatmap: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating heatmap: {str(e)}") 