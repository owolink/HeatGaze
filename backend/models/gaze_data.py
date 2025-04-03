from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from app.utils import get_db
from app.models import Session as SessionModel, GazeData, User
from app.schemas import SessionCreate, SessionResponse, GazeDataCreate
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
import json

# Models for legacy routes - should be moved to schemas.py
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

# Batch processing model for gaze data
class GazeBatchData(BaseModel):
    timestamp: float
    x: float
    y: float
    state: Optional[int] = 0
    url: Optional[str] = "" 