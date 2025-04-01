from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import uvicorn
import os
from app.database import engine, Base
from app.models import User
from app.utils import get_db
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional

# Drop all tables and recreate with the correct schema
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="HeatGaze - Анализ тепловых карт в реальном времени")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# Import routes after app is created to avoid circular imports
from routes import gaze_data, auth, heatmap, pages

# Include routers
app.include_router(auth.router, prefix="/api", tags=["Auth"])
app.include_router(gaze_data.router, prefix="/api", tags=["Gaze Data"])
app.include_router(heatmap.router, prefix="/api", tags=["Heatmap"])
app.include_router(pages.router, prefix="/api", tags=["Demo Pages"])

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# User schema for authentication
class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    
class UserCreate(UserBase):
    password: str
    
class UserInDB(UserBase):
    id: int
    is_active: bool = True
    
    class Config:
        from_attributes = True

# Add test user on startup
@app.on_event("startup")
async def add_test_user():
    db = next(get_db())
    if not db.query(User).filter(User.username == "testuser").first():
        test_user = User(
            username="testuser",
            email="testuser@example.com",
            hashed_password="fakehashedpassword",
            is_active=True
        )
        db.add(test_user)
        db.commit()
        print("Test user created")

# Fake hash password function
def fake_hash_password(password: str):
    return "fakehashed" + password

# Get user function
def get_user(db, username: str):
    user = db.query(User).filter(User.username == username).first()
    return user

# Auth endpoints
@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = get_user(db, form_data.username)
    if not user or not user.hashed_password == fake_hash_password(form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # In a real app, generate a JWT token
    # Here we just return the username as the token for simplicity
    return {"access_token": user.username, "token_type": "bearer"}

@app.post("/register")
async def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=fake_hash_password(user.password),
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return {"message": "User registered successfully"}

@app.get("/users/me", response_model=UserInDB)
async def read_users_me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user = get_user(db, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)