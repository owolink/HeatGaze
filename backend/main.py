from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
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
from routes.auth import get_password_hash  # Import the proper password hashing function

# Drop all tables and recreate with the correct schema
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="HeatGaze - Анализ тепловых карт в реальном времени")

# Setup CORS - adding explicit WebSocket support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
    expose_headers=["*"]
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
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token")

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
            hashed_password=get_password_hash("password"),  # Use proper hashing
            is_active=True
        )
        db.add(test_user)
        db.commit()
        print("Test user created")

# Remove the duplicate authentication endpoints
# We will use the ones from routes/auth.py instead
# This means we need to delete the login, register, and users/me endpoints

# Add a fallback token endpoint at the root path
@app.post("/token")
async def token_fallback(request: Request):
    """
    Redirect /token requests to /api/token for backward compatibility
    """
    # Get the full url for the request
    url = request.url
    # Replace the path with /api/token
    redirect_url = str(url).replace("/token", "/api/token")
    # Return a redirect
    return RedirectResponse(url=redirect_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# WebSocket route for development (returning 204 instead of 403 for React hot reloading)
@app.get("/ws")
async def websocket_dummy_endpoint():
    # This is just a dummy endpoint to prevent 403 errors
    # React development server uses this for hot reloading
    # Return 204 No Content instead of 403 Forbidden
    return JSONResponse(status_code=204, content={})

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)