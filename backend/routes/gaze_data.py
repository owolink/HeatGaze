from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from app.utils import get_db
from app.models import Session as SessionModel, GazeData, User, Screenshot
from app.schemas import SessionCreate, SessionResponse, GazeDataCreate, ScreenshotCreate, ScreenshotResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
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
async def create_session(
    session: SessionCreate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new eye tracking session"""
    current_time = datetime.now()
    db_session = SessionModel(
        name=session.name,
        device_info=session.deviceInfo,
        created_at=current_time,
        updated_at=current_time,  # Set initial updated_at to match created_at
        user_id=current_user.id  # Associate session with authenticated user
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@router.get("/sessions", response_model=List[SessionResponse])
async def get_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all sessions for the authenticated user"""
    sessions = db.query(SessionModel).filter(
        SessionModel.user_id == current_user.id
    ).order_by(SessionModel.created_at.desc()).all()
    
    # Enhance session data with additional fields
    enhanced_sessions = []
    for session in sessions:
        # Count gaze data points
        gaze_count = db.query(GazeData).filter(GazeData.session_id == session.id).count()
        
        # Calculate duration
        duration = 0
        if session.updated_at:
            duration = int((session.updated_at - session.created_at).total_seconds())
        
        # Create enhanced session data
        session_dict = {
            "id": session.id,
            "name": session.name,
            "device_info": session.device_info,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "has_recording": gaze_count > 0,
            "recording_count": gaze_count,
            "duration": duration,
            "username": current_user.username
        }
        
        enhanced_sessions.append(session_dict)
    
    return enhanced_sessions

@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific session by ID if it belongs to the authenticated user"""
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Count gaze data points
    gaze_count = db.query(GazeData).filter(GazeData.session_id == session.id).count()
    
    # Calculate duration
    duration = 0
    if session.updated_at:
        duration = int((session.updated_at - session.created_at).total_seconds())
    
    # Look for screenshots that might contain video information
    screenshots = db.query(Screenshot).filter(Screenshot.session_id == session.id).all()
    
    # Always generate a video URL based on session ID, regardless of gaze count
    # This ensures the frontend can always attempt to load the video
    video_url = f"/api/videos/{session.id}/recording.mp4"
    
    # Create enhanced session data
    session_dict = {
        "id": session.id,
        "name": session.name,
        "device_info": session.device_info,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "has_recording": gaze_count > 0,
        "recording_count": gaze_count,
        "duration": duration,
        "username": current_user.username,
        "video_url": video_url,  # Always provide a video URL
        "screenshots": [screenshot.image_path for screenshot in screenshots[:5]] if screenshots else []
    }
    
    return session_dict

@router.post("/sessions/{session_id}/data")
async def add_gaze_data(
    session_id: int, 
    data: GazeDataCreate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add gaze data to a session"""
    print(f"Received gaze data for session {session_id}")
    print(f"Data points count: {len(data.gazeData) if hasattr(data, 'gazeData') else 'No gazeData attribute'}")
    
    # Check if session exists and belongs to user
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        print(f"Session {session_id} not found or doesn't belong to user {current_user.id}")
        raise HTTPException(status_code=404, detail="Session not found")
    
    print(f"Found session: {session.name}")
    
    # Add all gaze data points
    points_added = 0
    for point in data.gazeData:
        try:
            gaze_data = GazeData(
                session_id=session_id,
                timestamp=datetime.fromtimestamp(point.timestamp / 1000.0),
                x=point.x,
                y=point.y,
                pupil_left=point.pupilLeftSize,
                pupil_right=point.pupilRightSize
            )
            db.add(gaze_data)
            points_added += 1
        except Exception as e:
            print(f"Error adding gaze point: {e}")
            print(f"Point data: {point}")
    
    # Update session last updated time
    session.updated_at = datetime.now()
    try:
        db.commit()
        print(f"Successfully added {points_added} gaze points to session {session_id}")
    except Exception as e:
        print(f"Error committing gaze data: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save gaze data: {str(e)}")
    
    return {"status": "success", "points_added": points_added}

@router.post("/sessions/{session_id}/gaze/batch")
async def save_gaze_data_batch(
    session_id: int,
    data: List[dict] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save a batch of gaze data points for a specific session"""
    print(f"Received batch of {len(data)} gaze points for session {session_id}")
    
    # Check if session exists and belongs to user
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        print(f"Session {session_id} not found or doesn't belong to user {current_user.id}")
        raise HTTPException(status_code=404, detail="Session not found")
    
    print(f"Found session: {session.name}")
    
    # Process the batch of gaze data
    points_added = 0
    for point in data:
        try:
            gaze_data = GazeData(
                session_id=session_id,
                timestamp=datetime.fromtimestamp(point['timestamp'] / 1000.0),
                x=point['x'],
                y=point['y'],
                pupil_left=None,  # These fields might not be in the data
                pupil_right=None  # These fields might not be in the data
            )
            db.add(gaze_data)
            points_added += 1
        except Exception as e:
            print(f"Error adding gaze point: {e}")
            print(f"Point data: {point}")
    
    # Update session last updated time
    session.updated_at = datetime.now()
    try:
        db.commit()
        print(f"Successfully added {points_added} gaze points to session {session_id}")
    except Exception as e:
        print(f"Error committing gaze data: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save gaze data: {str(e)}")
    
    return {"status": "success", "points_added": points_added}

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

@router.get("/sessions/{session_id}/gaze")
async def get_gaze_points(
    session_id: int,
    offset: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Get total count
        total = db.query(GazeData).filter(GazeData.session_id == session_id).count()
        
        # Get paginated gaze points
        gaze_points = db.query(GazeData).filter(GazeData.session_id == session_id)\
            .order_by(GazeData.timestamp)\
            .offset(offset)\
            .limit(limit)\
            .all()
        
        # Format points for frontend
        formatted_points = []
        for point in gaze_points:
            formatted_points.append({
                "id": point.id,
                "timestamp": point.timestamp,
                "x": point.x,
                "y": point.y,
                "state": "default",  # Default state since it's not in the model
                "url": ""  # Default URL since it's not in the model
            })
        
        # Return data in the expected format based on the frontend's SessionPlayer component
        # Return points directly instead of wrapping them in an object
        return formatted_points
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching gaze points: {str(e)}"
        )

# Add the new endpoint with the correct URL path
@router.get("/sessions/{session_id}/gaze-data")
async def get_gaze_data_points(
    session_id: int,
    offset: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Alias for get_gaze_points to match frontend expectations"""
    # Simply call the existing implementation
    return await get_gaze_points(
        session_id=session_id,
        offset=offset,
        limit=limit,
        db=db,
        current_user=current_user
    )

# Comment out legacy routes that use get_current_user until we fix the auth system
"""
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

@router.put("/sessions/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if session exists and belongs to the user
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update session with end time
    session.updated_at = datetime.now()
    db.commit()
    db.refresh(session)
    
    return session

@router.post("/sessions/{session_id}/screenshots", response_model=ScreenshotResponse)
async def add_screenshot(
    session_id: int,
    screenshot_data: ScreenshotCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if session exists and belongs to the user
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # Ensure directory exists
        os.makedirs("static/screenshots", exist_ok=True)
        
        # Process the image data
        import base64
        from PIL import Image
        import io
        
        # Decode base64 image
        if ',' in screenshot_data.image_data:
            img_data = base64.b64decode(screenshot_data.image_data.split(',')[1])
        else:
            img_data = base64.b64decode(screenshot_data.image_data)
            
        img = Image.open(io.BytesIO(img_data))
        
        # Save image
        filename = f"screenshot_{session_id}_{int(screenshot_data.timestamp)}.png"
        filepath = f"static/screenshots/{filename}"
        img.save(filepath)
        
        # Save to db
        screenshot = Screenshot(
            session_id=session_id,
            timestamp=screenshot_data.timestamp,
            image_path=filepath,
            url=screenshot_data.url
        )
        
        db.add(screenshot)
        db.commit()
        db.refresh(screenshot)
        
        return screenshot
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error saving screenshot: {str(e)}")

@router.get("/sessions/{session_id}/screenshots", response_model=List[ScreenshotResponse])
async def get_screenshots(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if session exists and belongs to the user
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    screenshots = db.query(Screenshot).filter(Screenshot.session_id == session_id).all()
    
    return screenshots 