from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, JSON
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

# User model
class User(Base):
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)

    # Relationships
    sessions = relationship("Session", back_populates="user")

# Session model for eye tracking sessions
class Session(Base):
    __tablename__ = "sessions"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    device_info = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    user = relationship("User", back_populates="sessions")
    gaze_data = relationship("GazeData", back_populates="session", cascade="all, delete-orphan")
    heatmaps = relationship("Heatmap", back_populates="session", cascade="all, delete-orphan")
    screenshots = relationship("Screenshot", back_populates="session", cascade="all, delete-orphan")
    cursor_data = relationship("CursorData", back_populates="session", cascade="all, delete-orphan")

# GazeData model for individual gaze data points
class GazeData(Base):
    __tablename__ = "gaze_data"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    pupil_left = Column(Float, nullable=True)
    pupil_right = Column(Float, nullable=True)

    # Relationships
    session = relationship("Session", back_populates="gaze_data")

# CursorData model for mouse movement tracking
class CursorData(Base):
    __tablename__ = "cursor_data"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)

    # Relationships
    session = relationship("Session", back_populates="cursor_data")

# Heatmap model for generated heatmap images
class Heatmap(Base):
    __tablename__ = "heatmaps"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    url = Column(String, nullable=False)
    image_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    session = relationship("Session", back_populates="heatmaps")

# Screenshot model
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