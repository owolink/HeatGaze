from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session
from app.utils import get_db, generate_heatmap, img_to_base64, calculate_heatmap_stats
from app.models import Session as SessionModel, User, Heatmap
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
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    
    # For now, return a placeholder response since we're still developing this endpoint
    return {
        "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFdwI2QOYcNQAAAABJRU5ErkJggg==",
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
async def get_heatmap(heatmap_id: int):
    """Get a specific heatmap by ID"""
    # This would normally fetch from a database
    # For now, we'll just return placeholder data
    return {
        "id": heatmap_id,
        "title": f"Heatmap {heatmap_id}",
        "created_at": "2023-07-15T10:30:00Z",
        "data_points": 1240,
        "image_url": f"/api/heatmap/image/{heatmap_id}"
    } 