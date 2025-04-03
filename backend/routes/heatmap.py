from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session
from app.utils import get_db, generate_heatmap, img_to_base64, calculate_heatmap_stats
from app.models import Session as SessionModel, User, Heatmap, GazeData
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
    image: str  # base64 encoded image
    stats: dict

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
            "coverage": 0.65
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
        # Count gaze data points first - avoid loading all data if there's too much
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
                    "coverage": 0
                }
            }
        
        # Get all gaze data for this session - limit to the most recent 10,000 points
        # to prevent timeout issues with very large datasets
        gaze_data = db.query(GazeData).filter(
            GazeData.session_id == session_id
        ).order_by(GazeData.timestamp.desc()).limit(10000).all()
        
        # Transform gaze data into format needed for heatmap generation
        # Assuming standard 1920x1080 screen size - adjust if needed
        screen_width = 1920
        screen_height = 1080
        
        # Convert SQLAlchemy objects to dictionaries for heatmap generation
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
                    "coverage": 0
                }
            }
        
        # Generate heatmap
        heatmap_image, raw_heatmap = generate_heatmap(gaze_points, screen_width, screen_height)
        
        # Calculate basic stats - faster calculations
        focus_areas = min(len(set((int(p['x'])//100, int(p['y'])//100) for p in gaze_points)), 10)
        coverage = min(len(set((int(p['x'])//50, int(p['y'])//50) for p in gaze_points)) / 400.0, 1.0)
        attention_score = min(point_count // 30, 100)  # Use total point count for attention score
        
        return {
            "image": heatmap_image,
            "stats": {
                "pointCount": point_count,  # Use total point count
                "focus_areas": focus_areas,
                "attention_score": attention_score,
                "coverage": coverage
            }
        }
    except Exception as e:
        # Log the error for debugging
        print(f"Error generating heatmap: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating heatmap: {str(e)}") 