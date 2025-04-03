from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

# Eye tracking session schemas
class SessionCreate(BaseModel):
    name: str
    deviceInfo: str = None

class SessionResponse(BaseModel):
    id: int
    name: str
    device_info: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    def get_session_duration(self) -> int:
        """Calculate session duration in seconds"""
        if not self.updated_at:
            return 0
        delta = self.updated_at - self.created_at
        return int(delta.total_seconds())

# Gaze data point schemas
class GazeDataPoint(BaseModel):
    timestamp: int  # milliseconds since epoch
    x: float
    y: float
    pupilLeftSize: Optional[float] = None
    pupilRightSize: Optional[float] = None
    sessionId: int

class GazeDataCreate(BaseModel):
    gazeData: List[GazeDataPoint]

class GazeDataResponse(BaseModel):
    id: int
    session_id: int
    timestamp: datetime
    x: float
    y: float
    pupil_left: Optional[float] = None
    pupil_right: Optional[float] = None

    class Config:
        from_attributes = True

# Heatmap schemas
class HeatmapCreate(BaseModel):
    session_id: int
    url: str
    screenshot: Optional[str] = None

class HeatmapResponse(BaseModel):
    id: int
    session_id: int
    url: str
    created_at: datetime
    image_path: Optional[str] = None

    class Config:
        from_attributes = True

# Screenshot schemas
class ScreenshotCreate(BaseModel):
    timestamp: float
    image_data: str
    url: str

class ScreenshotResponse(BaseModel):
    id: int
    session_id: int
    timestamp: float
    image_path: str
    url: str
    stats: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True