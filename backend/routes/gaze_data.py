from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from app.utils import get_db
from app.models import Session as SessionModel, GazeData, User
from app.schemas import SessionCreate, SessionResponse, GazeDataCreate
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from routes.auth import get_current_user
import os
import json

# Import the needed auth function (uncomment if you have this in routes/auth.py)
# from routes.auth import get_current_user

# Router
router = APIRouter()

# Legacy models - should be moved to schemas.py
class LegacySessionCreate(BaseModel):
    name: str
    screen_width: int
    screen_height: int
    deviceInfo: str

class SessionOut(BaseModel):
    id: int
    name: str
    screen_width: int
    screen_height: int
    start_time: datetime
    end_time: Optional[datetime] = None

    class Config:
        from_attributes = True

class GazePointCreate(BaseModel):
    timestamp: float
    x: float
    y: float
    state: int
    url: str

class GazePointOut(BaseModel):
    id: int
    timestamp: float
    x: float
    y: float
    state: int
    url: str

    class Config:
        from_attributes = True

class ScreenshotCreate(BaseModel):
    timestamp: float
    image_data: str  # base64 encoded
    url: str

class ScreenshotOut(BaseModel):
    id: int
    timestamp: float
    image_path: str
    url: str
    stats: Optional[dict] = None

    class Config:
        from_attributes = True

# Routes
@router.post("/sessions", response_model=SessionResponse)
async def create_session(session: SessionCreate, db: Session = Depends(get_db)):
    """Create a new eye tracking session"""
    db_session = SessionModel(
        name=session.name,
        device_info=session.deviceInfo,
        created_at=datetime.now()
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@router.get("/sessions", response_model=List[SessionResponse])
async def get_sessions(db: Session = Depends(get_db)):
    """Get all sessions"""
    sessions = db.query(SessionModel).order_by(SessionModel.created_at.desc()).all()
    return sessions

@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: int, db: Session = Depends(get_db)):
    """Get a specific session by ID"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.post("/sessions/{session_id}/data")
async def add_gaze_data(session_id: int, data: GazeDataCreate, db: Session = Depends(get_db)):
    """Add gaze data to a session"""
    # Check if session exists
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Add all gaze data points
    for point in data.gazeData:
        gaze_data = GazeData(
            session_id=session_id,
            timestamp=datetime.fromtimestamp(point.timestamp / 1000.0),
            x=point.x,
            y=point.y,
            pupil_left=point.pupilLeftSize,
            pupil_right=point.pupilRightSize
        )
        db.add(gaze_data)
    
    # Update session last updated time
    session.updated_at = datetime.now()
    db.commit()
    
    return {"status": "success", "points_added": len(data.gazeData)}

@router.post("/batch")
async def save_gaze_data_batch(
    data: List[GazeDataCreate], 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save a batch of gaze data points"""
    try:
        # Process the batch of gaze data
        count = 0
        for point in data:
            gaze_data = GazeData(
                session_id=point.session_id,
                timestamp=datetime.fromtimestamp(point.timestamp / 1000.0),
                x=point.x,
                y=point.y,
                pupil_left=point.pupil_left,
                pupil_right=point.pupil_right
            )
            db.add(gaze_data)
            count += 1
        
        db.commit()
        return {"success": True, "points_saved": count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save gaze data batch: {str(e)}")

# Comment out legacy routes that use get_current_user until we fix the auth system
"""
@router.put("/sessions/{session_id}/end", response_model=SessionOut)
async def end_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(GazeSession).filter(
        GazeSession.id == session_id,
        GazeSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    
    session.end_time = datetime.now()
    db.commit()
    db.refresh(session)
    
    return session

@router.post("/sessions/{session_id}/gaze", response_model=GazePointOut)
async def add_gaze_point(
    session_id: int,
    gaze_point: GazePointCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(GazeSession).filter(
        GazeSession.id == session_id,
        GazeSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    
    db_gaze_point = GazePoint(
        session_id=session_id,
        timestamp=gaze_point.timestamp,
        x=gaze_point.x,
        y=gaze_point.y,
        state=gaze_point.state,
        url=gaze_point.url
    )
    
    db.add(db_gaze_point)
    db.commit()
    db.refresh(db_gaze_point)
    
    return db_gaze_point
"""

@router.post("/sessions/{session_id}/gaze/batch", response_model=dict)
async def add_gaze_points_batch(
    session_id: int,
    gaze_points: List[GazePointCreate] = Body(...),
    db: Session = Depends(get_db)
):
    # Check if session exists
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    for point in gaze_points:
        db_gaze_point = GazeData(
            session_id=session_id,
            timestamp=datetime.fromtimestamp(point.timestamp / 1000.0),
            x=point.x,
            y=point.y,
            state=point.state if hasattr(point, 'state') else 0,
            url=point.url if hasattr(point, 'url') else ""
        )
        db.add(db_gaze_point)
    
    # Update session last updated time
    session.updated_at = datetime.now()
    db.commit()
    
    return {"status": "success", "count": len(gaze_points)}

# Comment out legacy routes that use get_current_user until we fix the auth system
"""
@router.get("/sessions/{session_id}/gaze", response_model=List[GazePointOut])
async def get_gaze_points(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(GazeSession).filter(
        GazeSession.id == session_id,
        GazeSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    
    gaze_points = db.query(GazePoint).filter(GazePoint.session_id == session_id).all()
    
    return gaze_points

@router.post("/sessions/{session_id}/screenshots", response_model=ScreenshotOut)
async def add_screenshot(
    session_id: int,
    screenshot: ScreenshotCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(GazeSession).filter(
        GazeSession.id == session_id,
        GazeSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    
    # Ensure directory exists
    os.makedirs("static/screenshots", exist_ok=True)
    
    # Save image
    import base64
    from app.utils import calculate_heatmap_stats
    import cv2
    import numpy as np
    from PIL import Image
    import io
    
    # Decode base64 image
    img_data = base64.b64decode(screenshot.image_data.split(',')[1])
    img = Image.open(io.BytesIO(img_data))
    
    # Save image
    filename = f"screenshot_{session_id}_{int(screenshot.timestamp)}.png"
    filepath = f"static/screenshots/{filename}"
    img.save(filepath)
    
    # Calculate stats
    img_array = np.array(img)
    if len(img_array.shape) > 2:  # RGB image
        img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    stats = calculate_heatmap_stats(img_array)
    
    # Save to db
    db_screenshot = Screenshot(
        session_id=session_id,
        timestamp=screenshot.timestamp,
        image_path=filepath,
        url=screenshot.url,
        stats=stats
    )
    
    db.add(db_screenshot)
    db.commit()
    db.refresh(db_screenshot)
    
    return db_screenshot

@router.get("/sessions/{session_id}/screenshots", response_model=List[ScreenshotOut])
async def get_screenshots(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(GazeSession).filter(
        GazeSession.id == session_id,
        GazeSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    
    screenshots = db.query(Screenshot).filter(Screenshot.session_id == session_id).all()
    
    return screenshots
""" 