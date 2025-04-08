import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './SessionPlayer.css';

const SessionPlayer = ({ sessionId }) => {
  console.log('SessionPlayer component initialized with sessionId:', sessionId);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [session, setSession] = useState(null);
  const [gazeData, setGazeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.7);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [currentBatch, setCurrentBatch] = useState(0);
  const BATCH_SIZE = 1000;
  
  const canvasRef = useRef(null);
  const heatmapCanvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastFrameTimeRef = useRef(null);
  
  // Load session data
  useEffect(() => {
    const fetchSessionData = async () => {
      console.log('Fetching session data for sessionId:', sessionId);
      try {
        setLoading(true);
        setError(null);
        
        // Fetch session details - using the endpoint that exists in the backend
        console.log('About to request session details from:', `/api/sessions/${sessionId}`);
        try {
          const sessionResponse = await api.get(`/api/sessions/${sessionId}`);
          console.log('Session data received:', sessionResponse.data);
          console.log('Session has recording:', sessionResponse.data.has_recording);
          console.log('Session recording count:', sessionResponse.data.recording_count);
          setSession(sessionResponse.data);
        } catch (err) {
          console.error('Error fetching session:', err);
          setError('Session API endpoint not available. This feature may not be implemented yet.');
        }
        
        // Fetch gaze data - using the endpoint that exists in the backend
        console.log('About to request gaze data from:', `/api/sessions/${sessionId}/gaze`);
        try {
          const gazeResponse = await api.get(`/api/sessions/${sessionId}/gaze`);
          console.log('Gaze data response:', gazeResponse.data);
          const gazePoints = gazeResponse.data.points || [];
          console.log('Gaze points count:', gazePoints.length);
          console.log('First gaze point:', gazePoints[0]);
          console.log('Last gaze point:', gazePoints[gazePoints.length - 1]);
          setGazeData(gazePoints);
          
          // Calculate duration based on first and last timestamp
          if (gazePoints.length > 0) {
            const firstTime = new Date(gazePoints[0].timestamp).getTime();
            const lastTime = new Date(gazePoints[gazePoints.length - 1].timestamp).getTime();
            const durationMs = lastTime - firstTime;
            setDuration(durationMs);
            console.log('Session duration calculated:', durationMs);
          } else {
            console.log('No gaze data received to calculate duration');
          }
          
          setHasMoreData(gazePoints.length === BATCH_SIZE);
        } catch (err) {
          console.error('Error fetching gaze data:', err);
          console.error('Error details:', err.response?.data || err.message);
          if (!error) { // Only set if we don't already have an error
            setError('Gaze data API endpoint not available. This feature may not be implemented yet.');
          }
        }
        
      } catch (err) {
        console.error('Error in fetching session data:', err);
        setError('Failed to load session data. API endpoints may not be implemented yet.');
      } finally {
        setLoading(false);
        console.log('Loading state set to false');
      }
    };
    
    if (sessionId) {
      console.log('SessionId is present, calling fetchSessionData()');
      fetchSessionData();
    } else {
      console.warn('No sessionId provided to SessionPlayer component');
      setError('No session ID provided to the player component.');
    }
    
    // Cleanup function
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [sessionId]);
  
  // Animation loop for playback
  useEffect(() => {
    if (!isPlaying || !gazeData.length) return;
    
    const animate = (timestamp) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
        lastFrameTimeRef.current = timestamp;
      }
      
      // Calculate elapsed time in the animation
      const elapsedTime = timestamp - startTimeRef.current;
      
      // Calculate current position in the session based on elapsed time and playback speed
      const sessionPosition = (elapsedTime * playbackSpeed) % duration;
      setCurrentTime(sessionPosition);
      
      // Find all gaze points up to the current position
      const sessionStartTime = new Date(gazeData[0].timestamp).getTime();
      const currentTimestamp = sessionStartTime + sessionPosition;
      const visiblePoints = gazeData.filter(point => 
        new Date(point.timestamp).getTime() <= currentTimestamp
      );
      
      // Draw the current state
      drawFrame(visiblePoints);
      
      // Continue animation
      lastFrameTimeRef.current = timestamp;
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, gazeData, duration, playbackSpeed]);
  
  // Draw a single frame with gaze points and heatmap
  const drawFrame = (points) => {
    const canvas = canvasRef.current;
    const heatmapCanvas = heatmapCanvasRef.current;
    
    if (!canvas || !heatmapCanvas) return;
    
    const ctx = canvas.getContext('2d');
    const heatmapCtx = heatmapCanvas.getContext('2d');
    
    // Clear both canvases
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    heatmapCtx.clearRect(0, 0, heatmapCanvas.width, heatmapCanvas.height);
    
    // Draw heatmap
    if (points.length > 0) {
      // Create a heatmap from the points
      const heatmap = createHeatmap(points, canvas.width, canvas.height);
      
      // Apply the heatmap to the canvas with the current opacity
      heatmapCtx.globalAlpha = heatmapOpacity;
      heatmapCtx.drawImage(heatmap, 0, 0);
    }
    
    // Draw gaze points
    ctx.globalAlpha = 1;
    points.forEach((point, index) => {
      // Ensure point coordinates are within canvas bounds
      const x = Math.max(0, Math.min(canvas.width, point.x));
      const y = Math.max(0, Math.min(canvas.height, point.y));
      
      // Draw a circle for each point
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fill();
      
      // Draw a line connecting consecutive points
      if (index > 0) {
        const prevPoint = points[index - 1];
        const prevX = Math.max(0, Math.min(canvas.width, prevPoint.x));
        const prevY = Math.max(0, Math.min(canvas.height, prevPoint.y));
        
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  };
  
  // Create a heatmap from points
  const createHeatmap = (points, width, height) => {
    // Create a temporary canvas for the heatmap
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Create a radial gradient for each point
    points.forEach(point => {
      // Ensure point coordinates are within canvas bounds
      const x = Math.max(0, Math.min(width, point.x));
      const y = Math.max(0, Math.min(height, point.y));
      
      const gradient = tempCtx.createRadialGradient(
        x, y, 0,
        x, y, 30
      );
      
      gradient.addColorStop(0, 'rgba(255, 0, 0, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      
      tempCtx.fillStyle = gradient;
      tempCtx.fillRect(x - 30, y - 30, 60, 60);
    });
    
    return tempCanvas;
  };
  
  // Playback controls
  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      setIsPlaying(true);
      startTimeRef.current = null;
      lastFrameTimeRef.current = null;
    }
  };
  
  const resetPlayback = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    drawFrame([]);
  };
  
  const changePlaybackSpeed = (speed) => {
    setPlaybackSpeed(speed);
  };
  
  const changeHeatmapOpacity = (opacity) => {
    setHeatmapOpacity(opacity);
  };
  
  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  useEffect(() => {
    if (currentTime >= session?.duration * 0.8 && hasMoreData && !isLoadingMore) {
      loadMoreGazeData();
    }
  }, [currentTime, session, hasMoreData, isLoadingMore]);
  
  const loadMoreGazeData = async () => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const nextBatch = currentBatch + 1;
      // Using the gaze endpoint that exists in the backend
      const response = await api.get(`/api/sessions/${sessionId}/gaze?offset=${nextBatch * BATCH_SIZE}&limit=${BATCH_SIZE}`);
      const newData = response.data.points || [];
      
      if (newData.length > 0) {
        setGazeData(prev => [...prev, ...newData]);
        setHasMoreData(newData.length === BATCH_SIZE);
        setCurrentBatch(nextBatch);
      } else {
        setHasMoreData(false);
      }
    } catch (err) {
      console.error('Error loading more gaze data:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };
  
  if (loading) {
    return (
      <div className="session-player-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading session data...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="session-player-container">
        <div className="error-message">{error}</div>
        <button className="back-button" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }
  
  // Always render a basic UI even if we don't have session data
  return (
    <div className="session-player-container">
      <div className="session-player-header">
        <h1>Session Playback</h1>
        <button className="back-button" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
      
      <div className="session-info">
        <h2>Session: {session?.name || `Session #${sessionId}`}</h2>
        <p>Date: {session?.created_at ? new Date(session.created_at).toLocaleString() : 'Unknown'}</p>
        <p>User: {currentUser?.username || 'Unknown'}</p>
        <p>Gaze Points: {gazeData.length}</p>
      </div>
      
      {gazeData.length > 0 ? (
        <div className="player-container">
          <div className="canvas-container" style={{ width: '100%', maxWidth: '1920px', margin: '0 auto' }}>
            <canvas 
              ref={canvasRef} 
              width={1920} 
              height={1080} 
              className="gaze-canvas"
              style={{ width: '100%', height: 'auto' }}
            />
            <canvas 
              ref={heatmapCanvasRef} 
              width={1920} 
              height={1080} 
              className="heatmap-canvas"
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
          
          <div className="player-controls">
            <div className="time-display">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
            
            <div className="control-buttons">
              <button 
                className={`control-button ${isPlaying ? 'pause' : 'play'}`}
                onClick={togglePlayback}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button 
                className="control-button reset"
                onClick={resetPlayback}
              >
                Reset
              </button>
            </div>
            
            <div className="speed-controls">
              <span>Speed:</span>
              <button 
                className={`speed-button ${playbackSpeed === 0.5 ? 'active' : ''}`}
                onClick={() => changePlaybackSpeed(0.5)}
              >
                0.5x
              </button>
              <button 
                className={`speed-button ${playbackSpeed === 1 ? 'active' : ''}`}
                onClick={() => changePlaybackSpeed(1)}
              >
                1x
              </button>
              <button 
                className={`speed-button ${playbackSpeed === 2 ? 'active' : ''}`}
                onClick={() => changePlaybackSpeed(2)}
              >
                2x
              </button>
            </div>
            
            <div className="opacity-controls">
              <span>Heatmap Opacity:</span>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={heatmapOpacity * 100}
                onChange={(e) => changeHeatmapOpacity(e.target.value / 100)}
              />
              <span>{Math.round(heatmapOpacity * 100)}%</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="no-data-message">
          <p>No gaze data available for this session.</p>
          <p>This could be because:</p>
          <ul>
            <li>The session recording is still in progress</li>
            <li>The session data hasn't been processed yet</li>
            <li>There was an error during recording</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SessionPlayer; 