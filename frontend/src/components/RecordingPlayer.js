import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './RecordingPlayer.css';

const RecordingPlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);

  const [session, setSession] = useState(null);
  const [gazePoints, setGazePoints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.5);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        console.log('Fetching session details for ID:', id);
        const response = await fetch(`/api/sessions/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch session: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Session data received:', data);
        setSession(data);
        
        // Calculate duration from session timestamps
        if (data.created_at && data.updated_at) {
          const start = new Date(data.created_at).getTime();
          const end = new Date(data.updated_at).getTime();
          setDuration(end - start);
        }
      } catch (err) {
        console.error('Error fetching session:', err);
        setError('Failed to load session details. Please try again later.');
      }
    };

    const fetchGazeData = async () => {
      try {
        console.log('Fetching gaze data for session:', id);
        const response = await fetch(`/api/sessions/${id}/gaze?offset=${offset}&limit=1000`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch gaze data: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Gaze data received:', data);
        
        if (data.points && Array.isArray(data.points)) {
          setGazePoints(prev => [...prev, ...data.points]);
          setHasMore(data.offset + data.limit < data.total);
        } else {
          console.error('Invalid gaze data format:', data);
          setError('Invalid gaze data format received from server');
        }
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching gaze data:', err);
        setError('Failed to load gaze data. Please try again later.');
        setIsLoading(false);
      }
    };

    fetchSession();
    fetchGazeData();
  }, [id, token, offset]);

  useEffect(() => {
    if (canvasRef.current && gazePoints.length > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to match screen dimensions
      canvas.width = 1920;
      canvas.height = 1080;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw current frame
      const currentPoints = gazePoints.filter(point => 
        point.timestamp >= currentTime && 
        point.timestamp < currentTime + 1000
      );
      
      if (currentPoints.length > 0) {
        // Create heatmap
        const heatmap = createHeatmap(currentPoints, canvas.width, canvas.height);
        ctx.globalAlpha = heatmapOpacity;
        ctx.drawImage(heatmap, 0, 0);
        ctx.globalAlpha = 1;
        
        // Draw gaze points
        currentPoints.forEach((point, index) => {
          // Draw a circle for each point
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
          ctx.fill();
          
          // Draw a line connecting consecutive points
          if (index > 0) {
            const prevPoint = currentPoints[index - 1];
            ctx.beginPath();
            ctx.moveTo(prevPoint.x, prevPoint.y);
            ctx.lineTo(point.x, point.y);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        });
      }
    }
  }, [currentTime, gazePoints, heatmapOpacity]);

  // Animation loop for playback
  useEffect(() => {
    if (!isPlaying || !gazePoints.length) return;
    
    const animate = () => {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      
      const elapsed = Date.now() - startTimeRef.current;
      const newTime = (elapsed * playbackSpeed) % duration;
      setCurrentTime(newTime);
      
      // Draw the current frame
      const currentPoints = gazePoints.filter(point => 
        point.timestamp >= newTime && 
        point.timestamp < newTime + 1000
      );
      drawFrame(currentPoints);
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, gazePoints, duration, playbackSpeed]);

  const createHeatmap = (points, width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Create gradient
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 50);
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 255, 0)');
    
    // Draw points
    points.forEach(point => {
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 50, 0, Math.PI * 2);
      ctx.fill();
    });
    
    return canvas;
  };

  const drawFrame = (points) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw heatmap
    if (points.length > 0) {
      const heatmap = createHeatmap(points, canvas.width, canvas.height);
      ctx.globalAlpha = heatmapOpacity;
      ctx.drawImage(heatmap, 0, 0);
      ctx.globalAlpha = 1;
    }

    // Draw points
    points.forEach((point, index) => {
      // Draw a circle for each point
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fill();
      
      // Draw a line connecting consecutive points
      if (index > 0) {
        const prevPoint = points[index - 1];
        ctx.beginPath();
        ctx.moveTo(prevPoint.x, prevPoint.y);
        ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      startTimeRef.current = null;
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

  const adjustHeatmapOpacity = (opacity) => {
    setHeatmapOpacity(opacity);
  };

  const loadMoreGazeData = () => {
    if (!isLoading && hasMore) {
      setOffset(prev => prev + 1000);
    }
  };

  if (isLoading && !gazePoints.length) {
    return (
      <div className="recording-player-container">
        <div className="loading-spinner">Loading recording...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="recording-player-container">
        <div className="error-message">{error}</div>
        <button className="back-button" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="recording-player-container">
      <div className="recording-player-header">
        <button className="back-button" onClick={() => navigate(-1)}>← Back</button>
        <h2>{session?.name || 'Recording'}</h2>
      </div>

      <div className="recording-player-content">
        <canvas
          ref={canvasRef}
          className="recording-canvas"
          width={1920}
          height={1080}
        />

        <div className="recording-controls">
          <div className="playback-controls">
            <button onClick={togglePlayback}>
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button onClick={resetPlayback}>⏮ Reset</button>
            <div className="speed-controls">
              <button onClick={() => changePlaybackSpeed(0.5)}>0.5x</button>
              <button onClick={() => changePlaybackSpeed(1)}>1x</button>
              <button onClick={() => changePlaybackSpeed(2)}>2x</button>
            </div>
          </div>

          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>

          <div className="opacity-control">
            <label>Heatmap Opacity:</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={heatmapOpacity}
              onChange={(e) => adjustHeatmapOpacity(parseFloat(e.target.value))}
            />
          </div>
        </div>

        {hasMore && (
          <button 
            className="load-more-button"
            onClick={loadMoreGazeData}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load More Data'}
          </button>
        )}
      </div>
    </div>
  );
};

export default RecordingPlayer; 