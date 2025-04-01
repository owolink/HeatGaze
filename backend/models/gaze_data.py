from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
from app.models import Session, GazeData

# We now import models from app.models instead of defining them here

# Legacy code remains for reference but not used
"""
class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, index=True)
    screen_width = Column(Integer)
    screen_height = Column(Integer)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    gaze_points = relationship("GazePoint", back_populates="session", cascade="all, delete-orphan")
    screenshots = relationship("Screenshot", back_populates="session", cascade="all, delete-orphan")

class GazePoint(Base):
    __tablename__ = "gaze_points"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    timestamp = Column(Float)
    x = Column(Float)
    y = Column(Float)
    state = Column(Integer)  # 0: valid, -1: face lost, 1: uncalibrated
    url = Column(String)
    
    # Relationship
    session = relationship("Session", back_populates="gaze_points")
"""

class Screenshot(Base):
    __tablename__ = "screenshots"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    timestamp = Column(Float)
    image_path = Column(String)
    url = Column(String)
    stats = Column(JSON, nullable=True)
    
    # Relationship
    session = relationship("Session", back_populates="screenshots") 