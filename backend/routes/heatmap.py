from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session
from app.utils import get_db, generate_heatmap, img_to_base64, calculate_heatmap_stats, calculate_correlation_metrics
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

        # Get screen dimensions from the session if available, or use defaults
        screen_width = session.screen_width if hasattr(session, 'screen_width') and session.screen_width else 1920
        screen_height = session.screen_height if hasattr(session, 'screen_height') and session.screen_height else 1080

        # Initialize variables for both heatmaps
        gaze_heatmap_image = None
        gaze_raw_heatmap = None
        gaze_stats = None
        cursor_heatmap_image = None
        cursor_raw_heatmap = None
        cursor_stats = None
        correlation_metrics = None

        # Always fetch both gaze and cursor data if available
        gaze_count = db.query(GazeData).filter(GazeData.session_id == session_id).count()
        cursor_count = db.query(CursorData).filter(CursorData.session_id == session_id).count()

        print(f"Session {session_id} has {gaze_count} gaze points and {cursor_count} cursor points")

        # Process gaze data if available
        if gaze_count > 0:
            gaze_data = db.query(GazeData).filter(
                GazeData.session_id == session_id
            ).order_by(GazeData.timestamp.desc()).limit(10000).all()
            
            gaze_points = [{
                'x': point.x,
                'y': point.y,
                'timestamp': point.timestamp.timestamp() * 1000
            } for point in gaze_data if point.x is not None and point.y is not None]
            
            if gaze_points:
                print(f"Generating gaze heatmap with {len(gaze_points)} points")
                gaze_heatmap_image, gaze_raw_heatmap = generate_heatmap(gaze_points, screen_width, screen_height)
                gaze_stats = calculate_heatmap_stats(gaze_raw_heatmap, gaze_points)

        # Process cursor data if available
        if cursor_count > 0:
            cursor_data = db.query(CursorData).filter(
                CursorData.session_id == session_id
            ).order_by(CursorData.timestamp.desc()).limit(10000).all()
            
            cursor_points = [{
                'x': point.x,
                'y': point.y,
                'timestamp': point.timestamp.timestamp() * 1000
            } for point in cursor_data if point.x is not None and point.y is not None]
            
            if cursor_points:
                print(f"Generating cursor heatmap with {len(cursor_points)} points")
                cursor_heatmap_image, cursor_raw_heatmap = generate_heatmap(cursor_points, screen_width, screen_height)
                cursor_stats = calculate_heatmap_stats(cursor_raw_heatmap, cursor_points)

        # Calculate correlation metrics if both heatmaps are available
        if gaze_raw_heatmap is not None and cursor_raw_heatmap is not None:
            print(f"Calculating correlation metrics for session {session_id}")
            
            # Check if heatmaps have different shapes and resize if needed
            if gaze_raw_heatmap.shape != cursor_raw_heatmap.shape:
                print(f"Heatmap shapes don't match! Gaze: {gaze_raw_heatmap.shape}, Cursor: {cursor_raw_heatmap.shape}")
                
                # Resize cursor heatmap to match gaze heatmap
                import cv2
                cursor_raw_heatmap = cv2.resize(cursor_raw_heatmap, 
                                              (gaze_raw_heatmap.shape[1], gaze_raw_heatmap.shape[0]), 
                                              interpolation=cv2.INTER_AREA)
                print(f"Resized cursor heatmap to {cursor_raw_heatmap.shape}")
            
            correlation_metrics = calculate_correlation_metrics(gaze_raw_heatmap, cursor_raw_heatmap)
            print(f"Correlation metrics calculated: {correlation_metrics}")

        # Create a base response with basic info
        response = {
            "correlationMetrics": correlation_metrics
        }

        # Prepare the response based on requested type
        if type == "cursor":
            if not cursor_heatmap_image:
                print("No cursor heatmap available")
                response.update({
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
                })
            else:
                response.update({
                    "image": cursor_heatmap_image,
                    "stats": cursor_stats,
                })
        else:
            # For gaze or combined view
            if not gaze_heatmap_image:
                print("No gaze heatmap available")
                response.update({
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
                })
            else:
                response.update({
                    "image": gaze_heatmap_image,
                    "stats": gaze_stats,
                })

        # Add cursor data if available, regardless of view type
        if cursor_heatmap_image:
            response.update({
                "cursorHeatmapUrl": cursor_heatmap_image,
                "cursorStats": cursor_stats
            })

        # Add gaze data if available, regardless of view type
        if gaze_heatmap_image and type == "cursor":
            response.update({
                "gazeHeatmapUrl": gaze_heatmap_image,
                "gazeStats": gaze_stats
            })

        # Add video URL if available
        if hasattr(session, 'video_url') and session.video_url:
            response["videoUrl"] = session.video_url
            
        # Add server URL if needed
        response["serverUrl"] = None

        # Log the final response structure
        print(f"Response structure keys: {list(response.keys())}")
        if correlation_metrics:
            print(f"Correlation metrics in response: {list(correlation_metrics.keys())}")
        
        return response

    except Exception as e:
        print(f"Error generating heatmap: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating heatmap: {str(e)}")

@router.get("/sessions/{session_id}/correlation_metrics")
async def get_correlation_metrics(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get correlation metrics between gaze and cursor data for a session
    """
    print(f"Calculating correlation metrics for session {session_id}")
    
    # Check if session exists and belongs to user
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # Get screen dimensions from the session if available, or use defaults
        screen_width = session.screen_width if hasattr(session, 'screen_width') and session.screen_width else 1920
        screen_height = session.screen_height if hasattr(session, 'screen_height') and session.screen_height else 1080

        # Check if both gaze and cursor data exist
        gaze_count = db.query(GazeData).filter(GazeData.session_id == session_id).count()
        cursor_count = db.query(CursorData).filter(CursorData.session_id == session_id).count()
        
        print(f"Session {session_id} has {gaze_count} gaze points and {cursor_count} cursor points")
        
        if gaze_count == 0 or cursor_count == 0:
            return {
                "error": "Both gaze and cursor data are required for correlation metrics",
                "gaze_count": gaze_count,
                "cursor_count": cursor_count
            }

        # Get gaze data
        gaze_data = db.query(GazeData).filter(
            GazeData.session_id == session_id
        ).order_by(GazeData.timestamp.desc()).limit(10000).all()
        
        gaze_points = [{
            'x': point.x,
            'y': point.y,
            'timestamp': point.timestamp.timestamp() * 1000
        } for point in gaze_data if point.x is not None and point.y is not None]
        
        if not gaze_points:
            return {"error": "No valid gaze points found"}
            
        print(f"Found {len(gaze_points)} valid gaze points")

        # Get cursor data
        cursor_data = db.query(CursorData).filter(
            CursorData.session_id == session_id
        ).order_by(CursorData.timestamp.desc()).limit(10000).all()
        
        cursor_points = [{
            'x': point.x,
            'y': point.y,
            'timestamp': point.timestamp.timestamp() * 1000
        } for point in cursor_data if point.x is not None and point.y is not None]
        
        if not cursor_points:
            return {"error": "No valid cursor points found"}
            
        print(f"Found {len(cursor_points)} valid cursor points")

        # Generate both heatmaps
        print(f"Generating gaze heatmap for correlation metrics")
        gaze_heatmap_image, gaze_raw_heatmap = generate_heatmap(gaze_points, screen_width, screen_height)
        
        print(f"Generating cursor heatmap for correlation metrics")
        cursor_heatmap_image, cursor_raw_heatmap = generate_heatmap(cursor_points, screen_width, screen_height)
        
        # Log raw heatmap info
        print(f"Gaze heatmap shape: {gaze_raw_heatmap.shape}, min: {np.min(gaze_raw_heatmap)}, max: {np.max(gaze_raw_heatmap)}")
        print(f"Cursor heatmap shape: {cursor_raw_heatmap.shape}, min: {np.min(cursor_raw_heatmap)}, max: {np.max(cursor_raw_heatmap)}")
            
        # Check if shapes match and resize if needed
        if gaze_raw_heatmap.shape != cursor_raw_heatmap.shape:
            print(f"Heatmap shapes don't match! Resizing...")
            import cv2
            cursor_raw_heatmap = cv2.resize(cursor_raw_heatmap, 
                                        (gaze_raw_heatmap.shape[1], gaze_raw_heatmap.shape[0]), 
                                        interpolation=cv2.INTER_AREA)
        
        # Calculate correlation metrics
        correlation_metrics = calculate_correlation_metrics(gaze_raw_heatmap, cursor_raw_heatmap)
        
        # Print out the raw data of correlation metrics to help debug
        print("RAW CORRELATION METRICS:")
        for key, value in correlation_metrics.items():
            print(f"  {key}: {value} (type: {type(value)})")
        
        # Return the metrics with additional debug info
        return {
            **correlation_metrics,
            "_debug": {
                "gaze_points_count": len(gaze_points),
                "cursor_points_count": len(cursor_points),
                "gaze_heatmap_shape": gaze_raw_heatmap.shape,
                "cursor_heatmap_shape": cursor_raw_heatmap.shape,
                "gaze_heatmap_max": float(np.max(gaze_raw_heatmap)),
                "cursor_heatmap_max": float(np.max(cursor_raw_heatmap))
            }
        }
    except Exception as e:
        print(f"Error calculating correlation metrics: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)} 