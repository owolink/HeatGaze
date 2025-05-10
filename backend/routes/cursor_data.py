from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from app.utils import get_db
from app.models import Session as SessionModel, CursorData, User
from app.schemas import SessionResponse, CursorDataCreate, CursorDataResponse
from typing import List, Dict, Any
from datetime import datetime, timedelta
from routes.auth import get_current_user, create_access_token
from fastapi.responses import JSONResponse, HTMLResponse
import sys
import os
import importlib.util

# Add the parent directory to sys.path to allow importing utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Try different approaches to import the mouse_heatmap module
try:
    # First approach: direct import
    from utils.mouse_heatmap import create_mouse_heatmap, create_time_based_heatmap, create_trajectory_plot
except ImportError:
    try:
        # Second approach: absolute import with sys.path modification
        current_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(current_dir)
        utils_dir = os.path.join(parent_dir, 'utils')
        
        if utils_dir not in sys.path:
            sys.path.insert(0, utils_dir)
            
        # Try to import after path modification
        from mouse_heatmap import create_mouse_heatmap, create_time_based_heatmap, create_trajectory_plot
    except ImportError:
        # Third approach: manual module loading
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            parent_dir = os.path.dirname(current_dir)
            module_path = os.path.join(parent_dir, 'utils', 'mouse_heatmap.py')
            
            spec = importlib.util.spec_from_file_location("mouse_heatmap", module_path)
            mouse_heatmap = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mouse_heatmap)
            
            create_mouse_heatmap = mouse_heatmap.create_mouse_heatmap
            create_time_based_heatmap = mouse_heatmap.create_time_based_heatmap
            create_trajectory_plot = mouse_heatmap.create_trajectory_plot
        except Exception as e:
            print(f"Failed to import mouse_heatmap module: {e}")
            # Define stub functions as fallback
            def create_mouse_heatmap(*args, **kwargs):
                return None, {"error": "Module not available"}
            
            def create_time_based_heatmap(*args, **kwargs):
                return None, {"error": "Module not available"}
            
            def create_trajectory_plot(*args, **kwargs):
                return None, {"error": "Module not available"}

# Router
router = APIRouter()

@router.post("/sessions/{session_id}/cursor/batch")
async def save_cursor_data_batch(
    session_id: int,
    data: List[dict] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save a batch of cursor data points for a specific session"""
    print(f"Received batch of {len(data)} gaze points for session {session_id}")
    print(f"User: {current_user.username} (ID: {current_user.id})")
    print(f"Data sample: {data[0] if data else 'No data'}")
    
    # Check if session exists and belongs to user
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        print(f"Session {session_id} not found or doesn't belong to user {current_user.id}")
        raise HTTPException(status_code=404, detail="Session not found")
    
    print(f"Found session: {session.name}")
    
    # Print sample data for debugging
    if data and len(data) > 0:
        sample_point = data[0]
        print(f"Sample cursor point: {sample_point}")
        print(f"Timestamp type: {type(sample_point.get('timestamp'))}")
        print(f"X value: {sample_point.get('x')}, Y value: {sample_point.get('y')}")
    
    # Process the batch of cursor data
    points_added = 0
    try:
        for point in data:
            try:
                # Handle timestamp conversion more robustly
                timestamp = point.get('timestamp')
                if isinstance(timestamp, (int, float)):
                    # Convert milliseconds to seconds for datetime.fromtimestamp
                    timestamp_seconds = timestamp / 1000.0
                    timestamp_dt = datetime.fromtimestamp(timestamp_seconds)
                else:
                    # If it's already a string or other format, try parsing it
                    try:
                        timestamp_dt = datetime.fromisoformat(str(timestamp))
                    except:
                        # Fallback to current time if parsing fails
                        timestamp_dt = datetime.now()
                        print(f"Warning: Could not parse timestamp '{timestamp}', using current time instead")
                
                cursor_data = CursorData(
                    session_id=session_id,
                    timestamp=timestamp_dt,
                    x=float(point['x']),
                    y=float(point['y'])
                )
                db.add(cursor_data)
                points_added += 1
            except Exception as e:
                print(f"Error adding cursor point: {e}")
                print(f"Point data: {point}")
                import traceback
                print(traceback.format_exc())
        
        # Update session last updated time
        session.updated_at = datetime.now()
        
        db.commit()
        print(f"Successfully added {points_added} cursor points to session {session_id}")
    except Exception as e:
        print(f"Error committing cursor data: {e}")
        import traceback
        print(traceback.format_exc())
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save cursor data: {str(e)}")
    
    return {"status": "success", "points_added": points_added}

@router.post("/sessions/{session_id}/cursor")
async def add_cursor_data(
    session_id: int, 
    data: CursorDataCreate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add cursor data to a session"""
    print(f"Received cursor data for session {session_id}")
    print(f"Data points count: {len(data.cursorData) if hasattr(data, 'cursorData') else 'No cursorData attribute'}")
    
    # Check if session exists and belongs to user
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        print(f"Session {session_id} not found or doesn't belong to user {current_user.id}")
        raise HTTPException(status_code=404, detail="Session not found")
    
    print(f"Found session: {session.name}")
    
    # Add all cursor data points
    points_added = 0
    for point in data.cursorData:
        try:
            cursor_data = CursorData(
                session_id=session_id,
                timestamp=datetime.fromtimestamp(point.timestamp / 1000.0),
                x=point.x,
                y=point.y
            )
            db.add(cursor_data)
            points_added += 1
        except Exception as e:
            print(f"Error adding cursor point: {e}")
            print(f"Point data: {point}")
    
    # Update session last updated time
    session.updated_at = datetime.now()
    try:
        db.commit()
        print(f"Successfully added {points_added} cursor points to session {session_id}")
    except Exception as e:
        print(f"Error committing cursor data: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save cursor data: {str(e)}")
    
    return {"status": "success", "points_added": points_added}

@router.get("/sessions/{session_id}/cursor")
async def get_cursor_points(
    session_id: int,
    offset: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get cursor data points for a session with pagination"""
    try:
        # Get total count
        total = db.query(CursorData).filter(CursorData.session_id == session_id).count()
        
        # Get paginated cursor points
        cursor_points = db.query(CursorData).filter(CursorData.session_id == session_id)\
            .order_by(CursorData.timestamp)\
            .offset(offset)\
            .limit(limit)\
            .all()
        
        # Format points for frontend
        formatted_points = []
        for point in cursor_points:
            formatted_points.append({
                "id": point.id,
                "timestamp": point.timestamp,
                "x": point.x,
                "y": point.y
            })
        
        # Return as dictionary with points and metadata to match frontend expectations
        return {
            "points": formatted_points,
            "total": total,
            "count": len(formatted_points),
            "offset": offset,
            "limit": limit,
            "hasMore": (offset + limit) < total
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching cursor points: {str(e)}"
        )

@router.get("/sessions/{session_id}/cursor-data")
async def get_cursor_data_points(
    session_id: int,
    offset: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Alias for get_cursor_points to match frontend expectations"""
    # Simply call the existing implementation
    return await get_cursor_points(
        session_id=session_id,
        offset=offset,
        limit=limit,
        db=db,
        current_user=current_user
    )

@router.get("/sessions/{session_id}/cursor/heatmap")
async def get_cursor_heatmap(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get cursor data formatted for heatmap generation"""
    # Check if session exists and belongs to user
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get all cursor points for this session
    cursor_points = db.query(CursorData).filter(
        CursorData.session_id == session_id
    ).all()
    
    # Format data for heatmap generation
    heatmap_data = []
    for point in cursor_points:
        heatmap_data.append({
            "x": point.x,
            "y": point.y,
            "value": 1  # Each point has equal weight
        })
    
    return {
        "points": heatmap_data,
        "count": len(heatmap_data)
    }

@router.get("/sessions/{session_id}/cursor/heatmap/plotly")
async def get_cursor_plotly_heatmap(
    session_id: int,
    width: int = 1920,
    height: int = 1080,
    bin_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate a plotly heatmap for cursor data"""
    # Check if session exists and belongs to user
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get all cursor points for this session
    cursor_points = db.query(CursorData).filter(
        CursorData.session_id == session_id
    ).all()
    
    # Format data for heatmap generation
    formatted_points = []
    for point in cursor_points:
        formatted_points.append({
            "x": float(point.x),
            "y": float(point.y),
            "timestamp": int(point.timestamp.timestamp() * 1000)  # Convert to milliseconds
        })
    
    if not formatted_points:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"message": "No cursor data found for this session"}
        )
    
    # Generate heatmap
    try:
        heatmap_img, stats = create_mouse_heatmap(
            formatted_points, 
            width=width, 
            height=height, 
            bin_size=bin_size
        )
        
        if not heatmap_img:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"message": "Failed to generate heatmap - insufficient data"}
            )
        
        return {
            "image": heatmap_img,
            "stats": stats,
            "count": len(formatted_points)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating heatmap: {str(e)}"
        )

@router.get("/sessions/{session_id}/cursor/heatmap/time-based")
async def get_cursor_time_based_heatmap(
    session_id: int,
    width: int = 1920,
    height: int = 1080,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate a time-based heatmap showing dwell times"""
    # Check if session exists and belongs to user
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get all cursor points for this session
    cursor_points = db.query(CursorData).filter(
        CursorData.session_id == session_id
    ).all()
    
    # Format data for heatmap generation
    formatted_points = []
    for point in cursor_points:
        formatted_points.append({
            "x": float(point.x),
            "y": float(point.y),
            "timestamp": int(point.timestamp.timestamp() * 1000)  # Convert to milliseconds
        })
    
    if not formatted_points:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"message": "No cursor data found for this session"}
        )
    
    # Generate time-based heatmap
    try:
        heatmap_img, stats = create_time_based_heatmap(
            formatted_points, 
            width=width, 
            height=height
        )
        
        if not heatmap_img:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"message": "Failed to generate time-based heatmap - insufficient data"}
            )
        
        return {
            "image": heatmap_img,
            "stats": stats,
            "count": len(formatted_points)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating time-based heatmap: {str(e)}"
        )

@router.get("/sessions/{session_id}/cursor/trajectory")
async def get_cursor_trajectory(
    session_id: int,
    width: int = 1920,
    height: int = 1080,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate a trajectory plot of mouse movements"""
    # Check if session exists and belongs to user
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get all cursor points for this session
    cursor_points = db.query(CursorData).filter(
        CursorData.session_id == session_id
    ).all()
    
    # Format data for trajectory generation
    formatted_points = []
    for point in cursor_points:
        formatted_points.append({
            "x": float(point.x),
            "y": float(point.y),
            "timestamp": int(point.timestamp.timestamp() * 1000)  # Convert to milliseconds
        })
    
    if not formatted_points:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"message": "No cursor data found for this session"}
        )
    
    # Generate trajectory plot
    try:
        trajectory_img, stats = create_trajectory_plot(
            formatted_points, 
            width=width, 
            height=height
        )
        
        if not trajectory_img:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"message": "Failed to generate trajectory plot - insufficient data"}
            )
        
        return {
            "image": trajectory_img,
            "stats": stats,
            "count": len(formatted_points)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating trajectory plot: {str(e)}"
        )

@router.get("/cursor/debug")
async def debug_cursor_heatmap():
    """Debugging endpoint to check if the mouse_heatmap module is correctly loaded"""
    try:
        # Check imports
        import_results = {
            "pandas": False,
            "numpy": False,
            "plotly": False,
            "kaleido": False,
            "io": False,
            "base64": False
        }
        
        try:
            import pandas as pd
            import_results["pandas"] = True
        except ImportError:
            pass
            
        try:
            import numpy as np
            import_results["numpy"] = True
        except ImportError:
            pass
            
        try:
            import plotly
            import_results["plotly"] = True
        except ImportError:
            pass
            
        try:
            import kaleido
            import_results["kaleido"] = True
        except ImportError:
            pass
            
        try:
            import io
            import_results["io"] = True
        except ImportError:
            pass
            
        try:
            import base64
            import_results["base64"] = True
        except ImportError:
            pass
        
        # Create a simple test dataset
        test_data = [
            {"x": 100, "y": 100, "timestamp": 1612345678000},
            {"x": 200, "y": 150, "timestamp": 1612345679000},
            {"x": 300, "y": 200, "timestamp": 1612345680000},
            {"x": 250, "y": 250, "timestamp": 1612345681000},
            {"x": 150, "y": 300, "timestamp": 1612345682000}
        ]
        
        # Try to generate a simple heatmap
        img, stats = create_mouse_heatmap(test_data, width=800, height=600, bin_size=100)
        
        # Get module source
        module_source = "Unknown"
        if hasattr(sys.modules[create_mouse_heatmap.__module__], "__file__"):
            module_source = os.path.abspath(sys.modules[create_mouse_heatmap.__module__].__file__)
        
        # Verify modules list
        modules_list = [m for m in sys.modules.keys() if 'heat' in m.lower() or 'mouse' in m.lower() or 'cursor' in m.lower()]
        
        return {
            "status": "success",
            "module_loaded": True,
            "test_data_size": len(test_data),
            "image_generated": img is not None,
            "stats": stats,
            "import_path": module_source,
            "import_results": import_results,
            "related_modules": modules_list,
            "utils_path": os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'utils')),
            "sys_path": sys.path
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "module_loaded": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "sys_path": sys.path
        }

@router.get("/test-cursor-tracking", response_class=HTMLResponse)
async def test_cursor_tracking(db: Session = Depends(get_db)):
    """A simple page to test cursor tracking without authentication"""
    
    # Import User model at the beginning of the function
    from app.models import User
    
    # Create a test user if it doesn't exist
    test_user = db.query(User).filter(User.id == 1).first()
    if not test_user:
        try:
            # Create a test user
            test_user = User(
                id=1,
                username="test_user",
                email="test@example.com",
                full_name="Test User"
            )
            db.add(test_user)
            db.commit()
        except Exception as e:
            print(f"Error creating test user: {e}")
    
    # Create a test session
    test_session = None
    try:
        # Create a new session for testing
        from app.models import Session as SessionModel
        test_session = SessionModel(
            name=f"Cursor Test {datetime.now()}",
            device_info="Test Browser",
            user_id=1
        )
        db.add(test_session)
        db.commit()
        db.refresh(test_session)
        print(f"Created test session ID: {test_session.id}")
    except Exception as e:
        print(f"Error creating test session: {e}")
        # Try to use an existing session
        test_session = db.query(SessionModel).filter(SessionModel.user_id == 1).order_by(SessionModel.id.desc()).first()
        if test_session:
            print(f"Using existing session ID: {test_session.id}")
    
    # Get session ID for the test
    session_id = test_session.id if test_session else 0
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Cursor Tracking Test (No Auth)</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }}
            #status {{
                background-color: #f0f0f0;
                padding: 10px;
                border-radius: 5px;
                margin-bottom: 20px;
            }}
            #canvas {{
                border: 1px solid #ccc;
                display: block;
                margin: 20px 0;
            }}
            button {{
                padding: 10px 15px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
            }}
            button:disabled {{
                background-color: #cccccc;
            }}
            #log {{
                height: 200px;
                overflow-y: auto;
                border: 1px solid #ccc;
                padding: 10px;
                margin-top: 10px;
                font-family: monospace;
                background-color: #f9f9f9;
            }}
        </style>
    </head>
    <body>
        <h1>Cursor Tracking Test (No Auth)</h1>
        <div id="status">Status: Ready to track cursor data</div>
        
        <div>
            <p><strong>Session ID:</strong> {session_id}</p>
            <p>Move your mouse over the canvas area below to generate cursor data points</p>
        </div>
        
        <button id="startBtn">Start Tracking</button>
        <button id="stopBtn" disabled>Stop Tracking</button>
        
        <canvas id="canvas" width="800" height="400"></canvas>
        
        <h3>Log:</h3>
        <div id="log"></div>
        
        <script>
            // DOM elements
            const statusEl = document.getElementById('status');
            const startBtn = document.getElementById('startBtn');
            const stopBtn = document.getElementById('stopBtn');
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            const logEl = document.getElementById('log');
            
            // State
            const sessionId = {session_id};
            let isTracking = false;
            let cursorData = [];
            let batchInterval = null;
            
            // Log helper function
            function log(message) {{
                const now = new Date();
                const timestamp = now.toLocaleTimeString() + '.' + now.getMilliseconds().toString().padStart(3, '0');
                logEl.innerHTML += `<div>[${{timestamp}}] ${{message}}</div>`;
                logEl.scrollTop = logEl.scrollHeight;
            }}
            
            // Start cursor tracking
            function startTracking() {{
                log('Starting cursor tracking...');
                statusEl.textContent = 'Status: Tracking cursor movements';
                
                // Reset cursor data
                cursorData = [];
                isTracking = true;
                
                // Start tracking cursor
                canvas.addEventListener('mousemove', trackCursor);
                document.addEventListener('mousemove', trackCursor);
                
                // Start batch sending
                batchInterval = setInterval(sendCursorBatch, 2000);
                
                // Update UI
                startBtn.disabled = true;
                stopBtn.disabled = false;
                
                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }}
            
            // Stop cursor tracking
            async function stopTracking() {{
                log('Stopping cursor tracking...');
                statusEl.textContent = 'Status: Stopping tracking...';
                
                // Stop tracking
                isTracking = false;
                canvas.removeEventListener('mousemove', trackCursor);
                document.removeEventListener('mousemove', trackCursor);
                
                // Clear interval
                if (batchInterval) {{
                    clearInterval(batchInterval);
                    batchInterval = null;
                }}
                
                // Send any remaining data
                await sendCursorBatch();
                
                // Update UI
                statusEl.textContent = 'Status: Tracking stopped';
                startBtn.disabled = false;
                stopBtn.disabled = true;
                
                // Show links to view results
                log(`Cursor tracking completed for session #${{sessionId}}`);
                log(`<a href="/api/sessions/${{sessionId}}/cursor/heatmap/plotly" target="_blank">View density heatmap</a>`);
                log(`<a href="/api/sessions/${{sessionId}}/cursor/heatmap/time-based" target="_blank">View time-based heatmap</a>`);
                log(`<a href="/api/sessions/${{sessionId}}/cursor/trajectory" target="_blank">View cursor trajectory</a>`);
            }}
            
            // Track cursor position
            function trackCursor(e) {{
                if (!isTracking) return;
                
                // Get position
                const x = e.clientX;
                const y = e.clientY;
                
                // Draw on canvas if the event is from canvas
                if (e.target === canvas) {{
                    const rect = canvas.getBoundingClientRect();
                    const canvasX = x - rect.left;
                    const canvasY = y - rect.top;
                    
                    ctx.beginPath();
                    ctx.arc(canvasX, canvasY, 2, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                    ctx.fill();
                }}
                
                // Add to batch
                cursorData.push({{
                    x: x,
                    y: y,
                    timestamp: Date.now()
                }});
                
                // Log every 10th point to avoid flooding
                if (cursorData.length % 10 === 0) {{
                    log(`Tracking cursor at x=${{x}}, y=${{y}} (${{cursorData.length}} points)`);
                }}
                
                // Send immediately if batch is large
                if (cursorData.length >= 50) {{
                    sendCursorBatch();
                }}
            }}
            
            // Send cursor data batch
            async function sendCursorBatch() {{
                if (cursorData.length === 0) return;
                
                try {{
                    const batchToSend = [...cursorData];
                    cursorData = [];
                    
                    log(`Sending batch of ${{batchToSend.length}} cursor points...`);
                    
                    // Direct endpoint with no authentication
                    const response = await fetch(`/api/sessions/${{sessionId}}/cursor/batch-no-auth`, {{
                        method: 'POST',
                        headers: {{
                            'Content-Type': 'application/json'
                        }},
                        body: JSON.stringify(batchToSend)
                    }});
                    
                    if (!response.ok) {{
                        throw new Error(`Failed to send cursor batch: ${{response.status}}`);
                    }}
                    
                    const result = await response.json();
                    log(`Successfully sent ${{result.points_added}} cursor points`);
                    
                }} catch (error) {{
                    log(`Error sending cursor batch: ${{error.message}}`);
                    // Put points back in the queue
                    cursorData = [...batchToSend, ...cursorData];
                }}
            }}
            
            // Event listeners
            startBtn.addEventListener('click', startTracking);
            stopBtn.addEventListener('click', stopTracking);
            
            // Initialization
            log(`Test page loaded for session #${{sessionId}}`);
            log('Click "Start Tracking" to begin recording cursor movements');
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@router.post("/sessions/{session_id}/cursor/batch-no-auth")
async def save_cursor_data_batch_no_auth(
    session_id: int,
    data: List[dict] = Body(...),
    db: Session = Depends(get_db)
):
    """Save a batch of cursor data points without authentication (for testing only)"""
    print(f"Received batch of {len(data)} cursor points for session {session_id} (no auth)")
    
    # Check if session exists (no user check)
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id
    ).first()
    
    if not session:
        print(f"Session {session_id} not found")
        raise HTTPException(status_code=404, detail="Session not found")
    
    print(f"Found session: {session.name}")
    
    # Process the batch of cursor data
    points_added = 0
    for point in data:
        try:
            cursor_data = CursorData(
                session_id=session_id,
                timestamp=datetime.fromtimestamp(point['timestamp'] / 1000.0),
                x=point['x'],
                y=point['y']
            )
            db.add(cursor_data)
            points_added += 1
        except Exception as e:
            print(f"Error adding cursor point: {e}")
            print(f"Point data: {point}")
    
    # Update session last updated time
    session.updated_at = datetime.now()
    try:
        db.commit()
        print(f"Successfully added {points_added} cursor points to session {session_id}")
    except Exception as e:
        print(f"Error committing cursor data: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save cursor data: {str(e)}")
    
    return {"status": "success", "points_added": points_added}

@router.get("/cursor/debug-token", response_class=JSONResponse)
async def debug_cursor_token():
    """Get a debug token for cursor tracking testing"""
    # Create a test token with 1 day expiry
    try:
        # Create a token with user_id 1 (assuming user 1 exists)
        access_token_expires = timedelta(days=1)
        access_token = create_access_token(
            data={"sub": "1"}, # This should be a valid user ID in your database
            expires_delta=access_token_expires
        )
        return {"token": access_token, "test_url": f"/api/test-cursor-tracking?token={access_token}"}
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        } 