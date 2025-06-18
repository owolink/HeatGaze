import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './SessionPlayer.css';

// Global registry to enforce singleton pattern
const PLAYER_INSTANCES = {};

// Create a component instance counter to help debug multiple initializations
let instanceCounter = 0;

// Move component to a separate named function for cleaner memoization
const SessionPlayerComponent = ({ 
  sessionId, 
  videoUrl, 
  compact = false, 
  gazeData: preloadedGazeData, 
  cursorData: preloadedCursorData,
  session: preloadedSession 
}) => {
  // Create a unique instance ID for this component instance to track re-renders vs new mounts
  const instanceId = useRef(++instanceCounter);
  // Don't log in component body to prevent excessive logging on re-renders
  
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // Add a ref to track if component is mounted to prevent multiple initializations
  const isMountedRef = useRef(true);
  // Track initialization status
  const isInitializedRef = useRef(false);
  
  // Store session ID in ref to avoid re-fetching on parent re-renders
  const sessionIdRef = useRef(sessionId);
  
  const [session, setSession] = useState(null);
  const [gazeData, setGazeData] = useState([]);
  const [cursorData, setCursorData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [gazeHeatmapOpacity, setGazeHeatmapOpacity] = useState(0.7);
  const [cursorHeatmapOpacity, setCursorHeatmapOpacity] = useState(0.7);
  const [activeDataType, setActiveDataType] = useState('both'); // 'gaze', 'cursor', or 'both'
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1920, height: 1080 });
  const BATCH_SIZE = 1000;
  
  const canvasRef = useRef(null);
  const gazeHeatmapCanvasRef = useRef(null);
  const cursorHeatmapCanvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastFrameTimeRef = useRef(null);
  const videoRef = useRef(null);
  
  // Add these refs for heatmap caching
  const gazeHeatmapCacheRef = useRef(null);
  const cursorHeatmapCacheRef = useRef(null);
  const lastGazePointCountRef = useRef(0);
  const lastCursorPointCountRef = useRef(0);
  
  // Log initialization only once using an effect with empty deps
  useEffect(() => {
    // Handle direct video URL for compact mode
    if (compact && videoUrl) {
      setLoading(false);
      if (videoRef.current) {
        videoRef.current.onloadedmetadata = () => {
          setDuration(videoRef.current.duration * 1000); // Convert to ms
        };
      }
      return;
    }
    
    // For regular mode with sessionId
    if (sessionId) {
      // Register this instance in the global singleton registry
      if (PLAYER_INSTANCES[sessionId]) {
        console.warn(`Another SessionPlayer instance for session ${sessionId} already exists (Instance #${PLAYER_INSTANCES[sessionId].id}). This duplicate (Instance #${instanceId.current}) may cause performance issues.`);
      } else {
        PLAYER_INSTANCES[sessionId] = {
          id: instanceId.current,
          mountTime: new Date().toISOString()
        };
        console.log(`SessionPlayer component initialized with sessionId: ${sessionId} (Instance #${instanceId.current})`);
      }
      
      return () => {
        // Clean up the instance tracking on unmount
        if (PLAYER_INSTANCES[sessionId] && PLAYER_INSTANCES[sessionId].id === instanceId.current) {
          console.log(`SessionPlayer instance #${instanceId.current} for session ${sessionId} unmounting - removing from registry`);
          delete PLAYER_INSTANCES[sessionId];
        }
      };
    }
  }, [sessionId, videoUrl, compact]);
  
  // Handle resizing of canvas container
  useEffect(() => {
    const updateCanvasDimensions = () => {
      if (canvasContainerRef.current) {
        const containerWidth = canvasContainerRef.current.clientWidth;
        // Maintain 16:9 aspect ratio
        const containerHeight = Math.floor((containerWidth * 9) / 16);
        
        console.log(`Setting canvas container dimensions: ${containerWidth}x${containerHeight}`);
        
        // Set canvas dimensions state
        setCanvasDimensions({
          width: containerWidth,
          height: containerHeight
        });
        
        // Ensure all canvases have correct dimensions
        const canvases = [canvasRef.current, gazeHeatmapCanvasRef.current, cursorHeatmapCanvasRef.current];
        canvases.forEach(canvas => {
          if (canvas) {
            canvas.width = 1920;  // Keep internal resolution high for clarity
            canvas.height = 1080;
            // Let CSS handle the display sizing
          }
        });
      }
    };
    
    // Update on mount
    updateCanvasDimensions();
    
    // Update on window resize
    window.addEventListener('resize', updateCanvasDimensions);
    
    return () => {
      window.removeEventListener('resize', updateCanvasDimensions);
    };
  }, []);

  // Add a special effect to identify and fix any blue color issues
  useEffect(() => {
    const fixCanvasStyles = () => {
      if (canvasContainerRef.current) {
        // Force override any computed styles that might be causing the blue background
        const container = canvasContainerRef.current;
        
        // Log current styles for debugging
        const computedStyle = window.getComputedStyle(container);
        console.log("Canvas container computed background:", computedStyle.backgroundColor);
        
        // Apply direct style overrides
        container.style.backgroundColor = "#ffffff";
        container.style.background = "#ffffff";
        
        // Check for any elements with the problematic color and fix them
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.backgroundColor === "#3f38cc" || 
              style.backgroundColor.includes("rgb(63, 56, 204)")) {
            console.log("Found element with blue background:", el);
            el.style.backgroundColor = "transparent";
            el.style.background = "transparent";
          }
        });
        
        // Ensure canvas elements are properly styled
        [canvasRef.current, gazeHeatmapCanvasRef.current, cursorHeatmapCanvasRef.current]
          .forEach(canvas => {
            if (canvas) {
              canvas.style.backgroundColor = "transparent";
              canvas.style.background = "transparent";
            }
          });
      }
    };
    
    // Run once on mount
    fixCanvasStyles();
    
    // Also run after a small delay to catch any post-render styling
    const timeoutId = setTimeout(fixCanvasStyles, 500);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  // Create a cleanup function that can be called on unmount
  const cleanupResources = useCallback(() => {
    console.log(`Cleaning up SessionPlayer resources (Instance #${instanceId.current})`);
    // Cancel any animation frame
    if (animationFrameRef.current) {
      console.log('Cancelling animation frame');
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Reset animation state
    startTimeRef.current = null;
    lastFrameTimeRef.current = null;
    
    // Mark component as unmounted
    isMountedRef.current = false;
  }, []);

  // Track component mount/unmount
  useEffect(() => {
    // Only set the mounted flag to true once
    isMountedRef.current = true;
    
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);
  
  // Load session data - only run once on initial mount or when sessionId changes
  useEffect(() => {
    // Skip fetching if we're in compact mode with direct videoUrl
    if (compact && videoUrl) {
      return;
    }

    // Skip if no sessionId
    if (!sessionId) {
      return;
    }
    
    // Only fetch if the component is mounted and we have a sessionId
    // Use the ref to avoid re-fetching on every render and to check if mounted
    if (isMountedRef.current && sessionId && !isInitializedRef.current) {
      console.log(`Initializing data fetch for session ${sessionId} (Instance #${instanceId.current})`);
      isInitializedRef.current = true;
      sessionIdRef.current = sessionId;
      
      // Function to fetch all necessary data
      const fetchData = async () => {
        try {
          // Make sure we're still mounted before doing any async work
          if (!isMountedRef.current) {
            console.log('Component unmounted before data fetch started, aborting');
            return;
          }
          
          // Reset any previous data
          setSession(null);
          setGazeData([]);
          setCursorData([]);
          setLoading(true);
          setError(null);
          setCurrentTime(0);
          setDuration(0);
          startTimeRef.current = null;
          lastFrameTimeRef.current = null;
          
          // If we have preloaded data, use it instead of fetching
          if (compact && preloadedGazeData && preloadedCursorData) {
            console.log(`Using preloaded data: ${preloadedGazeData.length} gaze points, ${preloadedCursorData.length} cursor points`);
            
            // If we have a preloaded session, use it
            if (preloadedSession) {
              setSession(preloadedSession);
            }
            
            setGazeData(preloadedGazeData);
            
            // Make sure cursor data is an array
            let initialCursorData = [];
            if (preloadedCursorData) {
              // If preloadedCursorData is already an array, use it
              if (Array.isArray(preloadedCursorData)) {
                initialCursorData = preloadedCursorData;
              } 
              // If it has points property, use that (structured response)
              else if (preloadedCursorData.points && Array.isArray(preloadedCursorData.points)) {
                initialCursorData = preloadedCursorData.points;
                console.log('Using points array from cursor data response');
              } else {
                console.warn('Cursor data is not in expected format:', preloadedCursorData);
              }
            }
            
            setCursorData(initialCursorData);
            
            // Calculate duration based on data points
            const calculatedDuration = calculateDuration(preloadedGazeData, initialCursorData);
            setDuration(calculatedDuration);
            
            // Successful load
            setLoading(false);
            
            // Render a test frame to show initial state
            setTimeout(() => {
              if (isMountedRef.current) {
                renderTestFrame();
              }
            }, 100);
            
            return;
          }
          
          // If we have preloaded data but need session data, or if we don't have preloaded data, fetch everything
          let sessionData, initialGazeData, initialCursorData;
          
          if (sessionId) {
            // 1. Fetch session info
            console.log(`Fetching session info for ${sessionId}`);
            const [sessionResponse, gazeResponse, cursorResponse] = await Promise.all([
              api.get(`/api/sessions/${sessionId}`),
              preloadedGazeData ? Promise.resolve({data: preloadedGazeData}) : api.get(`/api/sessions/${sessionId}/gaze-data?limit=${BATCH_SIZE}&offset=0`),
              preloadedCursorData ? Promise.resolve({data: preloadedCursorData}) : api.get(`/api/sessions/${sessionId}/cursor-data?limit=${BATCH_SIZE}&offset=0`),
            ]);
            
            // Skip updates if component unmounted during fetch
            if (!isMountedRef.current) {
              console.log('Component unmounted during data fetch, aborting updates');
              return;
            }
            
            sessionData = sessionResponse.data;
            initialGazeData = gazeResponse.data;
            
            // Make sure cursor data is an array
            initialCursorData = [];
            if (cursorResponse.data) {
              // If cursorResponse.data is already an array, use it
              if (Array.isArray(cursorResponse.data)) {
                initialCursorData = cursorResponse.data;
              } 
              // If it has points property, use that (structured response)
              else if (cursorResponse.data.points && Array.isArray(cursorResponse.data.points)) {
                initialCursorData = cursorResponse.data.points;
                console.log('Using points array from cursor data response');
              } else {
                console.warn('Cursor data response is not in expected format:', cursorResponse.data);
                initialCursorData = []; // Fallback to empty array
              }
            }
          }
          
          setSession(sessionData);
          setGazeData(initialGazeData);
          setCursorData(initialCursorData);
          
          // Log what we're setting for debugging
          console.log(`Setting cursor data: ${initialCursorData.length} points`);
          console.log(`Cursor data is array: ${Array.isArray(initialCursorData)}`);
          
          // Set hasMoreData based on returned data size
          setHasMoreData(initialGazeData.length === BATCH_SIZE);
          setCurrentBatch(1);  // We've loaded the first batch
          
          // Calculate duration based on last data point
          const calculatedDuration = calculateDuration(initialGazeData, initialCursorData);
          setDuration(calculatedDuration);
          
          // Successful load
          setLoading(false);
          
          // Render a test frame to show initial state
          setTimeout(() => {
            if (isMountedRef.current) {
              renderTestFrame();
            }
          }, 100);
          
        } catch (err) {
          console.error('Error fetching session data:', err);
          
          // Skip error updates if component unmounted
          if (!isMountedRef.current) return;
          
          if (err.response && err.response.status === 401) {
            // Handled by API interceptor automatically
            setError('Требуется авторизация. Выполните вход.');
          } else if (err.response && err.response.status === 404) {
            setError('Сессия не найдена.');
          } else {
            setError('Ошибка загрузки данных сессии.');
          }
          
          setLoading(false);
        }
      };
      
      fetchData();
    }
  }, [sessionId, videoUrl, compact, preloadedGazeData, preloadedCursorData, preloadedSession]);
  
  // Function to calculate duration from data points
  const calculateDuration = (gazeData, cursorData) => {
    let maxTime = 0;
    
    if (gazeData && gazeData.length > 0) {
      const lastGazePoint = gazeData[gazeData.length - 1];
      const firstGazePoint = gazeData[0];
      
      // Handle different timestamp formats
      let lastGazeTime;
      let firstGazeTime;
      
      if (typeof lastGazePoint.timestamp === 'number') {
        lastGazeTime = lastGazePoint.timestamp;
      } else if (lastGazePoint.timestamp instanceof Date) {
        lastGazeTime = lastGazePoint.timestamp.getTime();
      } else {
        lastGazeTime = new Date(lastGazePoint.timestamp).getTime();
      }
      
      if (typeof firstGazePoint.timestamp === 'number') {
        firstGazeTime = firstGazePoint.timestamp;
      } else if (firstGazePoint.timestamp instanceof Date) {
        firstGazeTime = firstGazePoint.timestamp.getTime();
      } else {
        firstGazeTime = new Date(firstGazePoint.timestamp).getTime();
      }
      
      // Calculate duration as the difference between last and first timestamp
      const gazeDuration = lastGazeTime - firstGazeTime;
      maxTime = Math.max(maxTime, gazeDuration);
      
      console.log(`Gaze data duration: ${gazeDuration}ms (${gazeDuration/1000}s)`);
    }
    
    if (cursorData && cursorData.length > 0) {
      const lastCursorPoint = cursorData[cursorData.length - 1];
      const firstCursorPoint = cursorData[0];
      
      // Handle different timestamp formats
      let lastCursorTime;
      let firstCursorTime;
      
      if (typeof lastCursorPoint.timestamp === 'number') {
        lastCursorTime = lastCursorPoint.timestamp;
      } else if (lastCursorPoint.timestamp instanceof Date) {
        lastCursorTime = lastCursorPoint.timestamp.getTime();
      } else {
        lastCursorTime = new Date(lastCursorPoint.timestamp).getTime();
      }
      
      if (typeof firstCursorPoint.timestamp === 'number') {
        firstCursorTime = firstCursorPoint.timestamp;
      } else if (firstCursorPoint.timestamp instanceof Date) {
        firstCursorTime = firstCursorPoint.timestamp.getTime();
      } else {
        firstCursorTime = new Date(firstCursorPoint.timestamp).getTime();
      }
      
      // Calculate duration as the difference between last and first timestamp
      const cursorDuration = lastCursorTime - firstCursorTime;
      maxTime = Math.max(maxTime, cursorDuration);
      
      console.log(`Cursor data duration: ${cursorDuration}ms (${cursorDuration/1000}s)`);
    }
    
    // Ensure we have a valid duration
    if (maxTime <= 0 || isNaN(maxTime)) {
      console.warn('Invalid duration calculated:', maxTime);
      console.log('gazeData:', gazeData && gazeData.length ? gazeData[0] : 'empty');
      console.log('cursorData:', cursorData && cursorData.length ? cursorData[0] : 'empty');
      
      // Default to a minimum duration if calculation fails
      maxTime = 10000; // 10 seconds default
    }
    
    console.log(`Final calculated duration: ${maxTime}ms (${maxTime/1000}s)`);
    return maxTime;
  };
  
  // Create a heatmap from points with a specific color
  const createHeatmap = (points, width, height, color) => {
    // Only log details occasionally to avoid flooding the console
    const shouldLog = Math.random() < 0.1; // 10% chance to log details
    
    if (shouldLog) {
      console.log(`Creating heatmap with ${points.length} points, color: ${color}`);
      console.log(`Canvas dimensions: ${width}x${height}`);
    }
    
    if (points.length === 0) {
      console.warn('No points provided for heatmap creation');
      const emptyCanvas = document.createElement('canvas');
      emptyCanvas.width = width;
      emptyCanvas.height = height;
      return emptyCanvas;
    }
    
    try {
      // Create a temporary canvas for the heatmap
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        console.error('Failed to get context from temporary canvas');
        return document.createElement('canvas');
      }
      
      // Set color based on type - REDUCED OPACITY
      let gradientColor = {
        start: 'rgba(255, 0, 0, 0.4)',  // Reduced from 0.6 to 0.4
        mid: 'rgba(255, 0, 0, 0.2)',    // Reduced from 0.3 to 0.2
        end: 'rgba(255, 0, 0, 0)'
      };
      
      if (color === 'blue') {
        gradientColor = {
          start: 'rgba(0, 0, 255, 0.4)', // Reduced from 0.6 to 0.4
          mid: 'rgba(0, 0, 255, 0.2)',   // Reduced from 0.3 to 0.2
          end: 'rgba(0, 0, 255, 0)'
        };
      }
      
      // Track statistics for debugging
      let pointsDrawn = 0;
      let pointsSkipped = 0;
      
      // Pre-filter invalid points to avoid errors during heatmap generation
      const validPoints = points.filter(point => {
        // Basic validation
        if (point.x === undefined || point.y === undefined || isNaN(point.x) || isNaN(point.y)) {
          return false;
        }
        
        // Skip extreme values that are likely errors
        if (point.x < -100 || point.y < -100 || point.x > width + 100 || point.y > height + 100) {
          return false;
        }
        
        return true;
      });
      
      if (validPoints.length < points.length && shouldLog) {
        console.log(`Filtered out ${points.length - validPoints.length} invalid points before heatmap generation`);
      }
      
      // Clear the canvas with a transparent background
      tempCtx.clearRect(0, 0, width, height);
      // Use transparent white instead of solid white
      tempCtx.fillStyle = "rgba(255, 255, 255, 0.01)"; 
      tempCtx.fillRect(0, 0, width, height);
      
      // Create a radial gradient for each valid point
      validPoints.forEach(point => {
        // Ensure point coordinates are within canvas bounds
        const x = Math.max(0, Math.min(width, point.x));
        const y = Math.max(0, Math.min(height, point.y));
        
        const radius = 20; // Smaller radius for more precise heatmap (was 30)
        
        try {
          const gradient = tempCtx.createRadialGradient(
            x, y, 0,
            x, y, radius
          );
          
          gradient.addColorStop(0, gradientColor.start);
          gradient.addColorStop(0.5, gradientColor.mid);
          gradient.addColorStop(1, gradientColor.end);
          
          tempCtx.beginPath();
          tempCtx.arc(x, y, radius, 0, Math.PI * 2);
          tempCtx.fillStyle = gradient;
          tempCtx.fill();
          
          pointsDrawn++;
        } catch (err) {
          console.error(`Error creating gradient for point (${x}, ${y}):`, err);
          pointsSkipped++;
        }
      });
      
      if (shouldLog) {
        console.log(`Heatmap created - points drawn: ${pointsDrawn}, skipped: ${pointsSkipped}`);
      }
      
      return tempCanvas;
    } catch (error) {
      console.error('Error creating heatmap:', error);
      // Return an empty canvas as fallback
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = width;
      fallbackCanvas.height = height;
      return fallbackCanvas;
    }
  };
  
  // Move drawFrame definition before useEffect
  const drawFrame = useCallback((gazePoints, cursorPoints) => {
    // Periodically log detailed frame info to avoid console spam
    const shouldLogDetailed = Math.random() < 0.05; // ~5% chance to log details
    
    if (shouldLogDetailed) {
      console.log(`Drawing frame with ${gazePoints.length} gaze points and ${cursorPoints.length} cursor points`);
      console.log('Active data type:', activeDataType);
    }
    
    const canvas = canvasRef.current;
    const gazeHeatmapCanvas = gazeHeatmapCanvasRef.current;
    const cursorHeatmapCanvas = cursorHeatmapCanvasRef.current;
    
    if (!canvas || !gazeHeatmapCanvas || !cursorHeatmapCanvas) {
      console.error('Canvas references not available:');
      console.error('- Main canvas:', !!canvas);
      console.error('- Gaze heatmap canvas:', !!gazeHeatmapCanvas);
      console.error('- Cursor heatmap canvas:', !!cursorHeatmapCanvas);
      return;
    }
    
    const ctx = canvas.getContext('2d');
    const gazeHeatmapCtx = gazeHeatmapCanvas.getContext('2d');
    const cursorHeatmapCtx = cursorHeatmapCanvas.getContext('2d');
    
    // Check for context issues
    if (!ctx || !gazeHeatmapCtx || !cursorHeatmapCtx) {
      console.error('Failed to get canvas contexts');
      return;
    }
    
    // Completely reset all canvas elements
    // First clear everything
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    gazeHeatmapCtx.clearRect(0, 0, gazeHeatmapCanvas.width, gazeHeatmapCanvas.height);
    cursorHeatmapCtx.clearRect(0, 0, cursorHeatmapCanvas.width, cursorHeatmapCanvas.height);
    
    // Ensure a pure white background for the main canvas
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#FFFFFF'; // Pure white, no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Reset composite operation to ensure proper drawing
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw gaze heatmap if active
    if (gazePoints.length > 0 && activeDataType !== 'cursor') {
      if (shouldLogDetailed) console.log('Creating gaze heatmap...');
      
      // Only create a new heatmap if the number of points has changed significantly
      // This prevents regenerating heatmaps every frame
      if (!gazeHeatmapCacheRef.current || Math.abs(lastGazePointCountRef.current - gazePoints.length) > 5) {
        if (shouldLogDetailed) console.log(`Regenerating gaze heatmap cache (point count: ${gazePoints.length}, was: ${lastGazePointCountRef.current})`);
        // Create a heatmap from the points
        gazeHeatmapCacheRef.current = createHeatmap(gazePoints, canvas.width, canvas.height, 'red');
        lastGazePointCountRef.current = gazePoints.length;
      }
      
      // Apply the heatmap to the canvas with the current opacity
      gazeHeatmapCtx.globalAlpha = gazeHeatmapOpacity;
      gazeHeatmapCtx.drawImage(gazeHeatmapCacheRef.current, 0, 0);
      
      if (shouldLogDetailed) console.log('Gaze heatmap drawn with opacity:', gazeHeatmapOpacity);
    }
    
    // Draw cursor heatmap if active
    if (cursorPoints.length > 0 && activeDataType !== 'gaze') {
      if (shouldLogDetailed) console.log('Creating cursor heatmap with', cursorPoints.length, 'points');
      
      // Only create a new heatmap if the number of points has changed significantly
      if (!cursorHeatmapCacheRef.current || Math.abs(lastCursorPointCountRef.current - cursorPoints.length) > 20) {
        if (shouldLogDetailed) console.log(`Regenerating cursor heatmap cache (point count: ${cursorPoints.length}, was: ${lastCursorPointCountRef.current})`);
        // Create a heatmap from the points
        cursorHeatmapCacheRef.current = createHeatmap(cursorPoints, canvas.width, canvas.height, 'blue');
        lastCursorPointCountRef.current = cursorPoints.length;
      }
      
      // Apply the heatmap to the canvas with the current opacity
      cursorHeatmapCtx.globalAlpha = cursorHeatmapOpacity;
      cursorHeatmapCtx.drawImage(cursorHeatmapCacheRef.current, 0, 0);
      
      if (shouldLogDetailed) console.log('Cursor heatmap drawn with opacity:', cursorHeatmapOpacity);
    } else if (activeDataType !== 'gaze' && shouldLogDetailed) {
      console.log('Not drawing cursor heatmap - no points available');
    }
    
    // Only log point drawing info periodically
    if (shouldLogDetailed) {
      if (gazePoints.length > 0) {
        console.log(`Drawing ${gazePoints.length} gaze points`);
      }
      if (cursorPoints.length > 0) {
        console.log(`Drawing ${cursorPoints.length} cursor points`);
      }
    }
    
    // Draw gaze points
    if (gazePoints.length > 0 && activeDataType !== 'cursor') {
      ctx.globalAlpha = 1;
      gazePoints.forEach((point, index) => {
        // Ensure point coordinates are within canvas bounds
        const x = Math.max(0, Math.min(canvas.width, point.x));
        const y = Math.max(0, Math.min(canvas.height, point.y));
        
        // Draw a circle for each point
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2); // Smaller circle (was 5)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.6)'; // More vibrant red for gaze
        ctx.fill();
        
        // Draw a line connecting consecutive points
        if (index > 0) {
          const prevPoint = gazePoints[index - 1];
          const prevX = Math.max(0, Math.min(canvas.width, prevPoint.x));
          const prevY = Math.max(0, Math.min(canvas.height, prevPoint.y));
          
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(x, y);
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // More vibrant red
          ctx.lineWidth = 1; // Thinner line (was 2)
          ctx.stroke();
        }
      });
    }
    
    // Draw cursor points
    if (cursorPoints.length > 0 && activeDataType !== 'gaze') {
      ctx.globalAlpha = 1;
      cursorPoints.forEach((point, index) => {
        // Ensure point coordinates are within canvas bounds
        const x = Math.max(0, Math.min(canvas.width, point.x));
        const y = Math.max(0, Math.min(canvas.height, point.y));
        
        // Draw a circle for each point
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2); // Smaller circle (was 5)
        ctx.fillStyle = 'rgba(0, 0, 255, 0.6)'; // More vibrant blue for cursor
        ctx.fill();
        
        // Draw a line connecting consecutive points
        if (index > 0) {
          const prevPoint = cursorPoints[index - 1];
          const prevX = Math.max(0, Math.min(canvas.width, prevPoint.x));
          const prevY = Math.max(0, Math.min(canvas.height, prevPoint.y));
          
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(x, y);
          ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)'; // More vibrant blue
          ctx.lineWidth = 1; // Thinner line (was 2)
          ctx.stroke();
        }
      });
    }
  }, [activeDataType, gazeHeatmapOpacity, cursorHeatmapOpacity]);
  
  // Function to handle timeline seeking
  const handleTimelineClick = (e) => {
    // Get the click position relative to the progress bar
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressBarWidth = rect.width;
    
    // Calculate the new position in percentage
    const percentage = Math.min(Math.max(clickX / progressBarWidth, 0), 1);
    
    // Calculate the new time in milliseconds
    const newTime = percentage * duration;
    
    // Immediately update the UI to reflect the new position
    // This ensures the progress indicator (snake) updates right away
    setCurrentTime(newTime);
    
    // Get session start time
    let sessionStartTime = new Date().getTime() - duration;
    
    if (gazeData.length > 0) {
      const gazeStartTime = new Date(gazeData[0].timestamp).getTime();
      sessionStartTime = gazeStartTime;
    } else if (cursorData.length > 0) {
      const cursorStartTime = new Date(cursorData[0].timestamp).getTime();
      sessionStartTime = cursorStartTime;
    }
    
    const currentTimestamp = sessionStartTime + newTime;
    
    // If playing, update the animation start time to match new position
    if (isPlaying) {
      // Cancel any existing animation frame to prevent overlapping animations
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Set the start time to create the effect that playback has been running
      // from the beginning and has now reached this point
      const now = performance.now();
      startTimeRef.current = now - (newTime / playbackSpeed);
      lastFrameTimeRef.current = now;
      
      // Add a small delay before starting the animation again
      // This gives React time to update the UI with the new currentTime
      setTimeout(() => {
        // Request a new animation frame to continue from the new position
        if (isPlaying) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      }, 20); // Small delay to ensure UI updates first
    } else {
      // If not playing, we need to calculate the start time for when play is pressed
      startTimeRef.current = null;
      lastFrameTimeRef.current = null;
    }
    
    // Find visible points at this timestamp (shared between playing and paused states)
    const visibleGazePoints = activeDataType === 'cursor' ? [] : 
      gazeData.filter(point => {
        const pointTime = point.timestamp instanceof Date 
          ? point.timestamp.getTime() 
          : new Date(point.timestamp).getTime();
        return !isNaN(pointTime) && pointTime <= currentTimestamp;
      });
    
    const visibleCursorPoints = activeDataType === 'gaze' ? [] :
      cursorData.filter(point => {
        let pointTime;
        if (typeof point.timestamp === 'number') {
          pointTime = point.timestamp;
        } else if (point.timestamp instanceof Date) {
          pointTime = point.timestamp.getTime();
        } else {
          pointTime = new Date(point.timestamp).getTime();
        }
        return !isNaN(pointTime) && pointTime <= currentTimestamp;
      });
    
    // Draw the frame at the new position
    drawFrame(visibleGazePoints, visibleCursorPoints);
  };
  
  // Animation function - define outside the effect for reuse
  const animate = (timestamp) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
      lastFrameTimeRef.current = timestamp;
      console.log('Animation started at timestamp:', timestamp);
    }
    
    // Calculate elapsed time in the animation
    const elapsedTime = timestamp - startTimeRef.current;
    
    // Calculate current position in the session based on elapsed time and playback speed
    const sessionPosition = Math.min(elapsedTime * playbackSpeed, duration);
    
    // Update the current time - which will update the visual progress indicator
    setCurrentTime(sessionPosition);
    
    // Only log every 60 frames to avoid console spam
    if (Math.round(timestamp) % 60 === 0) {
      console.log(`Playback: ${Math.round(sessionPosition/1000)}s / ${Math.round(duration/1000)}s (${Math.round(sessionPosition/duration * 100)}%)`);
    }
    
    // Get session start time - fallback to current time minus duration if no data available
    let sessionStartTime = new Date().getTime() - duration;
    
    if (gazeData.length > 0) {
      const gazeStartTime = new Date(gazeData[0].timestamp).getTime();
      sessionStartTime = gazeStartTime;
    } else if (cursorData.length > 0) {
      const cursorStartTime = new Date(cursorData[0].timestamp).getTime();
      sessionStartTime = cursorStartTime;
    }
    
    if (isNaN(sessionStartTime)) {
      console.error('Invalid session start time - cannot calculate current timestamp');
      console.error('First gaze point:', gazeData.length > 0 ? gazeData[0] : 'No gaze data');
      console.error('First cursor point:', cursorData.length > 0 ? cursorData[0] : 'No cursor data');
      
      // Fallback to current time minus duration
      sessionStartTime = new Date().getTime() - duration;
    }
    
    const currentTimestamp = sessionStartTime + sessionPosition;
    
    // Log timestamp information periodically
    if (Math.round(timestamp) % 300 === 0) {
      console.log('Animation debug:');
      console.log(`- Animation elapsed time: ${elapsedTime}ms`);
      console.log(`- Session position: ${sessionPosition}ms`);
      console.log(`- Current timestamp: ${new Date(currentTimestamp).toISOString()}`);
    }
    
    // Define a throttle value for rendering - adjust this value to balance smoothness vs performance
    const RENDER_THROTTLE = 25; // Increase rendering rate to 40fps for smoother playback (was 50 = 20fps)
    
    // Throttle rendering for better performance
    if (!lastFrameTimeRef.current || timestamp - lastFrameTimeRef.current >= RENDER_THROTTLE) {
      // Find all visible points based on active data type
      const visibleGazePoints = activeDataType === 'cursor' ? [] : 
        gazeData.filter(point => {
          try {
            const pointTime = point.timestamp instanceof Date 
              ? point.timestamp.getTime() 
              : new Date(point.timestamp).getTime();
            return !isNaN(pointTime) && pointTime <= currentTimestamp;
          } catch (err) {
            console.error('Error processing gaze point timestamp:', err);
            return false;
          }
        });
      
      const visibleCursorPoints = activeDataType === 'gaze' ? [] :
        cursorData.filter(point => {
          try {
            // Handle different timestamp formats
            let pointTime;
            if (typeof point.timestamp === 'number') {
              pointTime = point.timestamp;
            } else if (point.timestamp instanceof Date) {
              pointTime = point.timestamp.getTime();
            } else {
              pointTime = new Date(point.timestamp).getTime();
            }
            return !isNaN(pointTime) && pointTime <= currentTimestamp;
          } catch (err) {
            console.error('Error processing cursor point timestamp:', err);
            return false;
          }
        });
      
      // Draw the current state
      drawFrame(visibleGazePoints, visibleCursorPoints);
      lastFrameTimeRef.current = timestamp;
    }
    
    // Check if we've reached the end of the recording
    if (sessionPosition >= duration) {
      // Stop at the end instead of looping
      setIsPlaying(false);
      return;
    }
    
    // Continue animation if still playing
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  };
  
  // Animation loop for playback - optimize the animation timing
  useEffect(() => {
    if (!isPlaying || (!gazeData.length && !cursorData.length)) {
      console.log('Animation not running:', isPlaying ? 'no data available' : 'playback is paused');
      return;
    }
    
    console.log('Starting animation loop with:');
    console.log(`- ${gazeData.length} gaze points`);
    console.log(`- ${cursorData.length} cursor points`);
    console.log(`- Duration: ${duration}ms (${duration/1000} seconds)`);
    console.log(`- Playback speed: ${playbackSpeed}x`);
    
    // Check timestamps to verify data
    if (gazeData.length > 0) {
      const firstGazeTime = new Date(gazeData[0].timestamp).getTime();
      const lastGazeTime = new Date(gazeData[gazeData.length-1].timestamp).getTime();
      console.log(`Gaze data time range: ${new Date(firstGazeTime).toISOString()} to ${new Date(lastGazeTime).toISOString()}`);
    }
    
    if (cursorData.length > 0) {
      const firstCursorTime = new Date(cursorData[0].timestamp).getTime();
      const lastCursorTime = new Date(cursorData[cursorData.length-1].timestamp).getTime();
      console.log(`Cursor data time range: ${new Date(firstCursorTime).toISOString()} to ${new Date(lastCursorTime).toISOString()}`);
    }
    
    // Filter out points with future timestamps or invalid coordinates
    const currentTime = new Date().getTime();
    const timeThreshold = currentTime + (1000 * 60 * 60); // 1 hour in the future
    
    // Filter out any points with timestamps too far in the future
    const filteredGazeData = gazeData.filter(point => {
      const timestamp = point.timestamp instanceof Date 
        ? point.timestamp.getTime() 
        : new Date(point.timestamp).getTime();
      // Only keep points with valid timestamps and coordinates
      const isValid = !isNaN(timestamp) && 
                      timestamp <= timeThreshold && 
                      point.x !== undefined && 
                      point.y !== undefined && 
                      !isNaN(point.x) && 
                      !isNaN(point.y);
      return isValid;
    });
    
    const filteredCursorData = cursorData.filter(point => {
      let timestamp;
      if (typeof point.timestamp === 'number') {
        timestamp = point.timestamp;
      } else if (point.timestamp instanceof Date) {
        timestamp = point.timestamp.getTime();
      } else {
        timestamp = new Date(point.timestamp).getTime();
      }
      // Only keep points with valid timestamps and coordinates
      const isValid = !isNaN(timestamp) && 
                      timestamp <= timeThreshold && 
                      point.x !== undefined && 
                      point.y !== undefined && 
                      !isNaN(point.x) && 
                      !isNaN(point.y);
      return isValid;
    });
    
    if (filteredGazeData.length < gazeData.length) {
      console.warn(`Filtered out ${gazeData.length - filteredGazeData.length} invalid gaze points with future timestamps or invalid coordinates`);
    }
    
    if (filteredCursorData.length < cursorData.length) {
      console.warn(`Filtered out ${cursorData.length - filteredCursorData.length} invalid cursor points with future timestamps or invalid coordinates`);
    }
    
    // Reset cache refs when animation starts to force fresh heatmaps
    gazeHeatmapCacheRef.current = null;
    cursorHeatmapCacheRef.current = null;
    lastGazePointCountRef.current = 0;
    lastCursorPointCountRef.current = 0;
    
    console.log('Requesting animation frame...');
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        console.log('Cancelling animation frame');
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, gazeData, cursorData, duration, playbackSpeed, activeDataType, drawFrame]);
  
  // Playback controls
  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      setIsPlaying(true);
      // Don't reset the time, just continue from where we left off
      // Store the current time to handle the offset correctly in the animation
      const currentTimeWhenResuming = currentTime;
      // Calculate when the animation should have started to be at this position now
      const now = performance.now();
      startTimeRef.current = now - (currentTimeWhenResuming / playbackSpeed);
      lastFrameTimeRef.current = now;
    }
  };
  
  const resetPlayback = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Reset the view based on active data type
    if (activeDataType === 'both') {
      drawFrame([], []);
    } else if (activeDataType === 'gaze') {
      drawFrame([], []);
    } else if (activeDataType === 'cursor') {
      drawFrame([], []);
    }
  };
  
  // Debug function to test rendering with synthetic data
  const renderTestFrame = () => {
    console.log('Rendering test frame with synthetic data');
    
    // Create synthetic test data
    const now = new Date();
    const testGazePoints = [];
    const testCursorPoints = [];
    
    // Create a grid of points for testing
    for (let x = 100; x < 1800; x += 200) {
      for (let y = 100; y < 900; y += 200) {
        // Add gaze point
        testGazePoints.push({
          x: x,
          y: y,
          timestamp: now
        });
        
        // Add cursor point with slight offset
        testCursorPoints.push({
          x: x + 50,
          y: y + 50,
          timestamp: now
        });
      }
    }
    
    console.log(`Created ${testGazePoints.length} test gaze points and ${testCursorPoints.length} test cursor points`);
    
    // Draw frame with test data
    drawFrame(testGazePoints, testCursorPoints);
  };
  
  // Debug function to download session data
  const downloadSessionData = () => {
    if (!session) {
      console.error('No session data available to download');
      return;
    }
    
    try {
      // Prepare session data with all available information
      const sessionData = {
        session: {
          ...session,
          id: sessionId
        },
        metrics: {
          duration: duration,
          gazePointsCount: gazeData.length,
          cursorPointsCount: cursorData.length,
          canvasDimensions: canvasDimensions
        },
        gazeData: gazeData.slice(0, 100).map(point => ({
          x: point.x,
          y: point.y,
          timestamp: point.timestamp.toISOString(),
          original_timestamp: point.originalTimestamp
        })),
        cursorData: cursorData.slice(0, 100).map(point => ({
          x: point.x, 
          y: point.y,
          timestamp: point.timestamp.toISOString(),
          original_timestamp: point.originalTimestamp
        }))
      };
      
      // Convert to JSON string
      const dataStr = JSON.stringify(sessionData, null, 2);
      
      // Create download link
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `session-${sessionId}-debug-data.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      console.log('Session data downloaded');
    } catch (error) {
      console.error('Error downloading session data:', error);
    }
  };
  
  const changePlaybackSpeed = (speed) => {
    setPlaybackSpeed(speed);
  };
  
  const changeGazeHeatmapOpacity = (opacity) => {
    setGazeHeatmapOpacity(opacity);
  };
  
  const changeCursorHeatmapOpacity = (opacity) => {
    setCursorHeatmapOpacity(opacity);
  };
  
  const setDataTypeView = (type) => {
    setActiveDataType(type);
    resetPlayback();
  };
  
  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const loadMoreGazeData = async () => {
    if (isLoadingMore || !hasMoreData) return;
    
    setIsLoadingMore(true);
    
    try {
      const nextBatch = currentBatch + 1;
      const offset = nextBatch * BATCH_SIZE;
      
      const response = await api.get(`/api/sessions/${sessionId}/gaze?offset=${offset}&limit=${BATCH_SIZE}`);
      
      const newPoints = response.data.points || [];
      console.log(`Loaded ${newPoints.length} more points from offset ${offset}`);
      
      if (newPoints.length > 0) {
        setGazeData(prev => [...prev, ...newPoints]);
        setCurrentBatch(nextBatch);
        setHasMoreData(newPoints.length === BATCH_SIZE);
      } else {
        setHasMoreData(false);
      }
    } catch (err) {
      console.error('Error loading more gaze data:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };
  
  // Load more data when reaching the end of currently loaded data
  useEffect(() => {
    if (isPlaying && hasMoreData && gazeData.length > 0) {
      const sessionStartTime = new Date(gazeData[0].timestamp).getTime();
      const loadThreshold = sessionStartTime + (gazeData.length * 0.9); // 90% through the data
      
      if (currentTime > loadThreshold) {
        loadMoreGazeData();
      }
    }
  }, [currentTime, isPlaying, hasMoreData]);
  
  // Add a compact video player render function
  const renderCompactPlayer = () => {
    if (!videoUrl) {
      return (
        <div className="video-player-container compact">
          <div className="no-video-message">
            Видео недоступно
          </div>
        </div>
      );
    }
    
    console.log("Rendering compact player with video URL:", videoUrl);
    
    return (
      <div className={`video-player-container compact ${compact ? 'compact-mode' : ''}`}>
        <video 
          ref={videoRef}
          className="video-player"
          src={videoUrl}
          controls={false}
          muted
          preload="auto"
          onLoadedMetadata={() => {
            console.log("Video metadata loaded, duration:", videoRef.current.duration);
            if (videoRef.current) {
              setDuration(videoRef.current.duration * 1000); // Convert to ms
            }
          }}
          onError={(e) => {
            console.error("Video error:", e);
          }}
          onTimeUpdate={() => {
            if (videoRef.current) {
              setCurrentTime(videoRef.current.currentTime * 1000); // Convert to ms
            }
          }}
        />
        
        <div className="compact-controls">
          <button 
            className={`play-pause-button ${isPlaying ? 'pause' : 'play'}`}
            onClick={() => {
              if (videoRef.current) {
                if (isPlaying) {
                  videoRef.current.pause();
                } else {
                  videoRef.current.play().catch(e => {
                    console.error("Error playing video:", e);
                  });
                }
                setIsPlaying(!isPlaying);
              }
            }}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
          
          <div className="progress-container">
            <div 
              className="progress-bar"
              onClick={(e) => {
                if (videoRef.current && duration > 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickPosition = (e.clientX - rect.left) / rect.width;
                  const newTime = clickPosition * duration / 1000; // Convert to seconds
                  videoRef.current.currentTime = newTime;
                  setCurrentTime(newTime * 1000);
                }
              }}
            >
              <div 
                className="progress-indicator" 
                style={{ width: `${(currentTime / duration) * 100}%` }}
              ></div>
            </div>
            <div className="time-display">{formatTime(currentTime)}</div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render
  if (loading && !compact) {
    return (
      <div className="session-player-container loading">
        <div className="loading-indicator">Загрузка данных сессии...</div>
      </div>
    );
  }

  if (error && !compact) {
    return (
      <div className="session-player-container error">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/dashboard')} className="back-button">
          Вернуться на дашборд
        </button>
      </div>
    );
  }

  // For compact mode with video URL
  if (compact && videoUrl) {
    return renderCompactPlayer();
  }

  const hasCursorData = cursorData.length > 0;
  const hasGazeData = gazeData.length > 0;
  
  return (
    <div className="session-player" style={{ 
      border: 'none', 
      outline: 'none',
      backgroundColor: 'white' 
    }}>
      <div className="player-header">
        <h2>{session?.name || 'Session Recording'}</h2>
        <button onClick={() => navigate(-1)} className="back-button">← Back</button>
      </div>
      
      {/* Data type selection */}
      <div className="data-type-selector">
        <button 
          className={`data-button ${activeDataType === 'both' ? 'active' : ''}`}
          onClick={() => setDataTypeView('both')}
          disabled={!hasGazeData && !hasCursorData}
        >
          Все
        </button>
        <button 
          className={`data-button gaze-button ${activeDataType === 'gaze' ? 'active' : ''}`}
          onClick={() => setDataTypeView('gaze')}
          disabled={!hasGazeData}
        >
          Взгляд
        </button>
        <button 
          className={`data-button cursor-button ${activeDataType === 'cursor' ? 'active' : ''}`}
          onClick={() => setDataTypeView('cursor')}
          disabled={!hasCursorData}
        >
          Курсор
        </button>
      </div>
      
      <div className="player-content" style={{ border: 'none', outline: 'none' }}>
        <div 
          className="canvas-container" 
          ref={canvasContainerRef}
          style={{ 
            height: `${canvasDimensions.height}px`,
            border: '1px solid #ddd',
            outline: 'none',
            boxShadow: 'none',
            borderColor: '#ddd',
            borderImage: 'none',
            background: '#ffffff',
            backgroundColor: '#ffffff',
            color: 'inherit',
            backgroundImage: 'none !important',
            WebkitFilter: 'none',
            filter: 'none'
          }}
        >
          <canvas 
            ref={canvasRef} 
            className="points-canvas"
            width={1920}
            height={1080}
            style={{
              backgroundColor: 'transparent',
              background: 'transparent',
              border: 'none',
              outline: 'none'
            }}
          />
          <canvas 
            ref={gazeHeatmapCanvasRef} 
            className="heatmap-canvas gaze-heatmap"
            width={1920}
            height={1080}
            style={{
              backgroundColor: 'transparent',
              background: 'transparent',
              border: 'none',
              outline: 'none'
            }}
          />
          <canvas 
            ref={cursorHeatmapCanvasRef} 
            className="heatmap-canvas cursor-heatmap"
            width={1920}
            height={1080}
            style={{
              backgroundColor: 'transparent',
              background: 'transparent',
              border: 'none',
              outline: 'none'
            }}
          />
        </div>
        
        <div className="player-controls">
          <div className="playback-controls">
            <button onClick={togglePlayback} className="control-button">
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button onClick={resetPlayback} className="control-button">
              ⏮ Reset
            </button>
            
            <div className="speed-controls">
              <button 
                onClick={() => changePlaybackSpeed(0.5)} 
                className={`speed-button ${playbackSpeed === 0.5 ? 'active' : ''}`}
              >
                0.5x
              </button>
              <button 
                onClick={() => changePlaybackSpeed(1)} 
                className={`speed-button ${playbackSpeed === 1 ? 'active' : ''}`}
              >
                1x
              </button>
              <button 
                onClick={() => changePlaybackSpeed(2)} 
                className={`speed-button ${playbackSpeed === 2 ? 'active' : ''}`}
              >
                2x
              </button>
            </div>
            
            {/* Debug button
            <button 
              onClick={renderTestFrame} 
              className="debug-button"
              title="Test rendering with synthetic data"
              style={{ marginLeft: '20px', background: '#e74c3c' }}
            >
              Debug Render
            </button>
            
            <button 
              onClick={downloadSessionData} 
              className="debug-button"
              title="Download session data for debugging"
              style={{ marginLeft: '10px', background: '#9b59b6' }}
            >
              Export Data
            </button> */}
          </div>
          
          <div className="progress-container">
            <div className="time-display">{formatTime(currentTime)}</div>
            <div 
              className="progress-bar"
              onClick={handleTimelineClick}
              style={{ cursor: 'pointer' }}  
            >
              <div 
                className="progress-fill" 
                style={{ width: `${(currentTime / duration) * 100}%` }}
              ></div>
            </div>
            <div className="time-display">{formatTime(duration)}</div>
          </div>
        </div>
      </div>
      
      <div className="session-info">
        <div className="info-panel">
          <h3>Данные сессии</h3>
          <p><strong>Название:</strong> {session?.name || 'Unknown'}</p>
          <p><strong>Дата:</strong> {session?.created_at ? new Date(session.created_at).toLocaleString() : 'Unknown'}</p>
          <p><strong>Длительность:</strong> {formatTime(duration)}</p>
          <p><strong>Пользователь:</strong> {session?.username || 'Unknown'}</p>
          <p><strong>Точки данных:</strong> Взгляд: {gazeData.length}, Курсор: {cursorData.length}</p>
        </div>
      </div>
    </div>
  );
};

// Create a singleton wrapper component
const SessionPlayerSingleton = ({ 
  sessionId, 
  videoUrl, 
  compact = false, 
  gazeData: preloadedGazeData, 
  cursorData: preloadedCursorData,
  session: preloadedSession
}) => {
  // Modified to support both sessionId and direct videoUrl for compact mode
  return (
    <SessionPlayerComponent
      sessionId={sessionId}
      videoUrl={videoUrl}
      compact={compact}
      gazeData={preloadedGazeData}
      cursorData={preloadedCursorData}
      session={preloadedSession}
    />
  );
};

// Use React.memo to prevent unnecessary re-renders
const SessionPlayer = React.memo(SessionPlayerSingleton, (prevProps, nextProps) => {
  // Only re-render if the sessionId actually changes
  return prevProps.sessionId === nextProps.sessionId;
});

export default SessionPlayer; 